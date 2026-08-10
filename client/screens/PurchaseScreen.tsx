import React from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Linking,
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
  iban?: string;
}

interface PaymentInstructions {
  currency: string;
  instructions: string;
  whatsappNumber?: string;
  supportEmail?: string;
  bank: {
    bankName: string;
    accountTitle: string;
    accountNumber: string;
    iban: string;
    branch: string;
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

function formatPrice(price: string): string {
  const n = Number(price);
  const amount = Number.isNaN(n)
    ? price
    : n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return `PKR ${amount}`;
}

export default function PurchaseScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<PurchaseScreenNavigationProp>();
  const route = useRoute<PurchaseScreenRouteProp>();
  const { theme } = useTheme();

  const {
    packageId,
    priceId,
    packageName,
    price,
    currency,
    billingCycle,
    couponId,
    couponCode,
    discountedPrice,
  } = route.params;

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
  const whatsappNumber = instructions?.whatsappNumber || "+923360830836";
  const supportEmail = instructions?.supportEmail || "maternalmind.help@gmail.com";

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
      couponId,
      couponCode,
      discountedPrice,
    });
  };

  const handleWhatsApp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const cleanNum = whatsappNumber.replace(/[^0-9]/g, "");
    const msg = encodeURIComponent(`Hi, I have made a payment for Maternal Mind ${packageName} (${formatPrice(price)}). Here is my payment receipt.`);
    Linking.openURL(`https://wa.me/${cleanNum}?text=${msg}`);
  };

  const handleEmail = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const subject = encodeURIComponent(`Payment Proof - Maternal Mind ${packageName}`);
    const body = encodeURIComponent(`Hi Maternal Mind Team,\n\nI have transferred payment for ${packageName} (${formatPrice(price)}).\n\nPlease find my payment proof attached.\n\nThank you!`);
    Linking.openURL(`mailto:${supportEmail}?subject=${subject}&body=${body}`);
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
              {formatPrice(price)}
            </ThemedText>
          </View>
          <ThemedText style={[styles.summaryCycle, { color: theme.textMuted }]}>
            {CYCLE_LABELS[billingCycle] ?? ""}
          </ThemedText>
          {couponCode ? (
            <View
              style={[
                styles.couponBannerRow,
                {
                  backgroundColor: `${theme.success}18`,
                  borderColor: `${theme.success}40`,
                },
              ]}
            >
              <Feather name="tag" size={14} color={theme.success} />
              <ThemedText style={[styles.couponBannerText, { color: theme.success }]}>
                Coupon <ThemedText style={{ fontWeight: "700", color: theme.success }}>{couponCode}</ThemedText> Applied
              </ThemedText>
            </View>
          ) : null}
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
                {bank?.branch ? (
                  <DetailRow label="Branch" value={bank.branch} />
                ) : null}
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
                    <DetailRow label="Account Number" value={w.number} />
                  ) : null}
                  {w.iban ? (
                    <DetailRow label="IBAN" value={w.iban} />
                  ) : null}
                </GlassCard>
              ))}

            <ThemedText style={[styles.sectionLabel, { color: theme.primary, marginTop: Spacing.lg }]}>
              UPLOAD PROOF OF PAYMENT
            </ThemedText>

            <GlassCard style={styles.proofOptionsCard}>
              <ThemedText style={[styles.proofSubtext, { color: theme.textSecondary }]}>
                Send your payment screenshot through any of the 3 easy methods below:
              </ThemedText>

              <Pressable style={styles.contactRow} onPress={handleWhatsApp}>
                <View style={[styles.contactIconBg, { backgroundColor: "#25D36622" }]}>
                  <Feather name="message-circle" size={18} color="#25D366" />
                </View>
                <View style={styles.contactTextCol}>
                  <ThemedText style={styles.contactTitle}>WhatsApp Proof</ThemedText>
                  <ThemedText style={[styles.contactSub, { color: theme.textMuted }]}>
                    {whatsappNumber}
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={16} color={theme.textMuted} />
              </Pressable>

              <Pressable style={styles.contactRow} onPress={handleEmail}>
                <View style={[styles.contactIconBg, { backgroundColor: `${theme.primary}22` }]}>
                  <Feather name="mail" size={18} color={theme.primary} />
                </View>
                <View style={styles.contactTextCol}>
                  <ThemedText style={styles.contactTitle}>Email Proof</ThemedText>
                  <ThemedText style={[styles.contactSub, { color: theme.textMuted }]}>
                    {supportEmail}
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={16} color={theme.textMuted} />
              </Pressable>
            </GlassCard>

            <View
              style={[styles.noteBox, { backgroundColor: `${theme.primary}12` }]}
            >
              <Feather name="info" size={16} color={theme.primary} />
              <ThemedText style={[styles.noteText, { color: theme.textSecondary }]}>
                Tip: long-press any account value to copy it. You can upload in-app below or send via WhatsApp / Email.
              </ThemedText>
            </View>
          </>
        )}

        <PrimaryButton
          title="I've Paid — Upload Proof In-App"
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
  proofOptionsCard: { padding: Spacing.md, marginBottom: Spacing.md },
  proofSubtext: { fontSize: 13, marginBottom: Spacing.md, lineHeight: 18 },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  contactIconBg: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  contactTextCol: { flex: 1 },
  contactTitle: { fontSize: 14, fontWeight: "600" },
  contactSub: { fontSize: 12, marginTop: 2 },
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
  couponBannerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  couponBannerText: {
    fontSize: 13,
  },
});
