import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Image,
  Pressable,
  Alert,
  Linking,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import * as Haptics from "@/lib/haptics-wrapper";
import { Ionicons } from "@expo/vector-icons";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassInput } from "@/components/GlassInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import {
  useAuth,
  saveCredentials,
  getSavedCredentials,
  clearSavedCredentials,
} from "@/lib/auth";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";

type LoginScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Login"
>;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { login } = useAuth();
  const { theme, isDark } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanLoginButtonText, setScanLoginButtonText] =
    useState("Scan to login");
  const [scanLoginEnabled, setScanLoginEnabled] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportContact, setSupportContact] = useState({
    whatsappNumber: "+923360830836",
    phoneNumber: "+923360830836",
    supportEmail: "maternalmind.help@gmail.com",
    websiteUrl: "https://maternalmind.com.pk/",
    whatsappDefaultMessage: "Hello Support Team, I need help logging in.",
    whatsappEnabled: true,
    phoneEnabled: true,
    emailEnabled: true,
  });
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const authTopPadding = Math.max(
    insets.top + Spacing["6xl"],
    headerHeight + Spacing["2xl"],
  );

  React.useEffect(() => {
    loadCredentials();
    loadLoginSettings();
  }, []);

  const loadCredentials = async () => {
    try {
      const { email: savedEmail } = await getSavedCredentials();
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch (error) {
      console.error("Failed to load credentials:", error);
    }
  };

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }
    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);
    try {
      await login(email, password);

      if (rememberMe) {
        await saveCredentials(email, password);
      } else {
        await clearSavedCredentials();
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      if (error.code === "EMAIL_NOT_VERIFIED") {
        navigation.navigate("VerifyEmail", { email });
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Login Failed",
        error.message || "Please check your credentials and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadLoginSettings = async () => {
    try {
      const baseUrl = getApiUrl();
      const [scanResponse, supportResponse] = await Promise.all([
        fetch(new URL("/api/auth/scan-login-settings", baseUrl)),
        fetch(new URL("/api/support/public-contact", baseUrl)),
      ]);

      if (scanResponse.ok) {
        const scanSettings = await scanResponse.json();
        setScanLoginEnabled(Boolean(scanSettings.enabled));
        setScanLoginButtonText(scanSettings.buttonText || "Scan to login");
      }

      if (supportResponse.ok) {
        const supportSettings = await supportResponse.json();
        setSupportContact((prev) => ({
          ...prev,
          ...supportSettings,
          whatsappDefaultMessage:
            supportSettings.whatsappDefaultMessage ||
            "Hello Support Team, I need help logging in.",
        }));
      }
    } catch (error) {
      console.error("Failed to load login settings:", error);
    }
  };

  const openSupportContact = () => {
    Haptics.selectionAsync();
    setShowSupportModal(true);
  };

  const handleOpenWhatsApp = async () => {
    const rawNumber = supportContact.whatsappNumber || "+923360830836";
    const cleanNumber = rawNumber.replace(/[^\d]/g, "");
    const msg = encodeURIComponent(
      supportContact.whatsappDefaultMessage ||
        "Hello Support Team, I need help logging in.",
    );
    const url = `https://wa.me/${cleanNumber}?text=${msg}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "WhatsApp Helpline",
        `WhatsApp helpline number: ${rawNumber}`,
      );
    }
  };

  const handleOpenEmail = async () => {
    const emailAddr =
      supportContact.supportEmail || "maternalmind.help@gmail.com";
    const msg = encodeURIComponent(
      supportContact.whatsappDefaultMessage ||
        "Hello Support Team, I need help logging in.",
    );
    const url = `mailto:${emailAddr}?subject=${encodeURIComponent(
      "Trouble logging in",
    )}&body=${msg}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Email Support", `Please email us at: ${emailAddr}`);
    }
  };

  const handleOpenWebsite = async () => {
    const webUrl =
      (supportContact as any).websiteUrl || "https://maternalmind.com.pk/";
    try {
      await Linking.openURL(webUrl);
    } catch {
      Alert.alert("Official Website", `Visit our website at: ${webUrl}`);
    }
  };

  return (
    <BackgroundGradient variant="auth">
      <KeyboardAwareScrollViewCompat
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: authTopPadding,
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
        ]}
      >
        <View style={styles.header}>
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <ThemedText type="h1" style={styles.title} accessibilityRole="header">
            Welcome Back
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Sign in to continue your learning journey
          </ThemedText>
        </View>

        <View
          style={[
            styles.formCard,
            {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.03)"
                : "rgba(255,255,255,0.6)",
              borderColor: isDark
                ? "rgba(255,255,255,0.06)"
                : "rgba(0,0,0,0.05)",
            },
          ]}
        >
          <GlassInput
            label="Email"
            icon="mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email}
            accessibilityLabel="Email address"
          />
          <GlassInput
            label="Password"
            icon="lock"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            error={errors.password}
            accessibilityLabel="Password"
          />

          <Pressable
            style={styles.rememberMeContainer}
            onPress={() => setRememberMe(!rememberMe)}
            accessibilityRole="checkbox"
            accessibilityLabel="Remember me"
            accessibilityState={{ checked: rememberMe }}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: rememberMe ? theme.primary : theme.glassBorder,
                  backgroundColor: rememberMe ? theme.primary : "transparent",
                },
              ]}
            >
              {rememberMe && (
                <Ionicons name="checkmark" size={12} color="white" />
              )}
            </View>
            <ThemedText
              style={[styles.rememberMeText, { color: theme.textSecondary }]}
            >
              Remember me
            </ThemedText>
          </Pressable>

          <Pressable
            style={styles.forgotPassword}
            onPress={() => navigation.navigate("ForgotPassword")}
            accessibilityRole="link"
            accessibilityLabel="Forgot Password?"
          >
            <ThemedText
              style={[
                styles.forgotPasswordText,
                { color: `${theme.primary}CC` },
              ]}
            >
              Forgot Password?
            </ThemedText>
          </Pressable>

          <PrimaryButton
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            icon="arrow-right"
            style={styles.loginButton}
            testID="button-login"
          />

          {scanLoginEnabled ? (
            <Pressable
              style={[
                styles.scanLoginButton,
                { borderColor: theme.glassBorder },
              ]}
              onPress={() => navigation.navigate("ScanLogin")}
              accessibilityRole="button"
              accessibilityLabel={scanLoginButtonText}
            >
              <Ionicons
                name="qr-code-outline"
                size={18}
                color={theme.primary}
              />
              <ThemedText
                style={[styles.scanLoginText, { color: theme.primary }]}
              >
                {scanLoginButtonText}
              </ThemedText>
            </Pressable>
          ) : null}

          <Pressable
            style={styles.contactSupport}
            onPress={openSupportContact}
            accessibilityRole="link"
            accessibilityLabel="Contact us for trouble logging in"
          >
            <Ionicons
              name="help-circle-outline"
              size={16}
              color={`${theme.primary}CC`}
            />
            <ThemedText
              style={[
                styles.contactSupportText,
                { color: `${theme.primary}CC` },
              ]}
            >
              Contact us for trouble logging in
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <ThemedText
            style={[styles.footerText, { color: theme.textSecondary }]}
          >
            Don&apos;t have an account?
          </ThemedText>
          <Pressable
            onPress={() => navigation.navigate("Register")}
            accessibilityRole="link"
            accessibilityLabel="Sign Up"
          >
            <ThemedText style={[styles.signUpLink, { color: theme.primary }]}>
              {" "}
              Sign Up
            </ThemedText>
          </Pressable>
        </View>
      </KeyboardAwareScrollViewCompat>

      <Modal
        visible={showSupportModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSupportModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSupportModal(false)}
        >
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.15)"
                  : "rgba(0, 0, 0, 0.1)",
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalBadgeContainer}>
              <View
                style={[
                  styles.modalBadge,
                  { backgroundColor: `${theme.primary}20` },
                ]}
              >
                <Ionicons
                  name="headset-outline"
                  size={28}
                  color={theme.primary}
                />
              </View>
            </View>

            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
              Login Support & Helpline
            </ThemedText>
            <ThemedText
              style={[styles.modalSubtitle, { color: theme.textSecondary }]}
            >
              Need help accessing your account? Reach out to us directly through
              any of our support channels.
            </ThemedText>

            <Pressable
              style={styles.whatsappCard}
              onPress={handleOpenWhatsApp}
              accessibilityRole="button"
              accessibilityLabel="Contact via WhatsApp Helpline"
            >
              <View style={styles.contactIconBgWhatsapp}>
                <Ionicons name="logo-whatsapp" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.contactTextContainer}>
                <ThemedText style={styles.whatsappCardTitle}>
                  WhatsApp Helpline
                </ThemedText>
                <ThemedText style={styles.whatsappCardSub}>
                  {supportContact.whatsappNumber || "+923360830836"} • Direct
                  Chat
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </Pressable>

            <Pressable
              style={[
                styles.contactOptionCard,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.03)",
                  borderColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.08)",
                },
              ]}
              onPress={handleOpenWebsite}
              accessibilityRole="button"
              accessibilityLabel="Visit Official Website"
            >
              <View
                style={[
                  styles.contactIconBg,
                  { backgroundColor: `${theme.primary}20` },
                ]}
              >
                <Ionicons
                  name="globe-outline"
                  size={22}
                  color={theme.primary}
                />
              </View>
              <View style={styles.contactTextContainer}>
                <ThemedText
                  style={[styles.optionCardTitle, { color: theme.text }]}
                >
                  Official Website
                </ThemedText>
                <ThemedText
                  style={[styles.optionCardSub, { color: theme.textSecondary }]}
                >
                  {(supportContact as any).websiteUrl ||
                    "https://maternalmind.com.pk/"}
                </ThemedText>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={theme.textSecondary}
              />
            </Pressable>

            <Pressable
              style={[
                styles.contactOptionCard,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.03)",
                  borderColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.08)",
                },
              ]}
              onPress={handleOpenEmail}
              accessibilityRole="button"
              accessibilityLabel="Send email support"
            >
              <View
                style={[
                  styles.contactIconBg,
                  { backgroundColor: "rgba(56, 189, 248, 0.2)" },
                ]}
              >
                <Ionicons name="mail-outline" size={22} color="#38BDF8" />
              </View>
              <View style={styles.contactTextContainer}>
                <ThemedText
                  style={[styles.optionCardTitle, { color: theme.text }]}
                >
                  Email Support
                </ThemedText>
                <ThemedText
                  style={[styles.optionCardSub, { color: theme.textSecondary }]}
                >
                  {supportContact.supportEmail || "maternalmind.help@gmail.com"}
                </ThemedText>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={theme.textSecondary}
              />
            </Pressable>

            <Pressable
              style={[
                styles.modalCloseButton,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.06)",
                },
              ]}
              onPress={() => setShowSupportModal(false)}
            >
              <ThemedText
                style={[styles.modalCloseText, { color: theme.text }]}
              >
                Close
              </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing["2xl"],
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 24,
    marginBottom: Spacing.xl,
  },
  title: {
    marginBottom: Spacing.sm,
    textAlign: "center",
    textShadowColor: "rgba(17,164,212,0.4)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
  },
  formCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.xl,
  },
  rememberMeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  rememberMeText: {
    marginLeft: Spacing.sm,
    fontSize: 14,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  checkboxChecked: {
    // themed inline
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: Spacing["2xl"],
  },
  forgotPasswordText: {
    fontSize: 14,
  },
  loginButton: {
    marginTop: Spacing.md,
  },
  scanLoginButton: {
    marginTop: Spacing.md,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  scanLoginText: {
    fontSize: 15,
    fontWeight: "700",
  },
  contactSupport: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.lg,
  },
  contactSupportText: {
    fontSize: 13,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing["3xl"],
  },
  footerText: {},
  signUpLink: {
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  modalBadgeContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  modalBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 20,
  },
  whatsappCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#25D366",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 3,
    shadowColor: "#25D366",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  contactIconBgWhatsapp: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  whatsappCardTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  whatsappCardSub: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 12,
    marginTop: 2,
  },
  contactOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  contactIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  contactTextContainer: {
    flex: 1,
  },
  optionCardTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  optionCardSub: {
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseButton: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  modalCloseText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
