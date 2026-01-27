import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  features: string[];
  popular?: boolean;
  savings?: string;
}

const plans: Plan[] = [
  {
    id: "monthly",
    name: "Monthly",
    price: 9.99,
    period: "/month",
    features: [
      "Access all textbook content",
      "Unlimited MCQ practice",
      "Progress tracking",
      "Bookmarks & notes",
    ],
  },
  {
    id: "quarterly",
    name: "Quarterly",
    price: 24.99,
    period: "/3 months",
    popular: true,
    savings: "Save 17%",
    features: [
      "Access all textbook content",
      "Unlimited MCQ practice",
      "Progress tracking",
      "Bookmarks & notes",
      "Priority support",
    ],
  },
  {
    id: "yearly",
    name: "Yearly",
    price: 79.99,
    period: "/year",
    savings: "Save 33%",
    features: [
      "Access all textbook content",
      "Unlimited MCQ practice",
      "Progress tracking",
      "Bookmarks & notes",
      "Priority support",
      "Early access to new content",
    ],
  },
];

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const [selectedPlan, setSelectedPlan] = useState<string>("quarterly");
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 2000);
  };

  const selectedPlanData = plans.find((p) => p.id === selectedPlan);

  return (
    <BackgroundGradient>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
        ]}
      >
        <View style={styles.header}>
          <ThemedText type="h2" style={styles.title}>
            Choose Your Plan
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Unlock full access to all OB-GYN learning materials
          </ThemedText>
        </View>

        <View style={styles.plansContainer}>
          {plans.map((plan) => (
            <Pressable
              key={plan.id}
              onPress={() => {
                setSelectedPlan(plan.id);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[
                styles.planCard,
                selectedPlan === plan.id && styles.planCardSelected,
                plan.popular && styles.planCardPopular,
              ]}
            >
              {plan.popular ? (
                <View style={styles.popularBadge}>
                  <ThemedText style={styles.popularText}>BEST VALUE</ThemedText>
                </View>
              ) : null}

              <View style={styles.planHeader}>
                <View
                  style={[
                    styles.radioOuter,
                    selectedPlan === plan.id && styles.radioOuterSelected,
                  ]}
                >
                  {selectedPlan === plan.id ? (
                    <View style={styles.radioInner} />
                  ) : null}
                </View>
                <View style={styles.planInfo}>
                  <ThemedText type="h4" style={styles.planName}>
                    {plan.name}
                  </ThemedText>
                  {plan.savings ? (
                    <View style={styles.savingsBadge}>
                      <ThemedText style={styles.savingsText}>{plan.savings}</ThemedText>
                    </View>
                  ) : null}
                </View>
                <View style={styles.priceContainer}>
                  <ThemedText type="h3" style={styles.price}>
                    ${plan.price}
                  </ThemedText>
                  <ThemedText style={styles.period}>{plan.period}</ThemedText>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.featuresSection}>
          <ThemedText style={styles.sectionLabel}>INCLUDED FEATURES</ThemedText>
          {selectedPlanData?.features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Feather name="check" size={16} color={Colors.dark.success} />
              </View>
              <ThemedText style={styles.featureText}>{feature}</ThemedText>
            </View>
          ))}
        </View>

        <PrimaryButton
          title={`Subscribe for $${selectedPlanData?.price}${selectedPlanData?.period}`}
          onPress={handleSubscribe}
          loading={loading}
          style={styles.subscribeButton}
          testID="button-subscribe"
        />

        <Pressable style={styles.restoreButton}>
          <ThemedText style={styles.restoreText}>Restore Purchases</ThemedText>
        </Pressable>

        <ThemedText style={styles.legalText}>
          Subscription will auto-renew unless cancelled at least 24 hours before
          the end of the current period. By subscribing, you agree to our Terms
          of Service and Privacy Policy.
        </ThemedText>
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
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    color: Colors.dark.textSecondary,
  },
  plansContainer: {
    marginBottom: Spacing["2xl"],
  },
  planCard: {
    backgroundColor: Colors.dark.glass,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    position: "relative",
    overflow: "hidden",
  },
  planCardSelected: {
    borderColor: Colors.dark.primary,
    backgroundColor: "rgba(17,164,212,0.08)",
  },
  planCardPopular: {
    borderColor: Colors.dark.primary,
  },
  popularBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderBottomLeftRadius: BorderRadius.md,
  },
  popularText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.dark.glassBorder,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  radioOuterSelected: {
    borderColor: Colors.dark.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.dark.primary,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    marginBottom: 0,
  },
  savingsBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(34,197,94,0.2)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.xs,
  },
  savingsText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.dark.success,
  },
  priceContainer: {
    alignItems: "flex-end",
  },
  price: {
    color: Colors.dark.primary,
  },
  period: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  featuresSection: {
    marginBottom: Spacing["2xl"],
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 1.5,
    color: Colors.dark.textMuted,
    marginBottom: Spacing.lg,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  featureIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(34,197,94,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  featureText: {
    flex: 1,
    fontSize: 15,
  },
  subscribeButton: {
    marginBottom: Spacing.lg,
  },
  restoreButton: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  restoreText: {
    color: Colors.dark.primary,
    fontSize: 14,
  },
  legalText: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    textAlign: "center",
    lineHeight: 16,
  },
});
