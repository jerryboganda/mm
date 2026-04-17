import React, { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Image,
  TextInput as RNTextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import * as Haptics from "@/lib/haptics-wrapper";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassInput } from "@/components/GlassInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { getApiUrl } from "@/lib/query-client";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Feather } from "@expo/vector-icons";

type ForgotPasswordScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "ForgotPassword"
>;

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<ForgotPasswordScreenNavigationProp>();
  const { theme } = useTheme();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");

  // OTP input state (6 individual digits)
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const otpRefs = useRef<(RNTextInput | null)[]>([]);

  const authTopPadding = Math.max(
    insets.top + Spacing["6xl"],
    headerHeight + Spacing["2xl"],
  );

  const handleSendCode = async () => {
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
      const response = await fetch(
        new URL("/api/auth/forgot-password", baseUrl),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );

      if (response.ok) {
        setOtpSent(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        const data = await response.json();
        setError(data.message || "Failed to send reset code");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: any) {
      setError("Network error. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    // Handle paste of full code
    if (text.length > 1) {
      const digits = text.replace(/\D/g, "").slice(0, 6).split("");
      digits.forEach((d, i) => {
        if (i < 6) newOtp[i] = d;
      });
      setOtp(newOtp);
      // Focus last filled or the next empty
      const focusIdx = Math.min(digits.length, 5);
      otpRefs.current[focusIdx]?.focus();
      setOtpError("");
      return;
    }
    newOtp[index] = text.replace(/\D/g, "");
    setOtp(newOtp);
    setOtpError("");
    if (text && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length !== 6) {
      setOtpError("Please enter the full 6-digit code");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setVerifying(true);
    setOtpError("");

    try {
      const baseUrl = getApiUrl();
      const response = await fetch(
        new URL("/api/auth/verify-reset-otp", baseUrl),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code }),
        },
      );

      if (response.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.navigate("ResetPassword", { email, code });
      } else {
        const data = await response.json();
        setOtpError(data.message || "Invalid or expired code");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: any) {
      setOtpError("Network error. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    setOtp(["", "", "", "", "", ""]);
    setOtpError("");
    await handleSendCode();
  };

  // ---- OTP Entry Screen ----
  if (otpSent) {
    return (
      <BackgroundGradient variant="auth">
        <KeyboardAwareScrollViewCompat
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: authTopPadding,
              paddingBottom: insets.bottom + Spacing["3xl"],
            },
          ]}
        >
          <View style={styles.header}>
            <View
              style={[styles.successIcon, { backgroundColor: theme.glass }]}
            >
              <Feather name="mail" size={48} color={theme.primary} />
            </View>
            <ThemedText
              type="h2"
              style={styles.title}
              accessibilityRole="header"
            >
              Enter Reset Code
            </ThemedText>
            <ThemedText
              style={[styles.subtitle, { color: theme.textSecondary }]}
            >
              We sent a 6-digit code to {email}. Enter it below to reset your
              password.
            </ThemedText>
          </View>

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <RNTextInput
                key={index}
                ref={(ref) => {
                  otpRefs.current[index] = ref;
                }}
                style={[
                  styles.otpInput,
                  {
                    borderColor: digit
                      ? theme.primary
                      : otpError
                        ? theme.error
                        : theme.glassBorder,
                    backgroundColor: theme.glass,
                    color: theme.text,
                  },
                ]}
                value={digit}
                onChangeText={(text) => handleOtpChange(text, index)}
                onKeyPress={(e) => handleOtpKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={index === 0 ? 6 : 1}
                selectTextOnFocus
                textAlign="center"
                accessibilityLabel={`Reset code digit ${index + 1}`}
              />
            ))}
          </View>

          {otpError ? (
            <ThemedText style={[styles.errorText, { color: theme.error }]}>
              {otpError}
            </ThemedText>
          ) : null}

          <PrimaryButton
            title="Verify & Continue"
            onPress={handleVerifyOtp}
            loading={verifying}
            style={styles.button}
          />

          <View style={[styles.footer, { marginTop: Spacing.xl }]}>
            <ThemedText
              style={[styles.footerText, { color: theme.textSecondary }]}
            >
              Didn't receive the code?{" "}
            </ThemedText>
            <ThemedText
              style={[styles.linkText, { color: theme.primary }]}
              onPress={handleResendCode}
            >
              Resend
            </ThemedText>
          </View>

          <View style={[styles.footer, { marginTop: Spacing.sm }]}>
            <ThemedText
              style={[styles.linkText, { color: theme.primary }]}
              onPress={() => navigation.navigate("Login")}
            >
              Back to Sign In
            </ThemedText>
          </View>
        </KeyboardAwareScrollViewCompat>
      </BackgroundGradient>
    );
  }

  // ---- Email Entry Screen ----
  return (
    <BackgroundGradient variant="auth">
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: authTopPadding,
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
          <ThemedText type="h1" style={styles.title} accessibilityRole="header">
            Forgot Password
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Enter your email and we'll send you a 6-digit reset code
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
            accessibilityLabel="Email address"
          />

          <PrimaryButton
            title="Send Reset Code"
            onPress={handleSendCode}
            loading={loading}
            style={styles.button}
          />
        </View>

        <View style={styles.footer}>
          <ThemedText
            style={[styles.footerText, { color: theme.textSecondary }]}
          >
            Remember your password?{" "}
          </ThemedText>
          <ThemedText
            style={[styles.linkText, { color: theme.primary }]}
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
    width: 100,
    height: 100,
    borderRadius: 22,
    marginBottom: Spacing.xl,
  },
  title: {
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  subtitle: {
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
    fontSize: 14,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "600",
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: Spacing.md,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    fontSize: 22,
    fontWeight: "700",
  },
  errorText: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
});
