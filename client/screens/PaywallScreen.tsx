import React from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "@/lib/haptics-wrapper";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type PaywallScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

const premiumBenefits = [
  {
    icon: "book-open" as const,
    title: "Complete Textbook Access",
    description:
      "Unlock all OB-GYN chapters and topics with in-depth explanations",
  },
  {
    icon: "check-circle" as const,
    title: "Unlimited MCQ Practice",
    description:
      "Practice with thousands of questions across all difficulty levels",
  },
  {
    icon: "trending-up" as const,
    title: "Advanced Progress Tracking",
    description: "Detailed analytics and accuracy trends to guide your study",
  },
  {
    icon: "bookmark" as const,
    title: "Bookmarks & Notes",
    description:
      "Save important topics and add personal notes for quick reference",
  },
  {
    icon: "zap" as const,
    title: "Wrong Questions Review",
    description: "Focus on your weak areas with smart question retry mode",
  },
  {
    icon: "headphones" as const,
    title: "Priority Support",
    description:
      "Get faster responses from our support team when you need help",
  },
];

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<PaywallScreenNavigationProp>();
  const { theme } = useTheme();

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("Subscription");
  };

  return (
    <BackgroundGradient>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop:
              (headerHeight > 0 ? headerHeight : insets.top) + Spacing["2xl"],
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.crownContainer}>
            <LinearGradient
              colors={["#FFD700", "#FFA500"]}
              style={styles.crownGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Feather name="award" size={40} color="#fff" />
            </LinearGradient>
          </View>
          <ThemedText
            type="h1"
            style={[
              styles.title,
              { textShadowColor: `${theme.primary}66` }, // 40% opacity
            ]}
          >
            Go Premium
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Unlock the full power of Maternal Mind and accelerate your medical
            education
          </ThemedText>
        </View>

        <View style={styles.benefitsSection}>
          <ThemedText style={[styles.sectionLabel, { color: theme.primary }]}>
            PREMIUM BENEFITS
          </ThemedText>
          {premiumBenefits.map((benefit, index) => (
            <GlassCard key={index} style={styles.benefitCard}>
              <View style={styles.benefitIcon}>
                <LinearGradient
                  colors={[theme.primary, theme.primaryDark || theme.primary]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Feather name={benefit.icon} size={20} color="#fff" />
              </View>
              <View style={styles.benefitContent}>
                <ThemedText type="h4" style={styles.benefitTitle}>
                  {benefit.title}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.benefitDescription,
                    { color: theme.textSecondary },
                  ]}
                >
                  {benefit.description}
                </ThemedText>
              </View>
            </GlassCard>
          ))}
        </View>

        <View style={styles.ctaSection}>
          <PrimaryButton
            title="View Plans"
            onPress={handleContinue}
            icon="arrow-right"
            style={styles.ctaButton}
            testID="button-view-plans"
          />
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
  header: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  crownContainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
    paddingTop: Spacing.xs,
  },
  crownGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  subtitle: {
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
    lineHeight: 22,
  },
  benefitsSection: {
    marginBottom: Spacing["2xl"],
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: Spacing.lg,
  },
  benefitCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: Spacing.md,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    marginBottom: Spacing.xs,
    fontSize: 15,
  },
  benefitDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  ctaSection: {
    marginTop: Spacing.lg,
  },
  ctaButton: {
    marginBottom: Spacing.xl,
  },
  restoreRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  restoreLabel: {
    fontSize: 13,
    marginRight: Spacing.xs,
  },
  restoreLink: {
    fontSize: 13,
    fontWeight: "600",
  },
  subscribedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  successIcon: {
    marginBottom: Spacing.xl,
  },
  successTitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  successSubtitle: {
    textAlign: "center",
    marginBottom: Spacing["2xl"],
  },
  continueButton: {
    width: "100%",
  },
});
