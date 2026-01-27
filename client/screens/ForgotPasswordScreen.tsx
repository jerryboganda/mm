import React, { useState } from "react";
import { StyleSheet, View, Image, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassInput } from "@/components/GlassInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { getApiUrl } from "@/lib/query-client";
import { Colors, Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Feather } from "@expo/vector-icons";

type ForgotPasswordScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "ForgotPassword">;

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ForgotPasswordScreenNavigationProp>();
  
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!email) {
      setError("Please enter your email address");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const baseUrl = getApiUrl();
      const response = await fetch(new URL("/api/auth/forgot-password", baseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setSubmitted(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        const data = await response.json();
        setError(data.message || "Failed to send reset email");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: any) {
      setError("Network error. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <BackgroundGradient variant="auth">
        <View
          style={[
            styles.container,
            {
              paddingTop: insets.top + Spacing["4xl"],
              paddingBottom: insets.bottom + Spacing["3xl"],
            },
          ]}
        >
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Feather name="mail" size={48} color={Colors.primary} />
            </View>
            <ThemedText type="h2" style={styles.successTitle}>
              Check Your Email
            </ThemedText>
            <ThemedText style={styles.successMessage}>
              If an account exists with {email}, we've sent password reset instructions.
            </ThemedText>
            <PrimaryButton
              title="Back to Sign In"
              onPress={() => navigation.navigate("Login")}
              style={styles.backButton}
            />
          </View>
        </View>
      </BackgroundGradient>
    );
  }

  return (
    <BackgroundGradient variant="auth">
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing["4xl"],
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
        ]}
      >
        <View style={styles.header}>
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <ThemedText type="h1" style={styles.title}>
            Forgot Password
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Enter your email and we'll send you a reset link
          </ThemedText>
        </View>

        <View style={styles.form}>
          <GlassInput
            label="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError("");
            }}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            icon="mail"
            error={error}
          />

          <PrimaryButton
            title="Send Reset Link"
            onPress={handleSubmit}
            loading={loading}
            style={styles.button}
          />
        </View>

        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>
            Remember your password?{" "}
          </ThemedText>
          <ThemedText
            style={styles.linkText}
            onPress={() => navigation.navigate("Login")}
          >
            Sign In
          </ThemedText>
        </View>
      </KeyboardAwareScrollViewCompat>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: Spacing.xl,
    borderRadius: 16,
  },
  title: {
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    color: Colors.text.secondary,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
  },
  form: {
    marginBottom: Spacing["2xl"],
  },
  button: {
    marginTop: Spacing.lg,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    color: Colors.text.secondary,
    fontSize: 14,
  },
  linkText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  successContainer: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.glass.background,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  successTitle: {
    color: Colors.text.primary,
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  successMessage: {
    color: Colors.text.secondary,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 24,
    marginBottom: Spacing["2xl"],
  },
  backButton: {
    width: "100%",
  },
});
