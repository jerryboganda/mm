import React, { useEffect } from "react";
import { StyleSheet, AppState } from "react-native";
import { NavigationContainer, LinkingOptions } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
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
import { PurchasesProvider } from "@/lib/purchases";
import { NetworkProvider } from "@/lib/network";
import { MobileContentProvider } from "@/lib/mobile-content";
import { AppNetworkWrapper } from "@/components/AppNetworkWrapper";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { persistQueryCache, restoreQueryCache } from "@/lib/offline-cache";

SplashScreen.preventAutoHideAsync();

// Deep linking configuration
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["maternalmind://", "https://maternalmind.com.pk"],
  config: {
    screens: {
      Main: {
        screens: {
          HomeTab: "home",
          LibraryTab: {
            screens: {
              Books: "library",
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
      QuizPlayer: "quiz/play/:mode",
      QuizResults: "quiz/results/:resultId",
      ResetPassword: "reset-password",
      Subscription: "subscribe",
      Bookmarks: "bookmarks",
    },
  },
};

function AppContent() {
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
    <NavigationContainer theme={navigationTheme} linking={linking as any}>
      <AppNetworkWrapper>
        <RootStackNavigator />
      </AppNetworkWrapper>
    </NavigationContainer>
  );
}

export default function App() {
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

  // Restore offline cache on startup
  useEffect(() => {
    restoreQueryCache(queryClient);
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

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PurchasesProvider>
            <NetworkProvider>
              <MobileContentProvider>
                <SafeAreaProvider>
                  <GestureHandlerRootView style={styles.root}>
                    <KeyboardProvider>
                      <AppContent />
                      <StatusBar style="auto" />
                    </KeyboardProvider>
                  </GestureHandlerRootView>
                </SafeAreaProvider>
              </MobileContentProvider>
            </NetworkProvider>
          </PurchasesProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
});
