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
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

interface MaintenanceScreenProps {
  message?: string;
  estimatedTime?: string;
  onRefresh?: () => void;
}

export default function MaintenanceScreen({
  message = "We're currently performing scheduled maintenance to improve your experience.",
  estimatedTime,
  onRefresh,
}: MaintenanceScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRefresh?.();
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
              colors={[theme.primary, theme.primaryDark || theme.primary]}
              style={styles.iconGradient}
            >
              <Feather name="tool" size={48} color="#fff" />
            </LinearGradient>
          </View>

          <ThemedText type="h2" style={styles.title}>
            Under Maintenance
          </ThemedText>

          <ThemedText
            style={[styles.description, { color: theme.textSecondary }]}
          >
            {message}
          </ThemedText>

          {estimatedTime ? (
            <GlassCard style={styles.timeCard}>
              <View style={styles.timeContent}>
                <Feather name="clock" size={24} color={theme.primary} />
                <View style={styles.timeText}>
                  <ThemedText
                    style={[styles.timeLabel, { color: theme.textMuted }]}
                  >
                    Estimated Completion
                  </ThemedText>
                  <ThemedText
                    type="h4"
                    style={[styles.timeValue, { color: theme.primary }]}
                  >
                    {estimatedTime}
                  </ThemedText>
                </View>
              </View>
            </GlassCard>
          ) : null}

          <GlassCard style={styles.infoCard}>
            <ThemedText type="h4" style={styles.infoTitle}>
              What&apos;s Happening?
            </ThemedText>
            <View style={styles.infoList}>
              <View style={styles.infoItem}>
                <Feather name="server" size={16} color={theme.primary} />
                <ThemedText
                  style={[styles.infoText, { color: theme.textSecondary }]}
                >
                  Server upgrades and optimizations
                </ThemedText>
              </View>
              <View style={styles.infoItem}>
                <Feather name="database" size={16} color={theme.primary} />
                <ThemedText
                  style={[styles.infoText, { color: theme.textSecondary }]}
                >
                  Database maintenance for better performance
                </ThemedText>
              </View>
              <View style={styles.infoItem}>
                <Feather name="shield" size={16} color={theme.primary} />
                <ThemedText
                  style={[styles.infoText, { color: theme.textSecondary }]}
                >
                  Security updates to keep your data safe
                </ThemedText>
              </View>
            </View>
          </GlassCard>

          <GlassCard style={styles.noteCard}>
            <View style={styles.noteContent}>
              <Feather name="info" size={20} color={theme.info || theme.primary} />
              <ThemedText
                style={[styles.noteText, { color: theme.textSecondary }]}
              >
                Your progress and data are safe. We&apos;ll be back shortly!
              </ThemedText>
            </View>
          </GlassCard>

          {onRefresh ? (
            <PrimaryButton
              title="Check Status"
              onPress={handleRefresh}
              icon="refresh-cw"
              style={styles.refreshButton}
              testID="button-check-status"
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
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    lineHeight: 22,
  },
  timeCard: {
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  timeContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  timeText: {
    gap: Spacing.xs,
  },
  timeLabel: {
    fontSize: 12,
  },
  timeValue: {},
  infoCard: {
    width: "100%",
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  infoTitle: {
    marginBottom: Spacing.lg,
  },
  infoList: {
    gap: Spacing.md,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  noteCard: {
    width: "100%",
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  noteContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  refreshButton: {
    minWidth: 200,
  },
});
