import React, { useState, useEffect } from "react";
import { StyleSheet, View, Image, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassInput } from "@/components/GlassInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { getApiUrl } from "@/lib/query-client";
import { Colors, Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Feather } from "@expo/vector-icons";

type ResetPasswordScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "ResetPassword">;
type ResetPasswordScreenRouteProp = RouteProp<RootStackParamList, "ResetPassword">;

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ResetPasswordScreenNavigationProp>();
  const route = useRoute<ResetPasswordScreenRouteProp>();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [token, setToken] = useState("");

  useEffect(() => {
    const tokenFromRoute = route.params?.token;
    if (tokenFromRoute) {
      setToken(tokenFromRoute);
    } else {
      const url = Linking.useURL();
      if (url) {
        const parsed = Linking.parse(url);
        if (parsed.queryParams?.token) {
          setToken(parsed.queryParams.token as string);
        }
      }
    }
  }, [route.params]);

  const validate = () => {
    const newErrors: typeof errors = {};
    
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

  const handleSubmit = async () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!token) {
      Alert.alert("Error", "Invalid reset link. Please request a new password reset.");
      return;
    }

    setLoading(true);

    try {
      const baseUrl = getApiUrl();
      const response = await fetch(new URL("/api/auth/reset-password", baseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert("Error", data.message || "Failed to reset password");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: any) {
      Alert.alert("Error", "Network error. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <BackgroundGradient variant="auth">
        <View
          style={[
            styles.container,
            {
              paddingTop: insets.top + Spacing["4xl"],
              paddingBottom: insets.bottom + Spacing["3xl"],
            },
          ]}
        >
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Feather name="check-circle" size={48} color={Colors.primary} />
            </View>
            <ThemedText type="h2" style={styles.successTitle}>
              Password Reset!
            </ThemedText>
            <ThemedText style={styles.successMessage}>
              Your password has been successfully reset. You can now sign in with your new password.
            </ThemedText>
            <PrimaryButton
              title="Sign In"
              onPress={() => navigation.navigate("Login")}
              style={styles.backButton}
            />
          </View>
        </View>
      </BackgroundGradient>
    );
  }

  return (
    <BackgroundGradient variant="auth">
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing["4xl"],
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
            Reset Password
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Enter your new password below
          </ThemedText>
        </View>

        <View style={styles.form}>
          <GlassInput
            label="New Password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            placeholder="Enter new password"
            secureTextEntry
            icon="lock"
            error={errors.password}
          />

          <GlassInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
            }}
            placeholder="Confirm new password"
            secureTextEntry
            icon="lock"
            error={errors.confirmPassword}
          />

          <PrimaryButton
            title="Reset Password"
            onPress={handleSubmit}
            loading={loading}
            style={styles.button}
          />
        </View>

        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>
            Remember your password?{" "}
          </ThemedText>
          <ThemedText
            style={styles.linkText}
            onPress={() => navigation.navigate("Login")}
          >
            Sign In
          </ThemedText>
        </View>
      </KeyboardAwareScrollViewCompat>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: Spacing.xl,
    borderRadius: 16,
  },
  title: {
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    color: Colors.text.secondary,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
  },
  form: {
    marginBottom: Spacing["2xl"],
  },
  button: {
    marginTop: Spacing.lg,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    color: Colors.text.secondary,
    fontSize: 14,
  },
  linkText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  successContainer: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.glass.background,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  successTitle: {
    color: Colors.text.primary,
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  successMessage: {
    color: Colors.text.secondary,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 24,
    marginBottom: Spacing["2xl"],
  },
  backButton: {
    width: "100%",
  },
});
