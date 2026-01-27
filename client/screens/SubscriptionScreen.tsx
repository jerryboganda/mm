import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Pressable, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { PurchasesPackage } from "react-native-purchases";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { usePurchases } from "@/lib/purchases";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

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
  const navigation = useNavigation();
  const { packages, loading, isSubscribed, purchase, restorePurchases } = usePurchases();
  
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [selectedFallback, setSelectedFallback] = useState<string>("quarterly");
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const hasRevenueCatPackages = packages.length > 0;

  const handlePurchase = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (hasRevenueCatPackages && selectedPackage) {
      setPurchasing(true);
      const success = await purchase(selectedPackage);
      setPurchasing(false);
      
      if (success) {
        navigation.goBack();
      }
    } else {
      setPurchasing(true);
      setTimeout(() => {
        setPurchasing(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }, 1500);
    }
  };

  const handleRestore = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRestoring(true);
    await restorePurchases();
    setRestoring(false);
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
            <Feather name="check-circle" size={64} color={Colors.dark.success} />
          </View>
          <ThemedText type="h2" style={styles.successTitle}>
            You're Subscribed!
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
          <ActivityIndicator size="large" color={Colors.dark.primary} />
          <ThemedText style={styles.loadingText}>Loading subscription options...</ThemedText>
        </View>
      </BackgroundGradient>
    );
  }

  const selectedPlanFeatures = hasRevenueCatPackages && selectedPackage
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
          <ThemedText style={styles.subtitle}>
            Unlock full access to all OB-GYN learning materials
          </ThemedText>
        </View>

        <View style={styles.plansContainer}>
          {hasRevenueCatPackages ? (
            packages.map((pkg) => {
              const isSelected = selectedPackage?.identifier === pkg.identifier;
              const isPopular = pkg.identifier.includes("quarterly") || pkg.packageType === "THREE_MONTH";
              
              return (
                <Pressable
                  key={pkg.identifier}
                  onPress={() => {
                    setSelectedPackage(pkg);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[
                    styles.planCard,
                    isSelected && styles.planCardSelected,
                    isPopular && styles.planCardPopular,
                  ]}
                >
                  {isPopular ? (
                    <View style={styles.popularBadge}>
                      <ThemedText style={styles.popularText}>BEST VALUE</ThemedText>
                    </View>
                  ) : null}

                  <View style={styles.planHeader}>
                    <View
                      style={[
                        styles.radioOuter,
                        isSelected && styles.radioOuterSelected,
                      ]}
                    >
                      {isSelected ? <View style={styles.radioInner} /> : null}
                    </View>
                    <View style={styles.planInfo}>
                      <ThemedText type="h4" style={styles.planName}>
                        {pkg.product.title}
                      </ThemedText>
                      {pkg.product.description ? (
                        <ThemedText style={styles.planDescription} numberOfLines={1}>
                          {pkg.product.description}
                        </ThemedText>
                      ) : null}
                    </View>
                    <View style={styles.priceContainer}>
                      <ThemedText type="h3" style={styles.price}>
                        {pkg.product.priceString}
                      </ThemedText>
                    </View>
                  </View>
                </Pressable>
              );
            })
          ) : (
            fallbackPlans.map((plan) => (
              <Pressable
                key={plan.id}
                onPress={() => {
                  setSelectedFallback(plan.id);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.planCard,
                  selectedFallback === plan.id && styles.planCardSelected,
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
                      selectedFallback === plan.id && styles.radioOuterSelected,
                    ]}
                  >
                    {selectedFallback === plan.id ? <View style={styles.radioInner} /> : null}
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
                      {plan.price}
                    </ThemedText>
                    <ThemedText style={styles.period}>{plan.period}</ThemedText>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </View>

        {!hasRevenueCatPackages && Platform.OS !== "web" ? (
          <View style={styles.previewNotice}>
            <Feather name="info" size={16} color={Colors.dark.primary} />
            <ThemedText style={styles.previewText}>
              Running in preview mode. Configure RevenueCat to enable real purchases.
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.featuresSection}>
          <ThemedText style={styles.sectionLabel}>INCLUDED FEATURES</ThemedText>
          {selectedPlanFeatures.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Feather name="check" size={16} color={Colors.dark.success} />
              </View>
              <ThemedText style={styles.featureText}>{feature}</ThemedText>
            </View>
          ))}
        </View>

        <PrimaryButton
          title={hasRevenueCatPackages && selectedPackage 
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
            <ActivityIndicator size="small" color={Colors.dark.primary} />
          ) : (
            <ThemedText style={styles.restoreText}>Restore Purchases</ThemedText>
          )}
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
    marginBottom: Spacing.xl,
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
  planDescription: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
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
  previewNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(17,164,212,0.1)",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  previewText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.primary,
    marginLeft: Spacing.sm,
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
    height: 24,
    justifyContent: "center",
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
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: Spacing.lg,
    color: Colors.dark.textSecondary,
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
    color: Colors.dark.textSecondary,
    marginBottom: Spacing["2xl"],
  },
  continueButton: {
    width: "100%",
  },
});
