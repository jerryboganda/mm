/**
 * Mandatory OTA update popup.
 *
 * Rendered near the app root (see client/App.tsx). When the self-hosted update
 * server reports a newer JS bundle, `useOtaUpdate().available` flips true and this
 * blocking, non-dismissible modal appears. Tapping "Update Now" downloads the
 * bundle and reloads the app into it.
 *
 * It is intentionally non-dismissible (no close button, no backdrop dismiss) to
 * satisfy the "always mandatory" update policy. It only ever appears in native
 * production builds because `useOtaUpdate()` is inert elsewhere.
 */
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { AppModalSurface } from "@/components/AppModalSurface";
import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useFeedback } from "@/lib/feedback";
import { useOtaUpdate } from "@/lib/updates";

export function UpdateRequiredModal() {
  const { theme } = useTheme();
  const feedback = useFeedback();
  const { available, phase, releaseNotes, error, applyUpdate } = useOtaUpdate();

  const isDownloading = phase === "downloading";

  // Announce the mandatory update with a notification haptic when it appears.
  useEffect(() => {
    if (available) {
      feedback.playHaptic("notification");
    }
  }, [available, feedback]);

  const buttonTitle = isDownloading
    ? "Updating…"
    : error
      ? "Try Again"
      : "Update Now";

  const footer = (
    <View style={styles.footer}>
      <PrimaryButton
        title={buttonTitle}
        onPress={applyUpdate}
        loading={isDownloading}
        icon="download"
        style={styles.button}
        testID="button-ota-update"
      />
    </View>
  );

  return (
    <AppModalSurface
      visible={available}
      variant="center"
      dismissible={false}
      showCloseButton={false}
      scrollable
      accessibilityLabel="Update required"
      footer={footer}
    >
      <View style={styles.iconContainer}>
        <LinearGradient
          colors={[theme.primary, theme.primaryDark]}
          style={styles.iconGradient}
        >
          <Feather name="download-cloud" size={32} color="#fff" />
        </LinearGradient>
      </View>

      <ThemedText type="h3" style={styles.title}>
        Update Required
      </ThemedText>

      <ThemedText
        style={[styles.description, { color: theme.textSecondary }]}
        accessibilityLiveRegion="polite"
      >
        {releaseNotes ??
          "A new version of Maternal Mind is available. Please update now to keep using the app with the latest content and fixes."}
      </ThemedText>

      {error ? (
        <View
          style={[
            styles.errorBox,
            {
              backgroundColor: theme.backgroundSecondary,
              borderColor: theme.glassBorder,
            },
          ]}
        >
          <Feather name="alert-triangle" size={18} color={theme.warning} />
          <ThemedText
            style={[styles.errorText, { color: theme.textSecondary }]}
          >
            Couldn&apos;t install the update. Please check your connection and
            try again.
          </ThemedText>
        </View>
      ) : (
        <View
          style={[
            styles.infoBox,
            {
              backgroundColor: theme.backgroundSecondary,
              borderColor: theme.glassBorder,
            },
          ]}
        >
          <Feather name="shield" size={18} color={theme.info} />
          <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
            The update installs in a few seconds. Your progress and data are
            safe.
          </ThemedText>
        </View>
      )}
    </AppModalSurface>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    marginBottom: Spacing.lg,
    alignItems: "center",
  },
  iconGradient: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  description: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    width: "100%",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    width: "100%",
  },
  errorText: {
    flex: 1,
    fontSize: 13,
  },
  footer: {
    width: "100%",
    alignItems: "center",
  },
  button: {
    width: "100%",
  },
});
