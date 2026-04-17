import React, { useState } from "react";
import { StyleSheet, View, Image, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import * as Haptics from "@/lib/haptics-wrapper";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassInput } from "@/components/GlassInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/lib/auth";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type RegisterScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Register"
>;

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const { register } = useAuth();
  const { theme, isDark } = useTheme();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const authTopPadding = Math.max(
    insets.top + Spacing["6xl"],
    headerHeight + Spacing["2xl"],
  );

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!name) {
      newErrors.name = "Name is required";
    }
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
    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);
    try {
      const result = await register(name, email, password);
      if (
        result &&
        "requiresEmailVerification" in result &&
        result.requiresEmailVerification
      ) {
        navigation.navigate("VerifyEmail", { email });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Registration Failed", error.message || "Please try again.");
    } finally {
      setLoading(false);
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
            Create Account
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Start your OB-GYN learning journey
          </ThemedText>
        </View>

        <View
          style={[
            styles.form,
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
            label="Full Name"
            icon="user"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            error={errors.name}
            accessibilityLabel="Full Name"
          />
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
            autoComplete="new-password"
            error={errors.password}
            accessibilityLabel="Password"
          />
          <GlassInput
            label="Confirm Password"
            icon="lock"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            error={errors.confirmPassword}
            accessibilityLabel="Confirm Password"
          />

          <PrimaryButton
            title="Create Account"
            onPress={handleRegister}
            loading={loading}
            icon="arrow-right"
            style={styles.registerButton}
            testID="button-register"
          />
        </View>

        <View style={styles.footer}>
          <ThemedText
            style={[styles.footerText, { color: theme.textSecondary }]}
          >
            Already have an account?
          </ThemedText>
          <Pressable
            onPress={() => navigation.navigate("Login")}
            accessibilityRole="link"
            accessibilityLabel="Sign In"
          >
            <ThemedText style={[styles.signInLink, { color: theme.primary }]}>
              {" "}
              Sign In
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
    borderRadius: 22,
    marginBottom: Spacing["2xl"],
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
  form: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.xl,
  },
  registerButton: {
    marginTop: Spacing.xl,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing["2xl"],
  },
  footerText: {},
  signInLink: {
    fontWeight: "600",
  },
});
