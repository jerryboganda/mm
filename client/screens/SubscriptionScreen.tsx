import React from "react";
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
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "@/lib/haptics-wrapper";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { ThemedText } from "@/components/ThemedText";
import { apiRequest } from "@/lib/query-client";
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

const CYCLE_LABELS: Record<string, string> = {
  monthly: "per month",
  quarterly: "per 3 months",
  semi_annual: "per 6 months",
  annual: "per year",
  lifetime: "one-time",
  custom: "",
};

function formatPrice(price: string, currency: string): string {
  const n = Number(price);
  const amount = Number.isNaN(n)
    ? price
    : n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return `${currency} ${amount}`;
}

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<SubscriptionScreenNavigationProp>();
  const { theme } = useTheme();

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

  const handleSelect = (pkg: SubscriptionPackage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const price = pkg.prices[0];
    navigation.navigate("Purchase", {
      packageId: pkg.id,
      priceId: price.id,
      packageName: pkg.name,
      price: price.price,
      currency: price.currency,
      billingCycle: price.billingCycle,
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
            paddingTop: headerHeight + Spacing.xl,
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

        <View style={styles.plansContainer}>
          {packages.map((pkg) => {
            const price = pkg.prices[0];
            const cycleLabel = CYCLE_LABELS[price.billingCycle] ?? "";
            const includedFeatures = pkg.features
              .filter((f) => f.valueType !== "cross")
              .sort((a, b) => a.displayOrder - b.displayOrder);

            return (
              <Pressable
                key={pkg.id}
                onPress={() => handleSelect(pkg)}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: theme.glass,
                    borderColor: theme.glassBorder,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${pkg.name} plan, ${formatPrice(price.price, price.currency)} ${cycleLabel}`}
              >
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
                    {price.originalPrice ? (
                      <ThemedText
                        style={[
                          styles.originalPrice,
                          { color: theme.textMuted },
                        ]}
                      >
                        {formatPrice(price.originalPrice, price.currency)}
                      </ThemedText>
                    ) : null}
                    <ThemedText
                      type="h3"
                      style={[styles.price, { color: theme.primary }]}
                    >
                      {formatPrice(price.price, price.currency)}
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
                    { borderTopColor: theme.glassBorder },
                  ]}
                >
                  <ThemedText
                    style={[styles.selectText, { color: theme.primary }]}
                  >
                    Select &amp; Continue
                  </ThemedText>
                  <Feather name="arrow-right" size={18} color={theme.primary} />
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
  header: { alignItems: "center", marginBottom: Spacing["2xl"] },
  title: { textAlign: "center", marginBottom: Spacing.sm },
  subtitle: { textAlign: "center" },
  plansContainer: { marginBottom: Spacing.xl },
  planCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    overflow: "hidden",
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
    borderTopWidth: 1,
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
