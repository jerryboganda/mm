import React, { useState } from "react";
import { reloadAppAsync } from "expo";
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  Text,
  Modal,
  Platform,
  StatusBar,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows, Fonts } from "@/constants/theme";

export type ErrorFallbackProps = {
  error: Error;
  resetError: () => void;
};

/**
 * Safe area insets fallback — the ErrorBoundary wraps SafeAreaProvider so we
 * cannot use `useSafeAreaInsets`. Use platform-specific static values instead.
 */
const SAFE_TOP =
  Platform.OS === "ios" ? 59 : (StatusBar.currentHeight ?? 0) + Spacing.lg;
const SAFE_BOTTOM = Platform.OS === "ios" ? 34 : Spacing.lg;

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const { theme, isDark } = useTheme();
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleTryAgain = () => {
    resetError();
  };

  const handleGoHome = async () => {
    try {
      await reloadAppAsync();
    } catch (restartError) {
      console.error("Failed to restart app:", restartError);
      // Fall back to resetting the boundary if app reload fails
      resetError();
    }
  };

  const formatErrorDetails = (): string => {
    let details = `Error: ${error.message}\n\n`;
    if (error.stack) {
      details += `Stack Trace:\n${error.stack}`;
    }
    return details;
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      {/* Background gradient (inline, since BackgroundGradient may itself throw) */}
      <LinearGradient
        colors={
          isDark
            ? [theme.backgroundRoot, "#0d1519", theme.backgroundRoot]
            : [theme.backgroundRoot, "#F0F2F5", theme.backgroundRoot]
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Dev-only detail inspector button */}
      {__DEV__ ? (
        <Pressable
          onPress={() => setIsModalVisible(true)}
          style={({ pressed }) => [
            styles.topButton,
            {
              top: SAFE_TOP,
              backgroundColor: theme.glass,
              borderColor: theme.glassBorder,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          accessibilityLabel="View error details"
          accessibilityRole="button"
        >
          <Feather name="code" size={20} color={theme.textSecondary} />
        </Pressable>
      ) : null}

      <View
        style={[
          styles.container,
          { paddingTop: SAFE_TOP + Spacing.xl, paddingBottom: SAFE_BOTTOM },
        ]}
      >
        <View style={styles.content}>
          {/* Warning icon */}
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={[theme.warning, "#d97706"]}
              style={styles.iconGradient}
            >
              <Ionicons name="warning" size={48} color="#fff" />
            </LinearGradient>
          </View>

          {/* Title */}
          <ThemedText type="h2" style={styles.title}>
            Something went wrong
          </ThemedText>

          {/* Subtitle */}
          <ThemedText
            style={[styles.description, { color: theme.textSecondary }]}
          >
            An unexpected error occurred. You can try again or restart the app.
          </ThemedText>

          {/* Error message (dev only) */}
          {__DEV__ ? (
            <Pressable
              onPress={() => setIsModalVisible(true)}
              style={[
                styles.errorCard,
                {
                  backgroundColor: theme.glass,
                  borderColor: theme.glassBorder,
                },
              ]}
            >
              <Ionicons
                name="bug-outline"
                size={18}
                color={theme.error}
                style={styles.errorIcon}
              />
              <Text
                style={[
                  styles.errorMessage,
                  {
                    color: theme.error,
                    fontFamily: Fonts?.mono || "monospace",
                  },
                ]}
                numberOfLines={4}
              >
                {error.message}
              </Text>
            </Pressable>
          ) : null}

          {/* Action buttons */}
          <View style={styles.buttonContainer}>
            {/* Try Again — primary action */}
            <Pressable
              onPress={handleTryAgain}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <LinearGradient
                colors={[theme.primary, theme.primaryDark]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Feather
                name="refresh-cw"
                size={20}
                color="#fff"
                style={styles.buttonIcon}
              />
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </Pressable>

            {/* Go Home — secondary action (reloads the app) */}
            <Pressable
              onPress={handleGoHome}
              style={({ pressed }) => [
                styles.secondaryButton,
                {
                  backgroundColor: theme.glassMedium,
                  borderColor: theme.glassBorderLight,
                  opacity: pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Go home"
            >
              <Ionicons
                name="home-outline"
                size={20}
                color={theme.text}
                style={styles.buttonIcon}
              />
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                Go Home
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Dev-only full error details modal */}
      {__DEV__ ? (
        <Modal
          visible={isModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContainer,
                { backgroundColor: theme.backgroundElevated },
              ]}
            >
              <View
                style={[
                  styles.modalHeader,
                  { borderBottomColor: theme.glassBorder },
                ]}
              >
                <ThemedText type="h3" style={styles.modalTitle}>
                  Error Details
                </ThemedText>
                <Pressable
                  onPress={() => setIsModalVisible(false)}
                  style={({ pressed }) => [
                    styles.closeButton,
                    { opacity: pressed ? 0.5 : 1 },
                  ]}
                  accessibilityLabel="Close error details"
                  accessibilityRole="button"
                >
                  <Feather name="x" size={24} color={theme.text} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator
              >
                <View
                  style={[
                    styles.errorDetailContainer,
                    {
                      backgroundColor: theme.glass,
                      borderColor: theme.glassBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.errorDetailText,
                      {
                        color: theme.text,
                        fontFamily: Fonts?.mono || "monospace",
                      },
                    ]}
                    selectable
                  >
                    {formatErrorDetails()}
                  </Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topButton: {
    position: "absolute",
    right: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },

  /* Icon */
  iconContainer: {
    marginBottom: Spacing.xl,
    ...Shadows.glowError,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius["3xl"],
    alignItems: "center",
    justifyContent: "center",
  },

  /* Typography */
  title: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  description: {
    textAlign: "center",
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    fontSize: 16,
    lineHeight: 24,
  },

  /* Dev error card */
  errorCard: {
    width: "100%",
    maxWidth: 600,
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  errorIcon: {
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  errorMessage: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },

  /* Buttons */
  buttonContainer: {
    width: "100%",
    maxWidth: 600,
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  primaryButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...Shadows.glow,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
    fontFamily: "Inter",
  },
  secondaryButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
    fontFamily: "Inter",
  },
  buttonIcon: {
    marginRight: Spacing.sm,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    width: "100%",
    height: "90%",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontWeight: "600",
  },
  closeButton: {
    padding: Spacing.xs,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: Spacing.lg,
  },
  errorDetailContainer: {
    width: "100%",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
    padding: Spacing.lg,
  },
  errorDetailText: {
    fontSize: 12,
    lineHeight: 18,
    width: "100%",
  },
});
