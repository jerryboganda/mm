import React, { useState } from "react";
import { StyleSheet, View, Image, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
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
import { Colors, Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type LoginScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Login"
>;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

  React.useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      const { email: savedEmail } =
        await getSavedCredentials();
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

  return (
    <BackgroundGradient variant="auth">
      <KeyboardAwareScrollViewCompat
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing["5xl"],
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
          <ThemedText type="h1" style={styles.title}>
            Welcome Back
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Sign in to continue your learning journey
          </ThemedText>
        </View>

        <View style={styles.form}>
          <GlassInput
            label="Email"
            icon="mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email}
          />
          <GlassInput
            label="Password"
            icon="lock"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            error={errors.password}
          />

          <Pressable
            style={styles.rememberMeContainer}
            onPress={() => setRememberMe(!rememberMe)}
          >
            <View
              style={[
                styles.checkbox,
                rememberMe && styles.checkboxChecked,
                { borderColor: Colors.dark.glassBorder },
              ]}
            >
              {rememberMe && (
                <Ionicons name="checkmark" size={12} color="white" />
              )}
            </View>
            <ThemedText style={styles.rememberMeText}>Remember me</ThemedText>
          </Pressable>

          <Pressable
            style={styles.forgotPassword}
            onPress={() => navigation.navigate("ForgotPassword")}
          >
            <ThemedText style={styles.forgotPasswordText}>
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
        </View>

        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>
            Don't have an account?
          </ThemedText>
          <Pressable onPress={() => navigation.navigate("Register")}>
            <ThemedText style={styles.signUpLink}> Sign Up</ThemedText>
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
    marginBottom: Spacing["4xl"],
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: Spacing["2xl"],
  },
  title: {
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  subtitle: {
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
  form: {
    flex: 1,
  },
  rememberMeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  rememberMeText: {
    marginLeft: Spacing.sm,
    color: Colors.dark.textSecondary,
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
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: Spacing["2xl"],
  },
  forgotPasswordText: {
    color: Colors.dark.primary,
    fontSize: 14,
  },
  loginButton: {
    marginTop: Spacing.md,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing["3xl"],
  },
  footerText: {
    color: Colors.dark.textSecondary,
  },
  signUpLink: {
    color: Colors.dark.primary,
    fontWeight: "600",
  },
});
