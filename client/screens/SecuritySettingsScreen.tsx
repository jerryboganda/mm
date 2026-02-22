import React, { useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useMutation } from "@tanstack/react-query";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

export default function SecuritySettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { logout } = useAuth();
  const { theme } = useTheme();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const changePasswordMutation = useMutation({
    mutationFn: async (data: {
      currentPassword: string;
      newPassword: string;
    }) => {
      const response = await apiRequest(
        "POST",
        "/api/auth/change-password",
        data,
      );
      return response.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Your password has been changed successfully.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error.message || "Failed to change password");
    },
  });

  const logoutAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/logout-all");
      return response.json();
    },
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Sessions Terminated",
        "You have been logged out of all devices.",
        [{ text: "OK", onPress: () => logout() }],
      );
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error.message || "Failed to logout all devices");
    },
  });

  const handleChangePassword = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert("Error", "New password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match");
      return;
    }

    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleLogoutAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      "Logout All Devices?",
      "This will sign you out of all devices including this one. You will need to log in again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout All",
          style: "destructive",
          onPress: () => logoutAllMutation.mutate(),
        },
      ],
    );
  };

  return (
    <BackgroundGradient>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <ThemedText style={[styles.sectionLabel, { color: theme.primary }]}>
            CHANGE PASSWORD
          </ThemedText>

          <GlassCard style={styles.inputCard}>
            <ThemedText
              style={[styles.inputLabel, { color: theme.textSecondary }]}
            >
              Current Password
            </ThemedText>
            <View style={styles.inputRow}>
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter current password"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
                autoCorrect={false}
                testID="input-current-password"
              />
              <Feather
                name={showCurrentPassword ? "eye-off" : "eye"}
                size={20}
                color={theme.textMuted}
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              />
            </View>
          </GlassCard>

          <GlassCard style={styles.inputCard}>
            <ThemedText
              style={[styles.inputLabel, { color: theme.textSecondary }]}
            >
              New Password
            </ThemedText>
            <View style={styles.inputRow}>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter new password"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                autoCorrect={false}
                testID="input-new-password"
              />
              <Feather
                name={showNewPassword ? "eye-off" : "eye"}
                size={20}
                color={theme.textMuted}
                onPress={() => setShowNewPassword(!showNewPassword)}
              />
            </View>
          </GlassCard>

          <GlassCard style={styles.inputCard}>
            <ThemedText
              style={[styles.inputLabel, { color: theme.textSecondary }]}
            >
              Confirm New Password
            </ThemedText>
            <View style={styles.inputRow}>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                style={[styles.input, { color: theme.text }]}
                placeholder="Confirm new password"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                testID="input-confirm-password"
              />
              <Feather
                name={showConfirmPassword ? "eye-off" : "eye"}
                size={20}
                color={theme.textMuted}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            </View>
          </GlassCard>

          <PrimaryButton
            title={
              changePasswordMutation.isPending
                ? "Changing..."
                : "Change Password"
            }
            onPress={handleChangePassword}
            disabled={changePasswordMutation.isPending}
            style={styles.button}
            testID="button-change-password"
          />
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionLabel, { color: theme.primary }]}>
            SESSION MANAGEMENT
          </ThemedText>

          <GlassCard style={styles.sessionCard}>
            <View style={styles.sessionRow}>
              <View
                style={[
                  styles.sessionIcon,
                  { backgroundColor: `${theme.warning}15` },
                ]}
              >
                <Feather
                  name="smartphone"
                  size={20}
                  color={theme.warning}
                />
              </View>
              <View style={styles.sessionContent}>
                <ThemedText style={styles.sessionTitle}>
                  Logout All Devices
                </ThemedText>
                <ThemedText
                  style={[styles.sessionSubtitle, { color: theme.textSecondary }]}
                >
                  Sign out from all devices including this one
                </ThemedText>
              </View>
            </View>
          </GlassCard>

          <PrimaryButton
            title={
              logoutAllMutation.isPending
                ? "Logging out..."
                : "Logout All Devices"
            }
            onPress={handleLogoutAll}
            variant="ghost"
            disabled={logoutAllMutation.isPending}
            style={{ ...styles.logoutButton, borderColor: theme.error }}
            testID="button-logout-all"
          />
        </View>

        <View
          style={[
            styles.infoSection,
            { backgroundColor: theme.glass },
          ]}
        >
          <Feather name="info" size={16} color={theme.textMuted} />
          <ThemedText style={[styles.infoText, { color: theme.textMuted }]}>
            Keep your account secure by using a strong password and logging out
            of unused devices.
          </ThemedText>
        </View>
      </ScrollView>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: Spacing.lg,
  },
  inputCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    fontSize: 16,
    padding: 0,
    fontFamily: "Inter_400Regular",
  },
  button: {
    marginTop: Spacing.xl,
  },
  sessionCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sessionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  sessionContent: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 2,
  },
  sessionSubtitle: {
    fontSize: 13,
  },
  logoutButton: {
    borderWidth: 1,
  },
  infoSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    marginLeft: Spacing.sm,
    lineHeight: 18,
  },
});
