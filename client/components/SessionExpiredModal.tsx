import React from "react";
import {
  StyleSheet,
  View,
  Modal,
  Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";

import { GlassCard } from "@/components/GlassCard";
import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface SessionExpiredModalProps {
  visible: boolean;
  onLogin: () => void;
  onDismiss?: () => void;
}

export function SessionExpiredModal({
  visible,
  onLogin,
  onDismiss,
}: SessionExpiredModalProps) {
  const handleLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLogin();
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <BlurView intensity={20} tint="dark" style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleDismiss}>
          <View style={styles.centeredView}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <GlassCard style={styles.modalContent}>
                <View style={styles.iconContainer}>
                  <LinearGradient
                    colors={[Colors.dark.warning, "#f59e0b"]}
                    style={styles.iconGradient}
                  >
                    <Feather name="clock" size={32} color="#fff" />
                  </LinearGradient>
                </View>

                <ThemedText type="h3" style={styles.title}>
                  Session Expired
                </ThemedText>

                <ThemedText style={styles.description}>
                  Your session has expired for security reasons. Please log in again to continue using Maternal Mind.
                </ThemedText>

                <View style={styles.infoBox}>
                  <Feather name="shield" size={18} color={Colors.dark.info} />
                  <ThemedText style={styles.infoText}>
                    Your progress and data are safely saved.
                  </ThemedText>
                </View>

                <View style={styles.buttonContainer}>
                  <PrimaryButton
                    title="Log In Again"
                    onPress={handleLogin}
                    icon="log-in"
                    style={styles.loginButton}
                    testID="button-session-login"
                  />
                  {onDismiss ? (
                    <Pressable
                      style={styles.dismissButton}
                      onPress={handleDismiss}
                    >
                      <ThemedText style={styles.dismissText}>
                        Dismiss
                      </ThemedText>
                    </Pressable>
                  ) : null}
                </View>
              </GlassCard>
            </Pressable>
          </View>
        </Pressable>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    padding: Spacing.xl,
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: Spacing.lg,
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
    color: Colors.dark.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.dark.glass,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
    width: "100%",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  buttonContainer: {
    width: "100%",
    alignItems: "center",
    gap: Spacing.md,
  },
  loginButton: {
    width: "100%",
  },
  dismissButton: {
    paddingVertical: Spacing.sm,
  },
  dismissText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
});
