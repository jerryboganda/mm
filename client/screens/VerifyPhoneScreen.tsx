import React, { useState } from "react";
import { StyleSheet, View, Image, Alert } from "react-native";
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
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useTheme } from "@/hooks/useTheme";

type VerifyPhoneScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "VerifyPhone"
>;

export default function VerifyPhoneScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<VerifyPhoneScreenNavigationProp>();
  const { sendPhoneOtp, verifyPhoneOtp } = useAuth();
  const { theme } = useTheme();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const authTopPadding = Math.max(
    insets.top + Spacing["6xl"],
    headerHeight + Spacing["2xl"],
  );

  // If user entered login but needs phone verification, we might want to skip "phone" step if we already have it?
  // But typically for first time verification we ask for it.

  const handleSendOtp = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert("Error", "Please enter a valid phone number");
      return;
    }

    setLoading(true);
    try {
      await sendPhoneOtp(phoneNumber);
      setStep("otp");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      Alert.alert("Error", "Please enter a valid 6-digit code");
      return;
    }

    setLoading(true);
    try {
      await verifyPhoneOtp(code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Phone number verified successfully", [
        { text: "OK", onPress: () => navigation.navigate("Main") },
      ]);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Verification Failed", error.message || "Invalid code");
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
          <ThemedText type="h1" style={styles.title}>
            Verify Phone Number
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            {step === "phone"
              ? "We need to verify your phone number to secure your account."
              : `Enter the code sent to ${phoneNumber}`}
          </ThemedText>
        </View>

        <View style={styles.form}>
          {step === "phone" ? (
            <>
              <GlassInput
                label="Phone Number"
                icon="phone"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                placeholder="+1234567890"
              />
              <PrimaryButton
                title="Send Code"
                onPress={handleSendOtp}
                loading={loading}
                style={styles.button}
              />
            </>
          ) : (
            <>
              <GlassInput
                label="Verification Code"
                icon="key"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="123456"
              />
              <PrimaryButton
                title="Verify Phone"
                onPress={handleVerify}
                loading={loading}
                style={styles.button}
              />
              <PrimaryButton
                title="Change Number"
                onPress={() => setStep("phone")}
                variant="secondary"
                style={styles.resendButton}
                disabled={loading}
              />
            </>
          )}
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
    width: 100,
    height: 100,
    borderRadius: 22,
    marginBottom: Spacing["2xl"],
  },
  title: {
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
  },
  form: {
    flex: 1,
    gap: Spacing.md,
  },
  button: {
    marginTop: Spacing.xl,
  },
  resendButton: {
    marginTop: Spacing.sm,
  },
});
