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
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

export default function SecuritySettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await apiRequest("POST", "/api/auth/change-password", data);
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
        [{ text: "OK", onPress: () => logout() }]
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
      ]
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
          <ThemedText style={styles.sectionLabel}>CHANGE PASSWORD</ThemedText>

          <GlassCard style={styles.inputCard}>
            <ThemedText style={styles.inputLabel}>Current Password</ThemedText>
            <View style={styles.inputRow}>
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                style={styles.input}
                placeholder="Enter current password"
                placeholderTextColor={Colors.dark.textMuted}
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
                autoCorrect={false}
                testID="input-current-password"
              />
              <Feather
                name={showCurrentPassword ? "eye-off" : "eye"}
                size={20}
                color={Colors.dark.textMuted}
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              />
            </View>
          </GlassCard>

          <GlassCard style={styles.inputCard}>
            <ThemedText style={styles.inputLabel}>New Password</ThemedText>
            <View style={styles.inputRow}>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                style={styles.input}
                placeholder="Enter new password"
                placeholderTextColor={Colors.dark.textMuted}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                autoCorrect={false}
                testID="input-new-password"
              />
              <Feather
                name={showNewPassword ? "eye-off" : "eye"}
                size={20}
                color={Colors.dark.textMuted}
                onPress={() => setShowNewPassword(!showNewPassword)}
              />
            </View>
          </GlassCard>

          <GlassCard style={styles.inputCard}>
            <ThemedText style={styles.inputLabel}>Confirm New Password</ThemedText>
            <View style={styles.inputRow}>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor={Colors.dark.textMuted}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                testID="input-confirm-password"
              />
              <Feather
                name={showConfirmPassword ? "eye-off" : "eye"}
                size={20}
                color={Colors.dark.textMuted}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            </View>
          </GlassCard>

          <PrimaryButton
            title={changePasswordMutation.isPending ? "Changing..." : "Change Password"}
            onPress={handleChangePassword}
            disabled={changePasswordMutation.isPending}
            style={styles.button}
            testID="button-change-password"
          />
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>SESSION MANAGEMENT</ThemedText>

          <GlassCard style={styles.sessionCard}>
            <View style={styles.sessionRow}>
              <View style={styles.sessionIcon}>
                <Feather name="smartphone" size={20} color={Colors.dark.warning} />
              </View>
              <View style={styles.sessionContent}>
                <ThemedText style={styles.sessionTitle}>
                  Logout All Devices
                </ThemedText>
                <ThemedText style={styles.sessionSubtitle}>
                  Sign out from all devices including this one
                </ThemedText>
              </View>
            </View>
          </GlassCard>

          <PrimaryButton
            title={logoutAllMutation.isPending ? "Logging out..." : "Logout All Devices"}
            onPress={handleLogoutAll}
            variant="ghost"
            disabled={logoutAllMutation.isPending}
            style={styles.logoutButton}
            testID="button-logout-all"
          />
        </View>

        <View style={styles.infoSection}>
          <Feather name="info" size={16} color={Colors.dark.textMuted} />
          <ThemedText style={styles.infoText}>
            Keep your account secure by using a strong password and logging out of
            unused devices.
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
    letterSpacing: 1.5,
    color: Colors.dark.textMuted,
    marginBottom: Spacing.lg,
  },
  inputCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.sm,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.dark.text,
    padding: 0,
    fontFamily: "Inter_400Regular",
  },
  button: {
    marginTop: Spacing.md,
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
    backgroundColor: `${Colors.dark.warning}15`,
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
    color: Colors.dark.textSecondary,
  },
  logoutButton: {
    borderColor: Colors.dark.error,
    borderWidth: 1,
  },
  infoSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    backgroundColor: Colors.dark.glass,
    borderRadius: BorderRadius.md,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginLeft: Spacing.sm,
    lineHeight: 18,
  },
});
