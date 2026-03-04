import React, { useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics-wrapper";
import { PurchasesPackage } from "react-native-purchases";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { usePurchases } from "@/lib/purchases";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type SubscriptionScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

interface FallbackPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  features: string[];
  popular?: boolean;
  savings?: string;
}

const fallbackPlans: FallbackPlan[] = [
  {
    id: "monthly",
    name: "Monthly",
    price: "$9.99",
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
    price: "$24.99",
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
    price: "$79.99",
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

const getFeatures = (packageId: string): string[] => {
  if (packageId.includes("yearly") || packageId.includes("annual")) {
    return [
      "Access all textbook content",
      "Unlimited MCQ practice",
      "Progress tracking",
      "Bookmarks & notes",
      "Priority support",
      "Early access to new content",
    ];
  }
  if (packageId.includes("quarterly") || packageId.includes("3month")) {
    return [
      "Access all textbook content",
      "Unlimited MCQ practice",
      "Progress tracking",
      "Bookmarks & notes",
      "Priority support",
    ];
  }
  return [
    "Access all textbook content",
    "Unlimited MCQ practice",
    "Progress tracking",
    "Bookmarks & notes",
  ];
};

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<SubscriptionScreenNavigationProp>();
  const { packages, loading, isSubscribed, purchase, restorePurchases } =
    usePurchases();
  const { theme } = useTheme();

  const [selectedPackage, setSelectedPackage] =
    useState<PurchasesPackage | null>(null);
  const [selectedFallback, setSelectedFallback] = useState<string>("quarterly");
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const hasRevenueCatPackages = packages.length > 0;

  const handlePurchase = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (hasRevenueCatPackages && selectedPackage) {
      setPurchasing(true);
      try {
        const success = await purchase(selectedPackage);
        setPurchasing(false);

        if (success) {
          navigation.replace("PurchaseSuccess");
        }
      } catch (error: any) {
        setPurchasing(false);
        navigation.navigate("PurchaseFailed", {
          errorMessage: error.message || "Purchase failed. Please try again.",
        });
      }
    } else {
      setPurchasing(true);
      setTimeout(() => {
        setPurchasing(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }, 1500);
    }
  };

  const handleRestore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("RestorePurchases");
  };

  if (isSubscribed) {
    return (
      <BackgroundGradient>
        <View
          style={[
            styles.subscribedContainer,
            {
              paddingTop: headerHeight + Spacing["2xl"],
              paddingBottom: insets.bottom + Spacing["3xl"],
            },
          ]}
        >
          <View style={styles.successIcon}>
            <Feather name="check-circle" size={64} color={theme.success} />
          </View>
          <ThemedText type="h2" style={styles.successTitle}>
            You&apos;re Subscribed!
          </ThemedText>
          <ThemedText style={styles.successSubtitle}>
            Enjoy full access to all Maternal Mind content and features.
          </ThemedText>
          <PrimaryButton
            title="Continue Learning"
            onPress={() => navigation.goBack()}
            style={styles.continueButton}
          />
        </View>
      </BackgroundGradient>
    );
  }

  if (loading) {
    return (
      <BackgroundGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText
            style={[styles.loadingText, { color: theme.textSecondary }]}
          >
            Loading subscription options...
          </ThemedText>
        </View>
      </BackgroundGradient>
    );
  }

  const selectedPlanFeatures =
    hasRevenueCatPackages && selectedPackage
      ? getFeatures(selectedPackage.identifier)
      : fallbackPlans.find((p) => p.id === selectedFallback)?.features || [];

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
          <ThemedText
            style={[styles.subtitle, { color: theme.textSecondary }]}
          >
            Unlock full access to all OB-GYN learning materials
          </ThemedText>
        </View>

        <View style={styles.plansContainer}>
          {hasRevenueCatPackages
            ? packages.map((pkg) => {
              const isSelected =
                selectedPackage?.identifier === pkg.identifier;
              const isPopular =
                pkg.identifier.includes("quarterly") ||
                pkg.packageType === "THREE_MONTH";

              return (
                <Pressable
                  key={pkg.identifier}
                  onPress={() => {
                    setSelectedPackage(pkg);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[
                    styles.planCard,
                    {
                      backgroundColor: theme.glass,
                      borderColor: theme.glassBorder,
                    },
                    isSelected && {
                      borderColor: theme.primary,
                      backgroundColor: `${theme.primary}15`,
                    },
                    isPopular && {
                      borderColor: theme.primary,
                    },
                  ]}
                >
                  {isPopular ? (
                    <View
                      style={[
                        styles.popularBadge,
                        { backgroundColor: theme.primary },
                      ]}
                    >
                      <ThemedText style={styles.popularText}>
                        BEST VALUE
                      </ThemedText>
                    </View>
                  ) : null}

                  <View style={styles.planHeader}>
                    <View
                      style={[
                        styles.radioOuter,
                        { borderColor: theme.glassBorder },
                        isSelected && { borderColor: theme.primary },
                      ]}
                    >
                      {isSelected ? (
                        <View
                          style={[
                            styles.radioInner,
                            { backgroundColor: theme.primary },
                          ]}
                        />
                      ) : null}
                    </View>
                    <View style={styles.planInfo}>
                      <ThemedText type="h4" style={styles.planName}>
                        {pkg.product.title}
                      </ThemedText>
                      {pkg.product.description ? (
                        <ThemedText
                          style={[
                            styles.planDescription,
                            { color: theme.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {pkg.product.description}
                        </ThemedText>
                      ) : null}
                    </View>
                    <View style={styles.priceContainer}>
                      <ThemedText
                        type="h3"
                        style={[styles.price, { color: theme.primary }]}
                      >
                        {pkg.product.priceString}
                      </ThemedText>
                    </View>
                  </View>
                </Pressable>
              );
            })
            : fallbackPlans.map((plan) => (
              <Pressable
                key={plan.id}
                onPress={() => {
                  setSelectedFallback(plan.id);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: theme.glass,
                    borderColor: theme.glassBorder,
                  },
                  selectedFallback === plan.id && {
                    borderColor: theme.primary,
                    backgroundColor: `${theme.primary}15`,
                  },
                  plan.popular && {
                    borderColor: theme.primary,
                  },
                ]}
              >
                {plan.popular ? (
                  <View
                    style={[
                      styles.popularBadge,
                      { backgroundColor: theme.primary },
                    ]}
                  >
                    <ThemedText style={styles.popularText}>
                      BEST VALUE
                    </ThemedText>
                  </View>
                ) : null}

                <View style={styles.planHeader}>
                  <View
                    style={[
                      styles.radioOuter,
                      { borderColor: theme.glassBorder },
                      selectedFallback === plan.id && {
                        borderColor: theme.primary,
                      },
                    ]}
                  >
                    {selectedFallback === plan.id ? (
                      <View
                        style={[
                          styles.radioInner,
                          { backgroundColor: theme.primary },
                        ]}
                      />
                    ) : null}
                  </View>
                  <View style={styles.planInfo}>
                    <ThemedText type="h4" style={styles.planName}>
                      {plan.name}
                    </ThemedText>
                    {plan.savings ? (
                      <View
                        style={[
                          styles.savingsBadge,
                          { backgroundColor: `${theme.success}33` },
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.savingsText,
                            { color: theme.success },
                          ]}
                        >
                          {plan.savings}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.priceContainer}>
                    <ThemedText
                      type="h3"
                      style={[styles.price, { color: theme.primary }]}
                    >
                      {plan.price}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.period,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {plan.period}
                    </ThemedText>
                  </View>
                </View>
              </Pressable>
            ))}
        </View>

        {!hasRevenueCatPackages && Platform.OS !== "web" ? (
          <View
            style={[
              styles.previewNotice,
              { backgroundColor: `${theme.primary}1A` },
            ]}
          >
            <Feather name="info" size={16} color={theme.primary} />
            <ThemedText
              style={[styles.previewText, { color: theme.primary }]}
            >
              Running in preview mode. Configure RevenueCat to enable real
              purchases.
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.featuresSection}>
          <ThemedText style={[styles.sectionLabel, { color: theme.primary }]}>
            INCLUDED FEATURES
          </ThemedText>
          {selectedPlanFeatures.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View
                style={[
                  styles.featureIcon,
                  { backgroundColor: `${theme.success}26` },
                ]}
              >
                <Feather name="check" size={16} color={theme.success} />
              </View>
              <ThemedText style={styles.featureText}>{feature}</ThemedText>
            </View>
          ))}
        </View>

        <PrimaryButton
          title={
            hasRevenueCatPackages && selectedPackage
              ? `Subscribe for ${selectedPackage.product.priceString}`
              : "Subscribe Now"
          }
          onPress={handlePurchase}
          loading={purchasing}
          disabled={hasRevenueCatPackages && !selectedPackage}
          style={styles.subscribeButton}
          testID="button-subscribe"
        />

        <Pressable
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={restoring}
        >
          {restoring ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <ThemedText
              style={[styles.restoreText, { color: theme.primary }]}
            >
              Restore Purchases
            </ThemedText>
          )}
        </Pressable>

        <ThemedText style={[styles.legalText, { color: theme.textMuted }]}>
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
  },
  plansContainer: {
    marginBottom: Spacing.xl,
  },
  planCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    position: "relative",
    overflow: "hidden",
  },
  popularBadge: {
    position: "absolute",
    top: 0,
    right: 0,
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
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    marginBottom: 0,
  },
  planDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  savingsBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.xs,
  },
  savingsText: {
    fontSize: 11,
    fontWeight: "600",
  },
  priceContainer: {
    alignItems: "flex-end",
  },
  price: {},
  period: {
    fontSize: 12,
  },
  previewNotice: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  previewText: {
    flex: 1,
    fontSize: 13,
    marginLeft: Spacing.sm,
  },
  featuresSection: {
    marginBottom: Spacing["2xl"],
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
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
    height: 24,
    justifyContent: "center",
  },
  restoreText: {
    fontSize: 14,
  },
  legalText: {
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: Spacing.lg,
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
