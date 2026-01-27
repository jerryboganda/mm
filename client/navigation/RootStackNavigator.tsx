import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/lib/auth";
import { ActivityIndicator, View, StyleSheet } from "react-native";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import LoginScreen from "@/screens/LoginScreen";
import RegisterScreen from "@/screens/RegisterScreen";
import ForgotPasswordScreen from "@/screens/ForgotPasswordScreen";
import ResetPasswordScreen from "@/screens/ResetPasswordScreen";
import TopicReaderScreen from "@/screens/TopicReaderScreen";
import QuizTopicSelectScreen from "@/screens/QuizTopicSelectScreen";
import QuizPlayerScreen from "@/screens/QuizPlayerScreen";
import QuizResultsScreen from "@/screens/QuizResultsScreen";
import QuizSettingsScreen from "@/screens/QuizSettingsScreen";
import SubscriptionScreen from "@/screens/SubscriptionScreen";
import BookmarksScreen from "@/screens/BookmarksScreen";
import { Colors } from "@/constants/theme";

export type RootStackParamList = {
  Main: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string };
  TopicReader: { topicId: string; topicTitle: string };
  QuizTopicSelect: undefined;
  QuizPlayer: { mode: "topic" | "mixed" | "wrong"; topicId?: string };
  QuizResults: { resultId: string };
  QuizSettings: undefined;
  Subscription: undefined;
  Bookmarks: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {isAuthenticated ? (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="TopicReader"
            component={TopicReaderScreen}
            options={({ route }) => ({
              headerTitle: "Topic",
              presentation: "card",
            })}
          />
          <Stack.Screen
            name="QuizTopicSelect"
            component={QuizTopicSelectScreen}
            options={{
              headerTitle: "Select Topic",
              presentation: "card",
            }}
          />
          <Stack.Screen
            name="QuizPlayer"
            component={QuizPlayerScreen}
            options={{
              headerShown: false,
              presentation: "fullScreenModal",
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="QuizResults"
            component={QuizResultsScreen}
            options={{
              headerShown: false,
              presentation: "card",
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="QuizSettings"
            component={QuizSettingsScreen}
            options={{
              headerTitle: "Quiz Settings",
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="Subscription"
            component={SubscriptionScreen}
            options={{
              headerTitle: "Subscription",
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="Bookmarks"
            component={BookmarksScreen}
            options={{
              headerTitle: "Bookmarks",
              presentation: "card",
            }}
          />
        </>
      ) : (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{
              headerTitle: "",
              headerTransparent: true,
            }}
          />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{
              headerTitle: "",
              headerTransparent: true,
            }}
          />
          <Stack.Screen
            name="ResetPassword"
            component={ResetPasswordScreen}
            options={{
              headerTitle: "",
              headerTransparent: true,
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.backgroundRoot,
  },
});
