import React from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import {
  useNavigation,
  useRoute,
  RouteProp,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "@/lib/haptics-wrapper";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type PurchaseScreenRouteProp = RouteProp<RootStackParamList, "Purchase">;
type PurchaseScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

interface Wallet {
  name: string;
  accountTitle: string;
  number: string;
}

interface PaymentInstructions {
  currency: string;
  instructions: string;
  bank: {
    bankName: string;
    accountTitle: string;
    accountNumber: string;
    iban: string;
  };
  wallets: Wallet[];
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

export default function PurchaseScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<PurchaseScreenNavigationProp>();
  const route = useRoute<PurchaseScreenRouteProp>();
  const { theme } = useTheme();

  const { packageId, priceId, packageName, price, currency, billingCycle } =
    route.params;

  const { data, isLoading } = useQuery<{ instructions: PaymentInstructions }>({
    queryKey: ["/api/subscriptions/payment-instructions"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        "/api/subscriptions/payment-instructions",
      );
      return res.json();
    },
    staleTime: 60_000,
  });

  const instructions = data?.instructions;
  const bank = instructions?.bank;
  const wallets = instructions?.wallets || [];
  const hasBank =
    !!bank && (bank.accountNumber || bank.iban || bank.bankName);

  const handleUpload = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("PaymentProofUpload", {
      packageId,
      priceId,
      packageName,
      price,
      currency,
    });
  };

  const DetailRow = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.detailRow}>
      <ThemedText style={[styles.detailLabel, { color: theme.textMuted }]}>
        {label}
      </ThemedText>
      <ThemedText selectable style={styles.detailValue}>
        {value}
      </ThemedText>
    </View>
  );

  return (
    <BackgroundGradient>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Order summary */}
        <GlassCard style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              {packageName}
            </ThemedText>
            <ThemedText type="h4" style={{ color: theme.primary }}>
              {formatPrice(price, currency)}
            </ThemedText>
          </View>
          <ThemedText style={[styles.summaryCycle, { color: theme.textMuted }]}>
            {CYCLE_LABELS[billingCycle] ?? ""}
          </ThemedText>
        </GlassCard>

        <ThemedText style={[styles.sectionLabel, { color: theme.primary }]}>
          HOW TO PAY
        </ThemedText>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : (
          <>
            {instructions?.instructions ? (
              <ThemedText
                style={[styles.instructionsText, { color: theme.textSecondary }]}
              >
                {instructions.instructions}
              </ThemedText>
            ) : null}

            {hasBank ? (
              <GlassCard style={styles.detailCard}>
                <View style={styles.cardHeader}>
                  <Feather name="credit-card" size={18} color={theme.primary} />
                  <ThemedText type="h4" style={styles.cardHeaderText}>
                    Bank Transfer
                  </ThemedText>
                </View>
                {bank?.bankName ? (
                  <DetailRow label="Bank" value={bank.bankName} />
                ) : null}
                {bank?.accountTitle ? (
                  <DetailRow label="Account Title" value={bank.accountTitle} />
                ) : null}
                {bank?.accountNumber ? (
                  <DetailRow label="Account #" value={bank.accountNumber} />
                ) : null}
                {bank?.iban ? <DetailRow label="IBAN" value={bank.iban} /> : null}
              </GlassCard>
            ) : null}

            {wallets
              .filter((w) => w.number || w.name)
              .map((w, i) => (
                <GlassCard key={i} style={styles.detailCard}>
                  <View style={styles.cardHeader}>
                    <Feather name="smartphone" size={18} color={theme.primary} />
                    <ThemedText type="h4" style={styles.cardHeaderText}>
                      {w.name || "Mobile Wallet"}
                    </ThemedText>
                  </View>
                  {w.accountTitle ? (
                    <DetailRow label="Account Title" value={w.accountTitle} />
                  ) : null}
                  {w.number ? (
                    <DetailRow label="Number" value={w.number} />
                  ) : null}
                </GlassCard>
              ))}

            {!hasBank && wallets.length === 0 ? (
              <ThemedText
                style={[styles.instructionsText, { color: theme.textMuted }]}
              >
                Payment details are not configured yet. Please contact support.
              </ThemedText>
            ) : null}

            <View
              style={[styles.noteBox, { backgroundColor: `${theme.primary}12` }]}
            >
              <Feather name="info" size={16} color={theme.primary} />
              <ThemedText style={[styles.noteText, { color: theme.textSecondary }]}>
                Tip: long-press any value above to copy it. After paying, tap the
                button below to upload your receipt.
              </ThemedText>
            </View>
          </>
        )}

        <PrimaryButton
          title="I've Paid — Upload Proof"
          onPress={handleUpload}
          icon="upload"
          style={styles.uploadButton}
          testID="button-upload-proof"
        />
      </ScrollView>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  summaryCard: { padding: Spacing.lg, marginBottom: Spacing.xl },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryLabel: { fontSize: 15, fontWeight: "600" },
  summaryCycle: { fontSize: 12, marginTop: Spacing.xs },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: Spacing.md,
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: Spacing.lg,
  },
  detailCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardHeaderText: { marginBottom: 0 },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
    gap: Spacing.md,
  },
  detailLabel: { fontSize: 13 },
  detailValue: { fontSize: 14, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  loadingBox: { paddingVertical: Spacing["2xl"], alignItems: "center" },
  noteBox: {
    flexDirection: "row",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  noteText: { flex: 1, fontSize: 13, lineHeight: 19 },
  uploadButton: { marginTop: Spacing.md },
});
