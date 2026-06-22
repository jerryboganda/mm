import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Animated,
  Easing,
  Pressable,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics-wrapper";
import { useQuery } from "@tanstack/react-query";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type PurchaseFailedScreenRouteProp = RouteProp<
  RootStackParamList,
  "PurchaseFailed"
>;
type PurchaseFailedScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

const commonIssues = [
  {
    icon: "credit-card" as const,
    title: "Payment Declined",
    description: "Check your payment method details and try again",
  },
  {
    icon: "wifi-off" as const,
    title: "Connection Issue",
    description: "Ensure you have a stable internet connection",
  },
  {
    icon: "alert-circle" as const,
    title: "App Store Issue",
    description: "Try signing out and back into your App Store account",
  },
];

const DEFAULT_SUPPORT_EMAIL = "maternalmind.help@gmail.com";

export default function PurchaseFailedScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<PurchaseFailedScreenNavigationProp>();
  const route = useRoute<PurchaseFailedScreenRouteProp>();
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { theme } = useTheme();
  const { data: supportContactSettings } = useQuery<{ supportEmail: string }>({
    queryKey: ["/api/support/contact"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/support/contact");
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: true,
  });
  const supportEmail =
    supportContactSettings?.supportEmail || DEFAULT_SUPPORT_EMAIL;

  const errorMessage =
    route.params?.errorMessage || "Something went wrong with your purchase";

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    const shake = Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]);

    shake.start();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      delay: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);

  const handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.goBack();
  };

  const handleContact = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`mailto:${supportEmail}?subject=Purchase%20Issue`);
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.reset({
      index: 0,
      routes: [{ name: "Main" }],
    });
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
        <Animated.View
          style={[
            styles.iconContainer,
            { transform: [{ translateX: shakeAnim }] },
          ]}
        >
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: `${theme.error}15` },
            ]}
          >
            <Feather name="x" size={48} color={theme.error} />
          </View>
        </Animated.View>

        <ThemedText type="h2" style={styles.title}>
          Purchase Failed
        </ThemedText>

        <View
          style={[
            styles.errorBox,
            { backgroundColor: `${theme.error}15` },
          ]}
        >
          <Feather name="alert-triangle" size={16} color={theme.error} />
          <ThemedText style={[styles.errorText, { color: theme.error }]}>
            {errorMessage}
          </ThemedText>
        </View>

        <Animated.View style={[styles.issuesSection, { opacity: fadeAnim }]}>
          <ThemedText style={[styles.sectionLabel, { color: theme.primary }]}>
            POSSIBLE SOLUTIONS
          </ThemedText>
          {commonIssues.map((issue, index) => (
            <GlassCard key={index} style={styles.issueCard}>
              <View
                style={[
                  styles.issueIcon,
                  { backgroundColor: `${theme.warning}15` },
                ]}
              >
                <Feather
                  name={issue.icon}
                  size={18}
                  color={theme.warning}
                />
              </View>
              <View style={styles.issueContent}>
                <ThemedText style={styles.issueTitle}>{issue.title}</ThemedText>
                <ThemedText
                  style={[
                    styles.issueDescription,
                    { color: theme.textSecondary },
                  ]}
                >
                  {issue.description}
                </ThemedText>
              </View>
            </GlassCard>
          ))}
        </Animated.View>

        <Animated.View style={[styles.ctaSection, { opacity: fadeAnim }]}>
          <PrimaryButton
            title="Try Again"
            onPress={handleRetry}
            icon="refresh-cw"
            style={styles.retryButton}
            testID="button-retry-purchase"
          />

          <Pressable onPress={handleContact} style={styles.helpButton}>
            <Feather name="mail" size={18} color={theme.primary} />
            <ThemedText
              style={[styles.helpText, { color: theme.primary }]}
            >
              Contact Support
            </ThemedText>
          </Pressable>

          <Pressable onPress={handleCancel} style={styles.cancelButton}>
            <ThemedText
              style={[styles.cancelText, { color: theme.textMuted }]}
            >
              Cancel
            </ThemedText>
          </Pressable>
        </Animated.View>
      </View>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  iconContainer: {
    alignSelf: "center",
    marginBottom: Spacing.xl,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing["2xl"],
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    marginLeft: Spacing.sm,
  },
  issuesSection: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: Spacing.lg,
  },
  issueCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  issueIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  issueContent: {
    flex: 1,
  },
  issueTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  issueDescription: {
    fontSize: 13,
  },
  ctaSection: {
    marginTop: Spacing["2xl"],
  },
  retryButton: {
    marginBottom: Spacing.lg,
  },
  helpButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  helpText: {
    fontSize: 15,
    fontWeight: "500",
    marginLeft: Spacing.sm,
  },
  cancelButton: {
    alignItems: "center",
    padding: Spacing.md,
  },
  cancelText: {
    fontSize: 14,
  },
});
