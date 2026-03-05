import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics-wrapper";
import { PurchasesPackage, PACKAGE_TYPE } from "react-native-purchases";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { usePurchases } from "@/lib/purchases";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type SubscriptionScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

// Map package type to user-friendly details
function getPackageLabel(pkg: PurchasesPackage): {
  name: string;
  period: string;
  savings?: string;
  popular?: boolean;
} {
  const id = pkg.identifier.toLowerCase();
  const type = pkg.packageType;

  if (
    type === PACKAGE_TYPE.ANNUAL ||
    id.includes("yearly") ||
    id.includes("annual")
  ) {
    return { name: "Yearly", period: "/year", savings: "Save 33%" };
  }
  if (
    type === PACKAGE_TYPE.THREE_MONTH ||
    id.includes("quarterly") ||
    id.includes("3month")
  ) {
    return {
      name: "Quarterly",
      period: "/3 months",
      savings: "Save 17%",
      popular: true,
    };
  }
  if (
    type === PACKAGE_TYPE.SIX_MONTH ||
    id.includes("6month") ||
    id.includes("half")
  ) {
    return { name: "6 Months", period: "/6 months", savings: "Save 25%" };
  }
  if (
    type === PACKAGE_TYPE.TWO_MONTH ||
    id.includes("2month")
  ) {
    return { name: "2 Months", period: "/2 months", savings: "Save 10%" };
  }
  if (
    type === PACKAGE_TYPE.WEEKLY ||
    id.includes("weekly")
  ) {
    return { name: "Weekly", period: "/week" };
  }
  // Default: Monthly
  return { name: "Monthly", period: "/month" };
}

const allFeatures = [
  "Access all textbook content",
  "Unlimited MCQ practice",
  "Progress tracking",
  "Bookmarks & notes",
  "Priority support",
  "Early access to new content",
];

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<SubscriptionScreenNavigationProp>();
  const { packages, loading, isSubscribed, purchase, error, initialized } =
    usePurchases();
  const { theme } = useTheme();

  const [selectedPackage, setSelectedPackage] =
    useState<PurchasesPackage | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Auto-select the "popular" (quarterly) or first package
  useEffect(() => {
    if (packages.length > 0 && !selectedPackage) {
      const popular = packages.find((pkg) => {
        const label = getPackageLabel(pkg);
        return label.popular;
      });
      setSelectedPackage(popular || packages[0]);
    }
  }, [packages, selectedPackage]);

  const handlePurchase = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!selectedPackage) {
      return;
    }

    setPurchasing(true);
    try {
      const success = await purchase(selectedPackage);
      setPurchasing(false);

      if (success) {
        navigation.replace("PurchaseSuccess");
      }
    } catch (err: any) {
      setPurchasing(false);
      navigation.navigate("PurchaseFailed", {
        errorMessage: err.message || "Purchase failed. Please try again.",
      });
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

  // Show error state if RevenueCat failed to initialize or no packages available
  if (!initialized || (error && packages.length === 0)) {
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
          <View style={styles.errorIconContainer}>
            <Feather name="alert-circle" size={56} color={theme.warning} />
          </View>
          <ThemedText type="h3" style={styles.successTitle}>
            Subscription Unavailable
          </ThemedText>
          <ThemedText
            style={[styles.successSubtitle, { color: theme.textSecondary }]}
          >
            {error ||
              "Unable to load subscription plans. Please check your internet connection and try again."}
          </ThemedText>
          <PrimaryButton
            title="Try Again"
            onPress={() => navigation.replace("Subscription")}
            style={styles.continueButton}
          />
          <Pressable
            style={styles.restoreButton}
            onPress={handleRestore}
          >
            <ThemedText
              style={[styles.restoreText, { color: theme.primary }]}
            >
              Restore Purchases
            </ThemedText>
          </Pressable>
        </View>
      </BackgroundGradient>
    );
  }

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
          {packages.map((pkg) => {
            const isSelected =
              selectedPackage?.identifier === pkg.identifier;
            const label = getPackageLabel(pkg);

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
                  label.popular && {
                    borderColor: theme.primary,
                  },
                ]}
              >
                {label.popular ? (
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
                      {label.name}
                    </ThemedText>
                    {label.savings ? (
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
                          {label.savings}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.priceContainer}>
                    <ThemedText
                      type="h3"
                      style={[styles.price, { color: theme.primary }]}
                    >
                      {pkg.product.priceString}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.period,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {label.period}
                    </ThemedText>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.featuresSection}>
          <ThemedText style={[styles.sectionLabel, { color: theme.primary }]}>
            INCLUDED FEATURES
          </ThemedText>
          {allFeatures.map((feature, index) => (
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
            selectedPackage
              ? `Subscribe for ${selectedPackage.product.priceString}`
              : "Select a Plan"
          }
          onPress={handlePurchase}
          loading={purchasing}
          disabled={!selectedPackage}
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
  errorIconContainer: {
    marginBottom: Spacing.xl,
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
