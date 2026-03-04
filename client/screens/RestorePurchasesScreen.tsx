import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Animated, Easing } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "@/lib/haptics-wrapper";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { usePurchases } from "@/lib/purchases";
import { Colors, Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type RestorePurchasesScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

type RestoreStatus = "idle" | "restoring" | "success" | "not_found" | "error";

export default function RestorePurchasesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RestorePurchasesScreenNavigationProp>();
  const { restorePurchases } = usePurchases();
  const [status, setStatus] = useState<RestoreStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === "restoring") {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    }
  }, [status]);

  useEffect(() => {
    if (status === "success" || status === "not_found" || status === "error") {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    }
  }, [status]);

  const handleRestore = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStatus("restoring");
    setErrorMessage(null);

    try {
      const success = await restorePurchases();
      if (success) {
        setStatus("success");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setStatus("not_found");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "Failed to restore purchases");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (status === "success") {
      navigation.reset({
        index: 0,
        routes: [{ name: "Main" }],
      });
    } else {
      navigation.goBack();
    }
  };

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const renderContent = () => {
    switch (status) {
      case "restoring":
        return (
          <View style={styles.statusContainer}>
            <Animated.View
              style={[styles.iconCircle, { transform: [{ rotate: spin }] }]}
            >
              <Feather name="loader" size={40} color={Colors.dark.primary} />
            </Animated.View>
            <ThemedText type="h3" style={styles.statusTitle}>
              Restoring Purchases...
            </ThemedText>
            <ThemedText style={styles.statusSubtitle}>
              Please wait while we check your purchase history
            </ThemedText>
          </View>
        );

      case "success":
        return (
          <View style={styles.statusContainer}>
            <Animated.View
              style={[
                styles.successCircle,
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              <LinearGradient
                colors={[Colors.dark.success, "#16a34a"]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Feather name="check" size={40} color="#fff" />
            </Animated.View>
            <ThemedText type="h3" style={styles.statusTitle}>
              Subscription Restored!
            </ThemedText>
            <ThemedText style={styles.statusSubtitle}>
              Your premium access has been successfully restored
            </ThemedText>
            <PrimaryButton
              title="Continue"
              onPress={handleContinue}
              style={styles.continueButton}
            />
          </View>
        );

      case "not_found":
        return (
          <View style={styles.statusContainer}>
            <Animated.View
              style={[
                styles.warningCircle,
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              <Feather name="search" size={40} color={Colors.dark.warning} />
            </Animated.View>
            <ThemedText type="h3" style={styles.statusTitle}>
              No Purchases Found
            </ThemedText>
            <ThemedText style={styles.statusSubtitle}>
              We couldn&apos;t find any previous purchases associated with your
              account
            </ThemedText>
            <GlassCard style={styles.helpCard}>
              <Feather name="info" size={18} color={Colors.dark.info} />
              <ThemedText style={styles.helpText}>
                Make sure you&apos;re signed in with the same account you used
                for the original purchase
              </ThemedText>
            </GlassCard>
            <PrimaryButton
              title="Subscribe Now"
              onPress={() => navigation.navigate("Subscription")}
              style={styles.subscribeButton}
            />
            <ThemedText style={styles.goBackLink} onPress={handleContinue}>
              Go Back
            </ThemedText>
          </View>
        );

      case "error":
        return (
          <View style={styles.statusContainer}>
            <Animated.View
              style={[
                styles.errorCircle,
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              <Feather name="x" size={40} color={Colors.dark.error} />
            </Animated.View>
            <ThemedText type="h3" style={styles.statusTitle}>
              Restore Failed
            </ThemedText>
            <ThemedText style={styles.statusSubtitle}>
              {errorMessage || "An error occurred while restoring purchases"}
            </ThemedText>
            <PrimaryButton
              title="Try Again"
              onPress={handleRestore}
              icon="refresh-cw"
              style={styles.retryButton}
            />
            <ThemedText style={styles.goBackLink} onPress={handleContinue}>
              Go Back
            </ThemedText>
          </View>
        );

      default:
        return (
          <View style={styles.idleContainer}>
            <View style={styles.iconCircle}>
              <Feather
                name="refresh-cw"
                size={40}
                color={Colors.dark.primary}
              />
            </View>
            <ThemedText type="h2" style={styles.title}>
              Restore Purchases
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              If you&apos;ve previously subscribed to Maternal Mind Premium, you
              can restore your subscription here
            </ThemedText>

            <GlassCard style={styles.infoCard}>
              <ThemedText style={styles.infoTitle}>When to restore:</ThemedText>
              <View style={styles.infoRow}>
                <Feather
                  name="smartphone"
                  size={16}
                  color={Colors.dark.textSecondary}
                />
                <ThemedText style={styles.infoText}>
                  Switching to a new device
                </ThemedText>
              </View>
              <View style={styles.infoRow}>
                <Feather
                  name="refresh-cw"
                  size={16}
                  color={Colors.dark.textSecondary}
                />
                <ThemedText style={styles.infoText}>
                  Reinstalled the app
                </ThemedText>
              </View>
              <View style={styles.infoRow}>
                <Feather
                  name="user"
                  size={16}
                  color={Colors.dark.textSecondary}
                />
                <ThemedText style={styles.infoText}>
                  Signed in with a different account
                </ThemedText>
              </View>
            </GlassCard>

            <PrimaryButton
              title="Restore Purchases"
              onPress={handleRestore}
              icon="download"
              style={styles.restoreButton}
              testID="button-restore"
            />
            <ThemedText
              style={styles.goBackLink}
              onPress={() => navigation.goBack()}
            >
              Cancel
            </ThemedText>
          </View>
        );
    }
  };

  return (
    <BackgroundGradient>
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + Spacing["3xl"],
            paddingBottom: insets.bottom + Spacing["2xl"],
          },
        ]}
      >
        {renderContent()}
      </View>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  idleContainer: {
    flex: 1,
    alignItems: "center",
  },
  statusContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${Colors.dark.primary}15`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
    overflow: "hidden",
  },
  warningCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${Colors.dark.warning}15`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  errorCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${Colors.dark.error}15`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  subtitle: {
    textAlign: "center",
    color: Colors.dark.textSecondary,
    marginBottom: Spacing["2xl"],
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  statusTitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  statusSubtitle: {
    textAlign: "center",
    color: Colors.dark.textSecondary,
    marginBottom: Spacing["2xl"],
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  infoCard: {
    width: "100%",
    padding: Spacing.lg,
    marginBottom: Spacing["2xl"],
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  infoText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginLeft: Spacing.md,
  },
  helpCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    marginBottom: Spacing["2xl"],
  },
  helpText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginLeft: Spacing.sm,
    lineHeight: 18,
  },
  restoreButton: {
    width: "100%",
    marginBottom: Spacing.lg,
  },
  continueButton: {
    minWidth: 200,
    marginTop: Spacing.lg,
  },
  subscribeButton: {
    minWidth: 200,
    marginBottom: Spacing.lg,
  },
  retryButton: {
    minWidth: 200,
    marginBottom: Spacing.lg,
  },
  goBackLink: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: "center",
    padding: Spacing.md,
  },
});
