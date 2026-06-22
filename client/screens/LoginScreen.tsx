import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Image,
  Pressable,
  Alert,
  Linking,
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
  const [supportContact, setSupportContact] = useState({
    whatsappNumber: "",
    phoneNumber: "",
    supportEmail: "maternalmind.help@gmail.com",
    whatsappDefaultMessage: "Hello Support Team, I need help logging in.",
    whatsappEnabled: false,
    phoneEnabled: false,
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

  const openSupportContact = async () => {
    const message = encodeURIComponent(
      supportContact.whatsappDefaultMessage ||
        "Hello Support Team, I need help logging in.",
    );
    const whatsappNumber = supportContact.whatsappNumber.replace(/[^\d]/g, "");
    const options = [
      supportContact.whatsappEnabled && whatsappNumber
        ? `https://wa.me/${whatsappNumber}?text=${message}`
        : "",
      supportContact.phoneEnabled && supportContact.phoneNumber
        ? `tel:${supportContact.phoneNumber}`
        : "",
      supportContact.emailEnabled && supportContact.supportEmail
        ? `mailto:${supportContact.supportEmail}?subject=${encodeURIComponent(
            "Trouble logging in",
          )}&body=${message}`
        : "",
    ].filter((url): url is string => Boolean(url));

    for (const url of options) {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return;
      }
    }

    if (supportContact.supportEmail) {
      const mailtoUrl = `mailto:${supportContact.supportEmail}?subject=${encodeURIComponent(
        "Trouble logging in",
      )}&body=${message}`;
      Alert.alert(
        "Contact Support",
        `Please email ${supportContact.supportEmail} for login help.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Email Support",
            onPress: () => {
              Linking.openURL(mailtoUrl).catch(() => {
                Alert.alert(
                  "Contact Support",
                  `Please email ${supportContact.supportEmail} for login help.`,
                );
              });
            },
          },
        ],
      );
      return;
    }

    Alert.alert(
      "Contact Support",
      "Support contact is not configured yet.",
    );
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
});
