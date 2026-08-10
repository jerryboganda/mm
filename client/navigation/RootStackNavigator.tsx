import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/lib/auth";
import { useOnboarding } from "@/hooks/useOnboarding";
import {
  ActivityIndicator,
  View,
  StyleSheet,
  Pressable,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import WelcomeScreen from "@/screens/WelcomeScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import PermissionsPromptScreen from "@/screens/PermissionsPromptScreen";
import LoginScreen from "@/screens/LoginScreen";
import ScanLoginScreen from "@/screens/ScanLoginScreen";
import RegisterScreen from "@/screens/RegisterScreen";
import ForgotPasswordScreen from "@/screens/ForgotPasswordScreen";
import ResetPasswordScreen from "@/screens/ResetPasswordScreen";
import VerifyEmailScreen from "@/screens/VerifyEmailScreen";
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
import PurchaseScreen from "@/screens/PurchaseScreen";
import PaymentProofUploadScreen from "@/screens/PaymentProofUploadScreen";
import PendingApprovalScreen from "@/screens/PendingApprovalScreen";
import PurchaseSuccessScreen from "@/screens/PurchaseSuccessScreen";
import PurchaseFailedScreen from "@/screens/PurchaseFailedScreen";
import EditProfileScreen from "@/screens/EditProfileScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import SecuritySettingsScreen from "@/screens/SecuritySettingsScreen";
import HelpSupportScreen from "@/screens/HelpSupportScreen";
import AboutScreen from "@/screens/AboutScreen";
import TermsPrivacyScreen from "@/screens/TermsPrivacyScreen";
import DisclaimerScreen from "@/screens/DisclaimerScreen";
import SpacedReviewScreen from "@/screens/SpacedReviewScreen";
import AdminEmailSettingsScreen from "@/screens/AdminEmailSettingsScreen";
import { useTheme } from "@/hooks/useTheme";
import { useMobileContent } from "@/lib/mobile-content";

export type RootStackParamList = {
  Welcome: undefined;
  Onboarding: undefined;
  PermissionsPrompt: undefined;
  Main: undefined;
  Login: undefined;
  ScanLogin: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email: string; code: string };
  VerifyEmail: { email: string };
  TopicReader: { topicId: string; topicTitle: string };
  QuizTopicSelect: undefined;
  QuizPlayer: {
    mode: "topic" | "mixed" | "wrong" | "exam";
    topicId?: string;
    questionCount?: number;
  };
  QuizResults: { resultId: string };
  QuizSettings: undefined;
  Subscription: undefined;
  Bookmarks: undefined;
  RecentActivity: undefined;
  AttemptHistory: undefined;
  AttemptDetail: { attemptId: string };
  TopicProgressDetail: { topicId: string; topicTitle: string };
  Paywall: undefined;
  Purchase: {
    packageId: string;
    priceId: string;
    packageName: string;
    price: string;
    currency: string;
    billingCycle: string;
    couponId?: string;
    couponCode?: string;
    discountedPrice?: string;
  };
  PaymentProofUpload: {
    packageId: string;
    priceId: string;
    packageName: string;
    price: string;
    currency: string;
    couponId?: string;
    couponCode?: string;
    discountedPrice?: string;
  };
  PendingApproval: undefined;
  PurchaseSuccess: undefined;
  PurchaseFailed: { errorMessage?: string };
  EditProfile: undefined;
  Settings: undefined;
  SecuritySettings: undefined;
  HelpSupport: undefined;
  About: undefined;
  TermsPrivacy: undefined;
  Disclaimer: undefined;
  SpacedReview: undefined;
  AdminEmailSettings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const { resolveText } = useMobileContent();
  const { hasCompletedOnboarding, isLoading: onboardingLoading } =
    useOnboarding();
  const { theme } = useTheme();
  const t = resolveText;

  const requiresEmailVerification = user && !user.isEmailVerified;

  if (authLoading || onboardingLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: theme.backgroundRoot },
        ]}
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {isAuthenticated ? (
        requiresEmailVerification ? (
          <Stack.Screen
            name="VerifyEmail"
            component={VerifyEmailScreen}
            initialParams={{ email: user.email }}
            options={{
              headerTitle: "",
              headerTransparent: true,
            }}
          />
        ) : (
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
                headerTitle: route.params.topicTitle,
                presentation: "card",
              })}
            />
            <Stack.Screen
              name="QuizTopicSelect"
              component={QuizTopicSelectScreen}
              options={{
                headerTitle: t("Select Topic"),
                presentation: "card",
              }}
            />
            <Stack.Screen
              name="QuizPlayer"
              component={QuizPlayerScreen}
              options={{
                headerShown: false,
                gestureEnabled: false,
                animation: "slide_from_bottom",
              }}
            />
            <Stack.Screen
              name="QuizResults"
              component={QuizResultsScreen}
              options={{
                headerShown: false,
                gestureEnabled: false,
              }}
            />
            <Stack.Screen
              name="QuizSettings"
              component={QuizSettingsScreen}
              options={{
                headerTitle: t("Quiz Settings"),
                presentation: "card",
              }}
            />
            <Stack.Screen
              name="Subscription"
              component={SubscriptionScreen}
              options={{
                headerTitle: t("Subscription"),
                presentation: "card",
              }}
            />
            <Stack.Screen
              name="Bookmarks"
              component={BookmarksScreen}
              options={{
                headerTitle: t("Bookmarks"),
                presentation: "card",
              }}
            />
            <Stack.Screen
              name="RecentActivity"
              component={RecentActivityScreen}
              options={{
                headerTitle: t("Recent Activity"),
                presentation: "card",
              }}
            />
            <Stack.Screen
              name="AttemptHistory"
              component={AttemptHistoryScreen}
              options={{
                headerTitle: t("Attempt History"),
                presentation: "card",
              }}
            />
            <Stack.Screen
              name="AttemptDetail"
              component={AttemptDetailScreen}
              options={{
                headerTitle: t("Attempt Detail"),
                presentation: "card",
              }}
            />
            <Stack.Screen
              name="TopicProgressDetail"
              component={TopicProgressDetailScreen}
              options={({ route }) => ({
                headerTitle: route.params.topicTitle,
                presentation: "card",
              })}
            />
            <Stack.Screen
              name="Paywall"
              component={PaywallScreen}
              options={{
                headerShown: false,
                presentation: "modal",
              }}
            />
            <Stack.Screen
              name="PurchaseSuccess"
              component={PurchaseSuccessScreen}
              options={{
                headerShown: false,
                gestureEnabled: false,
              }}
            />
            <Stack.Screen
              name="PurchaseFailed"
              component={PurchaseFailedScreen}
              options={{
                headerTitle: t("Payment Failed"),
                presentation: "card",
              }}
            />
            <Stack.Screen
              name="Purchase"
              component={PurchaseScreen}
              options={{
                headerTitle: t("Payment Details"),
                presentation: "card",
              }}
            />
            <Stack.Screen
              name="PaymentProofUpload"
              component={PaymentProofUploadScreen}
              options={{
                headerTitle: t("Upload Payment Proof"),
                presentation: "card",
              }}
            />
            <Stack.Screen
              name="PendingApproval"
              component={PendingApprovalScreen}
              options={{
                headerShown: false,
                gestureEnabled: false,
              }}
            />
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{
                headerTitle: t("Edit Profile"),
                presentation: "card",
              }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                headerTitle: t("Settings"),
                presentation: "card",
              }}
            />
            <Stack.Screen
              name="SecuritySettings"
              component={SecuritySettingsScreen}
              options={{
                headerTitle: t("Security"),
                presentation: "card",
              }}
            />
            <Stack.Screen
              name="HelpSupport"
              component={HelpSupportScreen}
              options={{
                headerTitle: t("Help & Support"),
                presentation: "card",
              }}
            />
            <Stack.Screen
              name="About"
              component={AboutScreen}
              options={{
                headerTitle: t("About"),
                presentation: "card",
              }}
            />
            <Stack.Screen
              name="TermsPrivacy"
              component={TermsPrivacyScreen}
              options={{
                headerTitle: t("Terms & Privacy"),
                presentation: "card",
              }}
            />
            <Stack.Screen
              name="Disclaimer"
              component={DisclaimerScreen}
              options={{
                headerTitle: t("Medical Disclaimer"),
                presentation: "card",
              }}
            />
            <Stack.Screen
              name="SpacedReview"
              component={SpacedReviewScreen}
              options={{
                headerShown: false,
                gestureEnabled: false,
                animation: "slide_from_bottom",
              }}
            />
            <Stack.Screen
              name="AdminEmailSettings"
              component={AdminEmailSettingsScreen}
              options={{
                headerTitle: t("Email Settings"),
                presentation: "card",
              }}
            />
          </>
        )
      ) : hasCompletedOnboarding ? (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ScanLogin"
            component={ScanLoginScreen}
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
            name="VerifyEmail"
            component={VerifyEmailScreen}
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
            name="Disclaimer"
            component={DisclaimerScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ScanLogin"
            component={ScanLoginScreen}
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
            name="VerifyEmail"
            component={VerifyEmailScreen}
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
  },
});
