import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface OfflineScreenProps {
  onRetry?: () => void;
}

export default function OfflineScreen({ onRetry }: OfflineScreenProps) {
  const insets = useSafeAreaInsets();

  const handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRetry?.();
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
              colors={[Colors.dark.textMuted, Colors.dark.textSecondary]}
              style={styles.iconGradient}
            >
              <Feather name="wifi-off" size={48} color="#fff" />
            </LinearGradient>
          </View>

          <ThemedText type="h2" style={styles.title}>
            No Internet Connection
          </ThemedText>

          <ThemedText style={styles.description}>
            It looks like you're offline. Please check your internet connection
            and try again.
          </ThemedText>

          <GlassCard style={styles.tipsCard}>
            <ThemedText type="h4" style={styles.tipsTitle}>
              Troubleshooting Tips
            </ThemedText>
            <View style={styles.tipsList}>
              <View style={styles.tipItem}>
                <Feather name="check" size={16} color={Colors.dark.primary} />
                <ThemedText style={styles.tipText}>
                  Check if Wi-Fi or mobile data is enabled
                </ThemedText>
              </View>
              <View style={styles.tipItem}>
                <Feather name="check" size={16} color={Colors.dark.primary} />
                <ThemedText style={styles.tipText}>
                  Move closer to your Wi-Fi router
                </ThemedText>
              </View>
              <View style={styles.tipItem}>
                <Feather name="check" size={16} color={Colors.dark.primary} />
                <ThemedText style={styles.tipText}>
                  Try toggling airplane mode on and off
                </ThemedText>
              </View>
              <View style={styles.tipItem}>
                <Feather name="check" size={16} color={Colors.dark.primary} />
                <ThemedText style={styles.tipText}>
                  Restart your device if the issue persists
                </ThemedText>
              </View>
            </View>
          </GlassCard>

          {onRetry ? (
            <PrimaryButton
              title="Try Again"
              onPress={handleRetry}
              icon="refresh-cw"
              style={styles.retryButton}
              testID="button-retry-connection"
            />
          ) : null}
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
    marginBottom: Spacing["2xl"],
    paddingHorizontal: Spacing.xl,
    lineHeight: 22,
  },
  tipsCard: {
    width: "100%",
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  tipsTitle: {
    marginBottom: Spacing.lg,
  },
  tipsList: {
    gap: Spacing.md,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
  retryButton: {
    minWidth: 200,
  },
});
