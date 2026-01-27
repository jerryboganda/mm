import React, { useState, useEffect } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GlassCard } from "@/components/GlassCard";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";

type EmailVerificationScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "EmailVerification"
>;
type EmailVerificationScreenRouteProp = RouteProp<RootStackParamList, "EmailVerification">;

export default function EmailVerificationScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<EmailVerificationScreenNavigationProp>();
  const route = useRoute<EmailVerificationScreenRouteProp>();
  const { email } = route.params || { email: "" };

  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResendEmail = async () => {
    if (countdown > 0) return;

    setResendLoading(true);
    try {
      await apiRequest("POST", "/api/auth/resend-verification", { email });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResendSuccess(true);
      setCountdown(60);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setResendLoading(false);
    }
  };

  const handleOpenEmail = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.dark.backgroundRoot, "#0a1518", Colors.dark.backgroundRoot]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + Spacing["3xl"],
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <View style={styles.mainContent}>
          <View style={styles.iconContainer}>
            <View style={styles.iconRing}>
              <Feather name="mail" size={64} color={Colors.dark.primary} />
            </View>
            <View style={styles.checkBadge}>
              <Feather name="check" size={16} color={Colors.dark.backgroundRoot} />
            </View>
          </View>

          <ThemedText type="h2" style={styles.title}>
            Verify Your Email
          </ThemedText>
          <ThemedText style={styles.description}>
            We've sent a verification link to
          </ThemedText>
          <ThemedText style={styles.email}>{email}</ThemedText>
          <ThemedText style={styles.description}>
            Please check your inbox and click the link to verify your account.
          </ThemedText>

          <GlassCard style={styles.tipsCard}>
            <View style={styles.tipItem}>
              <Feather name="inbox" size={18} color={Colors.dark.primary} />
              <ThemedText style={styles.tipText}>
                Check your spam or junk folder
              </ThemedText>
            </View>
            <View style={styles.tipItem}>
              <Feather name="clock" size={18} color={Colors.dark.warning} />
              <ThemedText style={styles.tipText}>
                Link expires in 24 hours
              </ThemedText>
            </View>
            <View style={styles.tipItem}>
              <Feather name="refresh-cw" size={18} color={Colors.dark.success} />
              <ThemedText style={styles.tipText}>
                Didn't receive? Resend below
              </ThemedText>
            </View>
          </GlassCard>

          {resendSuccess ? (
            <View style={styles.successBanner}>
              <Feather name="check-circle" size={20} color={Colors.dark.success} />
              <ThemedText style={styles.successText}>
                Verification email sent!
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.buttonSection}>
          <PrimaryButton
            title={
              countdown > 0
                ? `Resend in ${countdown}s`
                : "Resend Verification Email"
            }
            onPress={handleResendEmail}
            loading={resendLoading}
            disabled={countdown > 0}
            variant={countdown > 0 ? "ghost" : "secondary"}
            icon={
              countdown === 0 ? (
                <Feather name="mail" size={20} color={Colors.dark.primary} />
              ) : undefined
            }
            style={styles.resendButton}
            testID="button-resend-verification"
          />
          <PrimaryButton
            title="Continue to Sign In"
            onPress={handleContinue}
            style={styles.continueButton}
            testID="button-continue-login"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: "space-between",
  },
  mainContent: {
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: Spacing["2xl"],
    position: "relative",
  },
  iconRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(17,164,212,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(17,164,212,0.3)",
  },
  checkBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.success,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: Colors.dark.backgroundRoot,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  description: {
    textAlign: "center",
    fontSize: 16,
    lineHeight: 24,
    color: Colors.dark.textSecondary,
  },
  email: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.primary,
    marginVertical: Spacing.sm,
  },
  tipsCard: {
    width: "100%",
    padding: Spacing.lg,
    marginTop: Spacing["2xl"],
    gap: Spacing.md,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  tipText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: "rgba(34,197,94,0.15)",
    borderRadius: BorderRadius.md,
  },
  successText: {
    color: Colors.dark.success,
    fontSize: 14,
    fontWeight: "500",
  },
  buttonSection: {
    gap: Spacing.md,
  },
  resendButton: {
    width: "100%",
  },
  continueButton: {
    width: "100%",
  },
});
