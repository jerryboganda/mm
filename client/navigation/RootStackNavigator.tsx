import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/lib/auth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { ActivityIndicator, View, StyleSheet } from "react-native";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import WelcomeScreen from "@/screens/WelcomeScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import PermissionsPromptScreen from "@/screens/PermissionsPromptScreen";
import LoginScreen from "@/screens/LoginScreen";
import RegisterScreen from "@/screens/RegisterScreen";
import ForgotPasswordScreen from "@/screens/ForgotPasswordScreen";
import ResetPasswordScreen from "@/screens/ResetPasswordScreen";
import EmailVerificationScreen from "@/screens/EmailVerificationScreen";
import TopicReaderScreen from "@/screens/TopicReaderScreen";
import QuizTopicSelectScreen from "@/screens/QuizTopicSelectScreen";
import QuizPlayerScreen from "@/screens/QuizPlayerScreen";
import QuizResultsScreen from "@/screens/QuizResultsScreen";
import QuizSettingsScreen from "@/screens/QuizSettingsScreen";
import SubscriptionScreen from "@/screens/SubscriptionScreen";
import BookmarksScreen from "@/screens/BookmarksScreen";
import RecentActivityScreen from "@/screens/RecentActivityScreen";
import AttemptHistoryScreen from "@/screens/AttemptHistoryScreen";
import AttemptDetailScreen from "@/screens/AttemptDetailScreen";
import TopicProgressDetailScreen from "@/screens/TopicProgressDetailScreen";
import PaywallScreen from "@/screens/PaywallScreen";
import PurchaseSuccessScreen from "@/screens/PurchaseSuccessScreen";
import PurchaseFailedScreen from "@/screens/PurchaseFailedScreen";
import RestorePurchasesScreen from "@/screens/RestorePurchasesScreen";
import EditProfileScreen from "@/screens/EditProfileScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import SecuritySettingsScreen from "@/screens/SecuritySettingsScreen";
import HelpSupportScreen from "@/screens/HelpSupportScreen";
import AboutScreen from "@/screens/AboutScreen";
import TermsPrivacyScreen from "@/screens/TermsPrivacyScreen";
import DisclaimerScreen from "@/screens/DisclaimerScreen";
import { Colors } from "@/constants/theme";

export type RootStackParamList = {
  Welcome: undefined;
  Onboarding: undefined;
  PermissionsPrompt: undefined;
  Main: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string };
  EmailVerification: { email: string };
  TopicReader: { topicId: string; topicTitle: string };
  QuizTopicSelect: undefined;
  QuizPlayer: { mode: "topic" | "mixed" | "wrong"; topicId?: string };
  QuizResults: { resultId: string };
  QuizSettings: undefined;
  Subscription: undefined;
  Bookmarks: undefined;
  RecentActivity: undefined;
  AttemptHistory: undefined;
  AttemptDetail: { attemptId: string };
  TopicProgressDetail: { topicId: string; topicTitle: string };
  Paywall: undefined;
  PurchaseSuccess: undefined;
  PurchaseFailed: { errorMessage?: string };
  RestorePurchases: undefined;
  EditProfile: undefined;
  Settings: undefined;
  SecuritySettings: undefined;
  HelpSupport: undefined;
  About: undefined;
  TermsPrivacy: undefined;
  Disclaimer: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { hasCompletedOnboarding, isLoading: onboardingLoading } = useOnboarding();

  if (authLoading || onboardingLoading) {
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
          <Stack.Screen
            name="RecentActivity"
            component={RecentActivityScreen}
            options={{
              headerTitle: "Recent Activity",
              presentation: "card",
            }}
          />
          <Stack.Screen
            name="AttemptHistory"
            component={AttemptHistoryScreen}
            options={{
              headerTitle: "Quiz History",
              presentation: "card",
            }}
          />
          <Stack.Screen
            name="AttemptDetail"
            component={AttemptDetailScreen}
            options={{
              headerTitle: "Attempt Details",
              presentation: "card",
            }}
          />
          <Stack.Screen
            name="TopicProgressDetail"
            component={TopicProgressDetailScreen}
            options={{
              headerTitle: "Topic Progress",
              presentation: "card",
            }}
          />
          <Stack.Screen
            name="Paywall"
            component={PaywallScreen}
            options={{
              headerTitle: "",
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="PurchaseSuccess"
            component={PurchaseSuccessScreen}
            options={{
              headerShown: false,
              presentation: "fullScreenModal",
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="PurchaseFailed"
            component={PurchaseFailedScreen}
            options={{
              headerShown: false,
              presentation: "fullScreenModal",
            }}
          />
          <Stack.Screen
            name="RestorePurchases"
            component={RestorePurchasesScreen}
            options={{
              headerTitle: "Restore Purchases",
              presentation: "card",
            }}
          />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{
              headerTitle: "Edit Profile",
              presentation: "card",
            }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              headerTitle: "Settings",
              presentation: "card",
            }}
          />
          <Stack.Screen
            name="SecuritySettings"
            component={SecuritySettingsScreen}
            options={{
              headerTitle: "Security",
              presentation: "card",
            }}
          />
          <Stack.Screen
            name="HelpSupport"
            component={HelpSupportScreen}
            options={{
              headerTitle: "Help & Support",
              presentation: "card",
            }}
          />
          <Stack.Screen
            name="About"
            component={AboutScreen}
            options={{
              headerTitle: "About",
              presentation: "card",
            }}
          />
          <Stack.Screen
            name="TermsPrivacy"
            component={TermsPrivacyScreen}
            options={{
              headerTitle: "Legal",
              presentation: "card",
            }}
          />
          <Stack.Screen
            name="Disclaimer"
            component={DisclaimerScreen}
            options={{
              headerTitle: "Medical Disclaimer",
              presentation: "card",
            }}
          />
        </>
      ) : hasCompletedOnboarding ? (
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
          <Stack.Screen
            name="EmailVerification"
            component={EmailVerificationScreen}
            options={{
              headerTitle: "",
              headerTransparent: true,
            }}
          />
        </>
      ) : (
        <>
          <Stack.Screen
            name="Welcome"
            component={WelcomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="PermissionsPrompt"
            component={PermissionsPromptScreen}
            options={{ headerShown: false }}
          />
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
            name="EmailVerification"
            component={EmailVerificationScreen}
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
