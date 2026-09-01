import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics-wrapper";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { GlassInput } from "@/components/GlassInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { getApiUrl } from "@/lib/query-client";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "auth_token";

async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(TOKEN_KEY);
  }
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

interface EmailSettings {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
}

export default function AdminEmailSettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  const [settings, setSettings] = useState<EmailSettings>({
    smtpHost: "",
    smtpPort: "587",
    smtpUser: "",
    smtpPass: "",
    fromEmail: "",
    fromName: "Maternal Mind",
  });
  const [testRecipient, setTestRecipient] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const token = await getToken();
      const baseUrl = getApiUrl();
      const res = await fetch(new URL("/api/admin/email-settings", baseUrl), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to load settings");
      }

      const data = await res.json();
      setSettings({
        smtpHost: data.smtpHost || "",
        smtpPort: data.smtpPort || "587",
        smtpUser: data.smtpUser || "",
        smtpPass: data.smtpPass || "",
        fromEmail: data.fromEmail || "",
        fromName: data.fromName || "Maternal Mind",
      });
      setHasChanges(false);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to load email settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateField = (field: keyof EmailSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (
      !settings.smtpHost ||
      !settings.smtpUser ||
      !settings.smtpPass ||
      !settings.fromEmail
    ) {
      Alert.alert(
        "Validation Error",
        "SMTP Host, Login, Password, and From Email are required.",
      );
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();
      const baseUrl = getApiUrl();
      const res = await fetch(new URL("/api/admin/email-settings", baseUrl), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("âœ… Saved", "Email settings saved successfully!");
      setHasChanges(false);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testRecipient) {
      Alert.alert("Required", "Please enter a test recipient email address.");
      return;
    }

    if (
      !settings.smtpHost ||
      !settings.smtpUser ||
      !settings.smtpPass ||
      !settings.fromEmail
    ) {
      Alert.alert(
        "Missing Config",
        "Please fill in all SMTP fields before testing.",
      );
      return;
    }

    setTesting(true);
    try {
      const token = await getToken();
      const baseUrl = getApiUrl();
      const res = await fetch(new URL("/api/admin/email-test", baseUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...settings,
          testRecipient,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "âœ… Test Successful!",
        `Test email sent to ${testRecipient}. Check your inbox!`,
      );
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "âŒ Test Failed",
        error.message || "Failed to send test email",
      );
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <BackgroundGradient>
        <View style={[styles.loadingContainer, { paddingTop: headerHeight }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText
            style={[styles.loadingText, { color: theme.textSecondary }]}
          >
            Loading settings...
          </ThemedText>
        </View>
      </BackgroundGradient>
    );
  }

  return (
    <BackgroundGradient>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Info Card */}
        <GlassCard style={styles.infoCard}>
          <View style={styles.infoContent}>
            <View
              style={[
                styles.infoIconContainer,
                { backgroundColor: `${theme.primary}20` },
              ]}
            >
              <Feather name="mail" size={24} color={theme.primary} />
            </View>
            <View style={styles.infoTextContainer}>
              <ThemedText type="h4" style={styles.infoTitle}>
                Brevo SMTP Configuration
              </ThemedText>
              <ThemedText
                style={[styles.infoSubtitle, { color: theme.textSecondary }]}
              >
                Configure your Brevo (Sendinblue) SMTP settings to enable email
                sending for verification, password reset, and support.
              </ThemedText>
            </View>
          </View>
        </GlassCard>

        {/* SMTP Settings Section */}
        <ThemedText style={[styles.sectionLabel, { color: theme.textMuted }]}>
          SMTP SERVER
        </ThemedText>
        <View style={styles.formSection}>
          <GlassInput
            label="SMTP Host"
            icon="server"
            value={settings.smtpHost}
            onChangeText={(v) => updateField("smtpHost", v)}
            placeholder="smtp-relay.brevo.com"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <GlassInput
            label="SMTP Port"
            icon="hash"
            value={settings.smtpPort}
            onChangeText={(v) => updateField("smtpPort", v)}
            placeholder="587"
            keyboardType="number-pad"
          />
        </View>

        <ThemedText style={[styles.sectionLabel, { color: theme.textMuted }]}>
          AUTHENTICATION
        </ThemedText>
        <View style={styles.formSection}>
          <GlassInput
            label="SMTP Login"
            icon="user"
            value={settings.smtpUser}
            onChangeText={(v) => updateField("smtpUser", v)}
            placeholder="your-brevo-login@email.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <GlassInput
            label="SMTP Password / API Key"
            icon="lock"
            value={settings.smtpPass}
            onChangeText={(v) => updateField("smtpPass", v)}
            placeholder="xsmtpsib-xxxxxxxxxxxx"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <ThemedText style={[styles.sectionLabel, { color: theme.textMuted }]}>
          SENDER INFO
        </ThemedText>
        <View style={styles.formSection}>
          <GlassInput
            label="From Email"
            icon="at-sign"
            value={settings.fromEmail}
            onChangeText={(v) => updateField("fromEmail", v)}
            placeholder="noreply@yourdomain.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <GlassInput
            label="From Name"
            icon="edit-3"
            value={settings.fromName}
            onChangeText={(v) => updateField("fromName", v)}
            placeholder="Maternal Mind"
          />
        </View>

        {/* Save Button */}
        <PrimaryButton
          title={saving ? "Saving..." : "Save Settings"}
          onPress={handleSave}
          disabled={saving || !hasChanges}
          style={[styles.saveButton, hasChanges && styles.saveButtonActive]}
        />

        {/* Divider */}
        <View
          style={[styles.divider, { backgroundColor: theme.glassBorder }]}
        />

        {/* Test Email Section */}
        <ThemedText style={[styles.sectionLabel, { color: theme.textMuted }]}>
          TEST EMAIL
        </ThemedText>
        <GlassCard style={styles.testCard}>
          <View style={styles.testContent}>
            <Feather
              name="send"
              size={20}
              color={theme.warning}
              style={styles.testIcon}
            />
            <ThemedText
              style={[styles.testDescription, { color: theme.textSecondary }]}
            >
              Send a test email to verify your SMTP configuration is working
              correctly. The current settings (including unsaved changes) will
              be used.
            </ThemedText>
          </View>
          <View style={styles.testInputContainer}>
            <GlassInput
              label="Recipient Email"
              icon="mail"
              value={testRecipient}
              onChangeText={setTestRecipient}
              placeholder="your-email@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </View>
          <PrimaryButton
            title={testing ? "Sending..." : "Send Test Email"}
            onPress={handleTestEmail}
            disabled={testing}
            variant="secondary"
            style={[styles.testButton, { borderColor: theme.warning }]}
          />
        </GlassCard>

        {/* Help Card */}
        <GlassCard
          style={[styles.helpCard, { backgroundColor: `${theme.info}10` }]}
        >
          <ThemedText type="h4" style={styles.helpTitle}>
            ðŸ“‹ How to get Brevo SMTP credentials
          </ThemedText>
          <View style={styles.helpSteps}>
            <ThemedText style={styles.helpStep}>
              1. Sign up at{" "}
              <ThemedText style={styles.helpLink}>brevo.com</ThemedText>
            </ThemedText>
            <ThemedText style={styles.helpStep}>
              2. Go to Settings â†’ SMTP & API
            </ThemedText>
            <ThemedText style={styles.helpStep}>
              3. Copy your SMTP server, port, and login
            </ThemedText>
            <ThemedText style={styles.helpStep}>
              4. Generate an SMTP key (use as password)
            </ThemedText>
            <ThemedText style={styles.helpStep}>
              5. Default host:{" "}
              <ThemedText style={styles.helpCode}>
                smtp-relay.brevo.com
              </ThemedText>
            </ThemedText>
            <ThemedText style={styles.helpStep}>
              6. Default port:{" "}
              <ThemedText style={styles.helpCode}>587</ThemedText>
            </ThemedText>
          </View>
        </GlassCard>
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
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: Spacing.md,
  },
  infoCard: {
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
  },
  infoContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    marginBottom: 4,
  },
  infoSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
    marginLeft: 4,
  },
  formSection: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  saveButton: {
    marginTop: Spacing.lg,
    opacity: 0.6,
  },
  saveButtonActive: {
    opacity: 1,
  },
  divider: {
    height: 1,
    marginVertical: Spacing["2xl"],
  },
  testCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  testContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  testIcon: {
    marginRight: Spacing.md,
    marginTop: 2,
  },
  testDescription: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  testInputContainer: {
    marginBottom: Spacing.md,
  },
  testButton: {},
  helpCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  helpTitle: {
    marginBottom: Spacing.md,
  },
  helpSteps: {
    gap: Spacing.sm,
  },
  helpStep: {
    fontSize: 14,
    lineHeight: 20,
  },
  helpLink: {
    fontWeight: "600",
  },
  helpCode: {
    fontWeight: "600",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
  },
});
