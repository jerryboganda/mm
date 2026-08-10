import React, { useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "@/lib/haptics-wrapper";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { ThemedText } from "@/components/ThemedText";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/lib/auth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type SubscriptionScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

interface PackagePrice {
  id: string;
  billingCycle: string;
  price: string;
  currency: string;
  originalPrice: string | null;
}

interface PackageFeature {
  featureKey: string | null;
  name: string;
  description: string | null;
  valueType: string;
  value: string | null;
  displayOrder: number;
}

interface SubscriptionPackage {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  iconUrl: string | null;
  displayOrder: number;
  trialDays: number;
  prices: PackagePrice[];
  features: PackageFeature[];
}

interface ValidatedCoupon {
  couponId: string;
  code: string;
  discountType: string;
  discountValue: number;
  discountAmount: number;
  originalPrice: number;
  finalPrice: number;
  isFreeAccess: boolean;
  accessDurationDays?: number;
  message?: string;
}

const CYCLE_LABELS: Record<string, string> = {
  monthly: "per month",
  quarterly: "per 3 months",
  semi_annual: "per 6 months",
  annual: "per year",
  lifetime: "one-time",
  custom: "",
};

function formatPrice(price: string | number): string {
  const n = typeof price === "number" ? price : Number(price);
  const amount = Number.isNaN(n)
    ? String(price)
    : n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return `PKR ${amount}`;
}

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<SubscriptionScreenNavigationProp>();
  const { theme } = useTheme();
  const { refreshUser } = useAuth();

  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<ValidatedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isClaimingFree, setIsClaimingFree] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<{
    packages: SubscriptionPackage[];
  }>({
    queryKey: ["/api/subscriptions/packages"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/subscriptions/packages");
      return res.json();
    },
    staleTime: 60_000,
  });

  const packages = (data?.packages || [])
    .filter((p) => p.prices && p.prices.length > 0)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const handleApplyCoupon = async () => {
    if (!couponCodeInput.trim()) return;
    const code = couponCodeInput.trim().toUpperCase();

    const targetPkg = packages[0];
    if (!targetPkg || !targetPkg.prices || targetPkg.prices.length === 0) return;
    const targetPrice = targetPkg.prices[0];

    setIsValidatingCoupon(true);
    setCouponError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const res = await apiRequest("POST", "/api/subscriptions/validate-coupon", {
        code,
        packageId: targetPkg.id,
        priceId: targetPrice.id,
      });

      const json = await res.json();
      if (!res.ok || !json.valid) {
        setAppliedCoupon(null);
        setCouponError(json.message || json.error || "Invalid or expired promo code");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        setAppliedCoupon(json);
        setCouponError(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      let msg = "Failed to validate promo code";
      try {
        const raw = err.message || "";
        const match = raw.match(/^(\d+):\s*([\s\S]*)$/);
        const body = match ? match[2] : raw;
        const parsed = JSON.parse(body);
        if (parsed?.message) msg = parsed.message;
      } catch {}
      setCouponError(msg);
      setAppliedCoupon(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAppliedCoupon(null);
    setCouponCodeInput("");
    setCouponError(null);
  };

  const handleClaimFreeAccess = async (pkg: SubscriptionPackage) => {
    if (!appliedCoupon || !appliedCoupon.isFreeAccess) return;
    const price = pkg.prices[0];

    setIsClaimingFree(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await apiRequest("POST", "/api/subscriptions/redeem-free-coupon", {
        code: appliedCoupon.code,
        packageId: pkg.id,
        priceId: price.id,
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to redeem free coupon");
      }

      await refreshUser();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate("PurchaseSuccess");
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      let msg = err?.message || "Failed to redeem free coupon";
      try {
        const raw = err.message || "";
        const match = raw.match(/^(\d+):\s*([\s\S]*)$/);
        const body = match ? match[2] : raw;
        const parsed = JSON.parse(body);
        if (parsed?.message) msg = parsed.message;
      } catch {}
      Alert.alert("Redemption Failed", msg);
    } finally {
      setIsClaimingFree(false);
    }
  };

  const handleSelect = (pkg: SubscriptionPackage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const price = pkg.prices[0];
    navigation.navigate("Purchase", {
      packageId: pkg.id,
      priceId: price.id,
      packageName: pkg.name,
      price: appliedCoupon ? String(appliedCoupon.finalPrice) : price.price,
      currency: price.currency,
      billingCycle: price.billingCycle,
      couponId: appliedCoupon?.couponId,
      couponCode: appliedCoupon?.code,
      discountedPrice: appliedCoupon ? String(appliedCoupon.finalPrice) : undefined,
    });
  };

  if (isLoading) {
    return (
      <BackgroundGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText
            style={[styles.loadingText, { color: theme.textSecondary }]}
          >
            Loading plans...
          </ThemedText>
        </View>
      </BackgroundGradient>
    );
  }

  if (isError || packages.length === 0) {
    return (
      <BackgroundGradient>
        <View
          style={[
            styles.centerContainer,
            {
              paddingTop: headerHeight + Spacing["2xl"],
              paddingBottom: insets.bottom + Spacing["3xl"],
            },
          ]}
        >
          <Feather name="alert-circle" size={56} color={theme.warning} />
          <ThemedText type="h3" style={styles.centerTitle}>
            Plans Unavailable
          </ThemedText>
          <ThemedText
            style={[styles.centerSubtitle, { color: theme.textSecondary }]}
          >
            We couldn&apos;t load the subscription plans. Please check your
            connection and try again.
          </ThemedText>
          <Pressable
            style={[styles.retryButton, { borderColor: theme.primary }]}
            onPress={() => refetch()}
          >
            <ThemedText style={{ color: theme.primary, fontWeight: "600" }}>
              Try Again
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
            paddingTop: (headerHeight > 0 ? headerHeight : insets.top) + Spacing["2xl"],
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ThemedText type="h2" style={styles.title}>
            Choose Your Plan
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Unlock full access to all OB-GYN learning materials
          </ThemedText>
        </View>

        {/* Promo / Coupon Code Card Section */}
        <View
          style={[
            styles.couponCard,
            {
              backgroundColor: theme.glass,
              borderColor: appliedCoupon ? theme.success : theme.glassBorder,
            },
          ]}
        >
          <View style={styles.couponCardHeader}>
            <Feather
              name="tag"
              size={18}
              color={appliedCoupon ? theme.success : theme.primary}
            />
            <ThemedText type="h4" style={styles.couponCardTitle}>
              Promo / Coupon Code
            </ThemedText>
          </View>

          {appliedCoupon ? (
            <View
              style={[
                styles.appliedBanner,
                { backgroundColor: `${theme.success}18` },
              ]}
            >
              <View style={styles.appliedBannerLeft}>
                <Feather name="check-circle" size={20} color={theme.success} />
                <View style={styles.appliedTextCol}>
                  <View style={styles.appliedBadgeRow}>
                    <ThemedText style={[styles.appliedCodeText, { color: theme.success }]}>
                      {appliedCoupon.code}
                    </ThemedText>
                    <View
                      style={[
                        styles.discountBadgeText,
                        {
                          backgroundColor: appliedCoupon.isFreeAccess
                            ? theme.success
                            : theme.primary,
                        },
                      ]}
                    >
                      <ThemedText style={styles.discountBadgeLabel}>
                        {appliedCoupon.isFreeAccess
                          ? "100% FREE"
                          : `-${appliedCoupon.discountValue}% OFF`}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText style={[styles.appliedMsgText, { color: theme.textSecondary }]}>
                    {appliedCoupon.message ||
                      (appliedCoupon.isFreeAccess
                        ? "100% discount applied! Claim instant access below."
                        : `PKR ${appliedCoupon.discountAmount.toLocaleString()} discount applied.`)}
                  </ThemedText>
                </View>
              </View>
              <Pressable
                onPress={handleRemoveCoupon}
                style={styles.removeCouponBtn}
                accessibilityLabel="Remove coupon"
              >
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
          ) : (
            <View>
              <View style={styles.couponInputRow}>
                <TextInput
                  style={[
                    styles.couponInput,
                    {
                      backgroundColor: `${theme.text}08`,
                      borderColor: couponError ? theme.error : theme.glassBorder,
                      color: theme.text,
                    },
                  ]}
                  placeholder="Enter Promo Code"
                  placeholderTextColor={theme.textMuted}
                  value={couponCodeInput}
                  onChangeText={(txt) => {
                    setCouponCodeInput(txt.toUpperCase());
                    if (couponError) setCouponError(null);
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!isValidatingCoupon}
                />
                <Pressable
                  style={[
                    styles.applyButton,
                    {
                      backgroundColor: couponCodeInput.trim()
                        ? theme.primary
                        : `${theme.primary}50`,
                    },
                  ]}
                  onPress={handleApplyCoupon}
                  disabled={!couponCodeInput.trim() || isValidatingCoupon}
                >
                  {isValidatingCoupon ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <ThemedText style={styles.applyButtonText}>Apply</ThemedText>
                  )}
                </Pressable>
              </View>
              {couponError ? (
                <ThemedText style={[styles.couponErrorText, { color: theme.error }]}>
                  {couponError}
                </ThemedText>
              ) : null}
            </View>
          )}
        </View>

        <View style={styles.plansContainer}>
          {packages.map((pkg) => {
            const price = pkg.prices[0];
            const cycleLabel = CYCLE_LABELS[price.billingCycle] ?? "";
            const includedFeatures = pkg.features
              .filter((f) => f.valueType !== "cross")
              .sort((a, b) => a.displayOrder - b.displayOrder);

            const isFree = appliedCoupon?.isFreeAccess === true;
            const originalPriceFormatted = appliedCoupon
              ? formatPrice(price.price)
              : price.originalPrice
              ? formatPrice(price.originalPrice)
              : null;
            const finalPriceFormatted = appliedCoupon
              ? formatPrice(appliedCoupon.finalPrice)
              : formatPrice(price.price);

            return (
              <Pressable
                key={pkg.id}
                onPress={() => (isFree ? handleClaimFreeAccess(pkg) : handleSelect(pkg))}
                disabled={isClaimingFree}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: theme.glass,
                    borderColor: isFree ? theme.success : theme.glassBorder,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${pkg.name} plan, ${finalPriceFormatted} ${cycleLabel}`}
              >
                {isFree ? (
                  <View
                    style={[
                      styles.freeAccessPill,
                      { backgroundColor: theme.success },
                    ]}
                  >
                    <Feather name="gift" size={12} color="#fff" />
                    <ThemedText style={styles.freeAccessPillText}>
                      100% FREE ACCESS
                    </ThemedText>
                  </View>
                ) : null}

                <View style={styles.planTop}>
                  <View style={styles.planInfo}>
                    <ThemedText type="h4" style={styles.planName}>
                      {pkg.name}
                    </ThemedText>
                    {pkg.shortDescription ? (
                      <ThemedText
                        style={[
                          styles.planDesc,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {pkg.shortDescription}
                      </ThemedText>
                    ) : null}
                  </View>
                  <View style={styles.priceContainer}>
                    {originalPriceFormatted ? (
                      <ThemedText
                        style={[
                          styles.originalPrice,
                          { color: theme.textMuted },
                        ]}
                      >
                        {originalPriceFormatted}
                      </ThemedText>
                    ) : null}

                    {appliedCoupon && !isFree ? (
                      <View style={[styles.discountBadgeSmall, { backgroundColor: theme.primary }]}>
                        <ThemedText style={styles.discountBadgeSmallText}>
                          -{appliedCoupon.discountValue}% OFF
                        </ThemedText>
                      </View>
                    ) : null}

                    <ThemedText
                      type="h3"
                      style={[
                        styles.price,
                        { color: isFree ? theme.success : theme.primary },
                      ]}
                    >
                      {finalPriceFormatted}
                    </ThemedText>
                    <ThemedText
                      style={[styles.period, { color: theme.textSecondary }]}
                    >
                      {cycleLabel}
                    </ThemedText>
                  </View>
                </View>

                {includedFeatures.length > 0 ? (
                  <View style={styles.featuresList}>
                    {includedFeatures.map((f, i) => (
                      <View key={i} style={styles.featureRow}>
                        <Feather
                          name="check"
                          size={15}
                          color={theme.success}
                        />
                        <ThemedText
                          style={[styles.featureText, { color: theme.text }]}
                        >
                          {f.value ? `${f.name}: ${f.value}` : f.name}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View
                  style={[
                    styles.selectRow,
                    {
                      borderTopColor: theme.glassBorder,
                      backgroundColor: isFree ? `${theme.success}12` : "transparent",
                    },
                  ]}
                >
                  {isClaimingFree ? (
                    <ActivityIndicator size="small" color={theme.success} />
                  ) : (
                    <>
                      <ThemedText
                        style={[
                          styles.selectText,
                          { color: isFree ? theme.success : theme.primary },
                        ]}
                      >
                        {isFree ? "Claim Instant Free Access" : "Select & Continue"}
                      </ThemedText>
                      <Feather
                        name={isFree ? "zap" : "arrow-right"}
                        size={18}
                        color={isFree ? theme.success : theme.primary}
                      />
                    </>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        <ThemedText style={[styles.legalText, { color: theme.textMuted }]}>
          After selecting a plan you&apos;ll see payment instructions and can
          upload your payment proof. Your subscription activates once an admin
          verifies your payment.
        </ThemedText>
      </ScrollView>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  header: { alignItems: "center", marginBottom: Spacing.xl },
  title: { textAlign: "center", marginBottom: Spacing.xs },
  subtitle: { textAlign: "center" },
  couponCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  couponCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  couponCardTitle: { fontSize: 15, fontWeight: "600" },
  couponInputRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 1,
  },
  applyButton: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  applyButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
  couponErrorText: {
    fontSize: 12,
    marginTop: Spacing.xs,
    marginLeft: 2,
  },
  appliedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  appliedBannerLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    flex: 1,
  },
  appliedTextCol: { flex: 1 },
  appliedBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  appliedCodeText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  discountBadgeText: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  discountBadgeLabel: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
  appliedMsgText: {
    fontSize: 12,
    marginTop: 2,
  },
  removeCouponBtn: {
    padding: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  plansContainer: { marginBottom: Spacing.xl },
  planCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  freeAccessPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  freeAccessPillText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  planTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  planInfo: { flex: 1, paddingRight: Spacing.md },
  planName: { marginBottom: Spacing.xs },
  planDesc: { fontSize: 13, lineHeight: 18 },
  priceContainer: { alignItems: "flex-end" },
  originalPrice: {
    fontSize: 12,
    textDecorationLine: "line-through",
  },
  discountBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginVertical: 2,
  },
  discountBadgeSmallText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
  price: {},
  period: { fontSize: 12 },
  featuresList: { marginTop: Spacing.lg },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  featureText: { flex: 1, fontSize: 14 },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    borderTopWidth: 1,
    borderRadius: BorderRadius.md,
  },
  selectText: { fontSize: 15, fontWeight: "600" },
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
  loadingText: { marginTop: Spacing.lg },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  centerTitle: { textAlign: "center", marginTop: Spacing.lg, marginBottom: Spacing.md },
  centerSubtitle: { textAlign: "center", marginBottom: Spacing["2xl"] },
  retryButton: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing["2xl"],
  },
});
