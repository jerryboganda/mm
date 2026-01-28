import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
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

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/lib/auth";
import { PurchasesProvider } from "@/lib/purchases";
import { NetworkProvider } from "@/lib/network";
import { AppNetworkWrapper } from "@/components/AppNetworkWrapper";
import { Colors } from "@/constants/theme";

SplashScreen.preventAutoHideAsync();

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

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PurchasesProvider>
            <NetworkProvider>
              <SafeAreaProvider>
                <GestureHandlerRootView style={styles.root}>
                  <KeyboardProvider>
                    <NavigationContainer
                      theme={{
                        dark: true,
                        colors: {
                          primary: Colors.dark.primary,
                          background: Colors.dark.backgroundRoot,
                          card: Colors.dark.backgroundDefault,
                          text: Colors.dark.text,
                          border: Colors.dark.glassBorder,
                          notification: Colors.dark.primary,
                        },
                        fonts: {
                          regular: {
                            fontFamily: "Inter_400Regular",
                            fontWeight: "400",
                          },
                          medium: {
                            fontFamily: "Inter_500Medium",
                            fontWeight: "500",
                          },
                          bold: {
                            fontFamily: "Inter_700Bold",
                            fontWeight: "700",
                          },
                          heavy: {
                            fontFamily: "Inter_700Bold",
                            fontWeight: "700",
                          },
                        },
                      }}
                    >
                      <AppNetworkWrapper>
                        <RootStackNavigator />
                      </AppNetworkWrapper>
                    </NavigationContainer>
                    <StatusBar style="light" />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </SafeAreaProvider>
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
