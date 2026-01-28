import React from "react";
import {
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface ErrorScreenProps {
  title?: string;
  message?: string;
  errorCode?: string;
  onRetry?: () => void;
  onGoBack?: () => void;
}

export default function ErrorScreen({
  title = "Something Went Wrong",
  message = "We encountered an unexpected error. Please try again.",
  errorCode,
  onRetry,
  onGoBack,
}: ErrorScreenProps) {
  const insets = useSafeAreaInsets();

  const handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRetry?.();
  };

  const handleGoBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onGoBack?.();
  };

  return (
    <BackgroundGradient>
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + Spacing["4xl"],
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
        ]}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={[Colors.dark.error, "#dc2626"]}
              style={styles.iconGradient}
            >
              <Feather name="alert-circle" size={48} color="#fff" />
            </LinearGradient>
          </View>

          <ThemedText type="h2" style={styles.title}>
            {title}
          </ThemedText>

          <ThemedText style={styles.description}>
            {message}
          </ThemedText>

          {errorCode ? (
            <GlassCard style={styles.errorCodeCard}>
              <View style={styles.errorCodeContent}>
                <ThemedText style={styles.errorCodeLabel}>Error Code</ThemedText>
                <ThemedText style={styles.errorCode}>{errorCode}</ThemedText>
              </View>
            </GlassCard>
          ) : null}

          <GlassCard style={styles.helpCard}>
            <View style={styles.helpContent}>
              <Feather name="info" size={20} color={Colors.dark.info} />
              <ThemedText style={styles.helpText}>
                If this problem persists, please contact our support team with the error details above.
              </ThemedText>
            </View>
          </GlassCard>

          <View style={styles.buttonContainer}>
            {onRetry ? (
              <PrimaryButton
                title="Try Again"
                onPress={handleRetry}
                icon="refresh-cw"
                style={styles.button}
                testID="button-retry"
              />
            ) : null}
            {onGoBack ? (
              <PrimaryButton
                title="Go Back"
                onPress={handleGoBack}
                icon="arrow-left"
                variant="secondary"
                style={styles.button}
                testID="button-go-back"
              />
            ) : null}
          </View>
        </View>
      </View>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    marginBottom: Spacing.xl,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius["3xl"],
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  description: {
    textAlign: "center",
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    lineHeight: 22,
  },
  errorCodeCard: {
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  errorCodeContent: {
    alignItems: "center",
  },
  errorCodeLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginBottom: Spacing.xs,
  },
  errorCode: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.error,
    fontFamily: "monospace",
  },
  helpCard: {
    width: "100%",
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  helpContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  helpText: {
    flex: 1,
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
  buttonContainer: {
    width: "100%",
    gap: Spacing.md,
  },
  button: {
    width: "100%",
  },
});
