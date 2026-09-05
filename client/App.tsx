import React, { useEffect } from "react";
import { AppState, Platform } from "react-native";
import {
  NavigationContainer,
  type InitialState,
  LinkingOptions,
  getPathFromState as defaultGetPathFromState,
  getStateFromPath as defaultGetStateFromPath,
} from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ExpoLinking from "expo-linking";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { FeedbackProvider } from "@/lib/feedback";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator, {
  RootStackParamList,
} from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/lib/auth";
import { NetworkProvider } from "@/lib/network";
import { MobileContentProvider } from "@/lib/mobile-content";
import { AppNetworkWrapper } from "@/components/AppNetworkWrapper";
import { OtaUpdatesProvider } from "@/lib/updates";
import { UpdateRequiredModal } from "@/components/UpdateRequiredModal";
import { useTheme } from "@/hooks/useTheme";
import {
  persistQueryCache,
  restoreQueryCache,
  startPeriodicPersist,
  persistOnQuerySuccess,
} from "@/lib/offline-cache";
import { startMutationQueueListener } from "@/lib/mutation-queue";

SplashScreen.preventAutoHideAsync();

const WEB_APP_BASE_PATH = "/app";

function shouldUseHostedWebBasePath() {
  return (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    (window.location.pathname.startsWith(WEB_APP_BASE_PATH) ||
      window.location.hostname === "admin.maternalmind.com.pk")
  );
}

function stripHostedWebBasePath(path: string) {
  if (!shouldUseHostedWebBasePath()) {
    return path;
  }

  if (path === WEB_APP_BASE_PATH) {
    return "/";
  }

  if (path.startsWith(`${WEB_APP_BASE_PATH}/`)) {
    return path.slice(WEB_APP_BASE_PATH.length);
  }

  return path;
}

function addHostedWebBasePath(path: string) {
  if (!shouldUseHostedWebBasePath()) {
    return path;
  }

  if (!path || path === "/") {
    return WEB_APP_BASE_PATH;
  }

  return `${WEB_APP_BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

// Deep linking configuration
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    "maternalmind://",
    "https://maternalmind.com.pk",
    "https://admin.maternalmind.com.pk",
    "https://admin.maternalmind.com.pk/app",
    ExpoLinking.createURL("/"),
  ],
  getStateFromPath(path, options) {
    return defaultGetStateFromPath(stripHostedWebBasePath(path), options);
  },
  getPathFromState(state, options) {
    return addHostedWebBasePath(defaultGetPathFromState(state, options));
  },
  config: {
    screens: {
      Main: {
        screens: {
          HomeTab: "home",
          LibraryTab: {
            screens: {
              LearnHome: "library",
              Chapters: "library/book/:bookId",
              Topics: "library/chapter/:chapterId",
            },
          },
          QuizTab: "quiz",
          ProgressTab: "progress",
          ProfileTab: "profile",
        },
      },
      TopicReader: "topic/:topicId",
      Subtopics: "topic/:topicId/subtopics",
      QuizPlayer: "quiz/play/:mode",
      QuizResults: "quiz/results/:resultId",
      ResetPassword: "reset-password",
      Subscription: "subscribe",
      Bookmarks: "bookmarks",
    },
  },
};

function AppContent({
  initialNavigationState,
}: {
  initialNavigationState: InitialState | undefined;
}) {
  const { theme, isDark } = useTheme();

  const navigationTheme = {
    dark: isDark,
    colors: {
      primary: theme.primary,
      background: theme.backgroundRoot,
      card: theme.backgroundDefault,
      text: theme.text,
      border: theme.glassBorder,
      notification: theme.primary,
    },
    fonts: {
      regular: {
        fontFamily: "Inter_400Regular",
        fontWeight: "400" as const,
      },
      medium: {
        fontFamily: "Inter_500Medium",
        fontWeight: "500" as const,
      },
      bold: {
        fontFamily: "Inter_700Bold",
        fontWeight: "700" as const,
      },
      heavy: {
        fontFamily: "Inter_700Bold",
        fontWeight: "700" as const,
      },
    },
  };

  return (
    <NavigationContainer
      theme={navigationTheme}
      linking={linking as any}
      initialState={initialNavigationState}
      onStateChange={(state) => {
        if (state) {
          AsyncStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(state));
        }
      }}
    >
      <AppNetworkWrapper>
        <RootStackNavigator />
      </AppNetworkWrapper>
    </NavigationContainer>
  );
}

const NAVIGATION_STATE_KEY = "NAVIGATION_STATE_V1";

export default function App() {
  const [initialNavigationState, setInitialNavigationState] = React.useState<
    InitialState | undefined
  >(undefined);
  const [navigationStateReady, setNavigationStateReady] = React.useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    const restoreNavigationState = async () => {
      try {
        const initialUrl = await ExpoLinking.getInitialURL();
        if (initialUrl) {
          setNavigationStateReady(true);
          return;
        }

        const savedStateString =
          await AsyncStorage.getItem(NAVIGATION_STATE_KEY);

        if (savedStateString) {
          setInitialNavigationState(JSON.parse(savedStateString));
        }
      } catch (error) {
        console.warn("Failed to restore navigation state", error);
      } finally {
        setNavigationStateReady(true);
      }
    };

    restoreNavigationState();
  }, []);

  // Restore offline cache on startup & start mutation queue listener
  useEffect(() => {
    restoreQueryCache(queryClient);
    const unsubMutationQueue = startMutationQueueListener();
    const stopPeriodicPersist = startPeriodicPersist(queryClient, 60_000);
    const stopPersistOnSuccess = persistOnQuerySuccess(queryClient, 3_000);
    return () => {
      unsubMutationQueue();
      stopPeriodicPersist();
      stopPersistOnSuccess();
    };
  }, []);

  // Persist cache when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        persistQueryCache(queryClient);
      }
    });
    return () => subscription.remove();
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (!navigationStateReady) {
    return null;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NetworkProvider>
            <MobileContentProvider>
              <FeedbackProvider>
                <SafeAreaProvider>
                  <ThemedRoot>
                    <KeyboardProvider>
                      <AppContent
                        initialNavigationState={initialNavigationState}
                      />
                    </KeyboardProvider>
                  </ThemedRoot>
                </SafeAreaProvider>
              </FeedbackProvider>
            </MobileContentProvider>
          </NetworkProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

function ThemedRoot({ children }: { children: React.ReactNode }) {
  const { theme, isDark } = useTheme();
  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
    >
      <OtaUpdatesProvider>
        {children}
        {/* Mandatory OTA update popup — inert on web & in dev, blocks in native prod */}
        <UpdateRequiredModal />
      </OtaUpdatesProvider>
      <StatusBar style={isDark ? "light" : "dark"} />
    </GestureHandlerRootView>
  );
}

// root style is applied dynamically in the component via useTheme()
