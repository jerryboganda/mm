import React, { useEffect, useState } from "react";
import { StyleSheet, View, ScrollView, ActivityIndicator, Pressable, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "@/lib/haptics-wrapper";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/lib/auth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface Proof {
  id: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  packageName: string | null;
  createdAt: string;
}

export default function PendingApprovalScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { theme } = useTheme();
  const { user, refreshUser, logout } = useAuth();

  const { data, refetch } = useQuery<{ proofs: Proof[] }>({
    queryKey: ["/api/subscriptions/my-proofs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/subscriptions/my-proofs");
      return res.json();
    },
    refetchInterval: 8000,
    staleTime: 0,
  });

  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  const latest = data?.proofs?.[0];
  const isRejected = latest?.status === "rejected";

  // Poll auth status so the hard paywall opens automatically once an admin
  // approves the payment. The proofs list already polls itself via
  // `refetchInterval` above, so this only needs to refresh the user.
  useEffect(() => {
    const interval = setInterval(() => {
      refreshUser();
    }, 8000);
    return () => clearInterval(interval);
  }, [refreshUser]);

  // When the subscription becomes active, jump to the app.
  useEffect(() => {
    if (user?.subscriptionStatus === "active") {
      navigation.reset({ index: 0, routes: [{ name: "Main" }] });
    }
  }, [user?.subscriptionStatus, navigation]);

  const handleContinueToApp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  };

  const handleTryAgain = () => {
    navigation.reset({ index: 0, routes: [{ name: "Subscription" }] });
  };

  const handleCheckAgain = async () => {
    if (isChecking) return;
    setIsChecking(true);
    setCheckError(null);
    try {
      await Promise.all([refreshUser(), refetch({ throwOnError: true })]);
    } catch (error) {
      console.error("Check again failed:", error);
      setCheckError("Couldn't check right now. Please try again.");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <BackgroundGradient>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isRejected ? (
          <>
            <View style={[styles.iconCircle, { backgroundColor: `${theme.error}15` }]}>
              <Feather name="x" size={44} color={theme.error} />
            </View>
            <ThemedText type="h2" style={styles.title}>
              Payment Not Approved
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              Unfortunately we couldn&apos;t verify your payment.
            </ThemedText>
            {latest?.rejectionReason ? (
              <GlassCard style={styles.reasonCard}>
                <ThemedText style={[styles.reasonLabel, { color: theme.textMuted }]}>
                  Reason
                </ThemedText>
                <ThemedText style={styles.reasonText}>
                  {latest.rejectionReason}
                </ThemedText>
              </GlassCard>
            ) : null}
            <PrimaryButton
              title="Try Again"
              onPress={handleTryAgain}
              icon="refresh-cw"
              style={styles.cta}
            />
          </>
        ) : (
          <>
            <View style={[styles.iconCircle, { backgroundColor: `${theme.primary}15` }]}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
            <ThemedText type="h2" style={styles.title}>
              Verification in Progress
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              Your promo/coupon code or payment proof has been received, we shall verify soon. This screen will update automatically once verified.
            </ThemedText>
            <GlassCard style={styles.statusCard}>
              <Feather name="clock" size={18} color={theme.primary} />
              <ThemedText style={[styles.statusText, { color: theme.textSecondary }]}>
                Awaiting admin verification
              </ThemedText>
            </GlassCard>

            {/* Query & Contact Section */}
            <GlassCard style={styles.contactCard}>
              <ThemedText style={[styles.contactCardTitle, { color: theme.primary }]}>
                For further queries please contact on
              </ThemedText>

              <View style={styles.contactList}>
                <Pressable
                  style={styles.contactItem}
                  onPress={() => Linking.openURL("https://wa.me/923360830836")}
                  accessibilityRole="button"
                  accessibilityLabel="Contact on WhatsApp +923360830836"
                >
                  <View style={[styles.contactIconCircle, { backgroundColor: "#25D36620" }]}>
                    <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                  </View>
                  <View style={styles.contactItemTextCol}>
                    <ThemedText style={styles.contactItemLabel}>Whatsapp</ThemedText>
                    <ThemedText style={[styles.contactItemValue, { color: theme.textSecondary }]}>
                      +923360830836
                    </ThemedText>
                  </View>
                  <Feather name="chevron-right" size={16} color={theme.textMuted} />
                </Pressable>

                <Pressable
                  style={styles.contactItem}
                  onPress={() => Linking.openURL("https://maternalmind.com.pk/")}
                  accessibilityRole="button"
                  accessibilityLabel="Visit Website https://maternalmind.com.pk/"
                >
                  <View style={[styles.contactIconCircle, { backgroundColor: `${theme.primary}20` }]}>
                    <Feather name="globe" size={18} color={theme.primary} />
                  </View>
                  <View style={styles.contactItemTextCol}>
                    <ThemedText style={styles.contactItemLabel}>Web</ThemedText>
                    <ThemedText style={[styles.contactItemValue, { color: theme.textSecondary }]}>
                      https://maternalmind.com.pk/
                    </ThemedText>
                  </View>
                  <Feather name="chevron-right" size={16} color={theme.textMuted} />
                </Pressable>

                <Pressable
                  style={styles.contactItem}
                  onPress={() => Linking.openURL("mailto:maternalmind.help@gmail.com")}
                  accessibilityRole="button"
                  accessibilityLabel="Send email to maternalmind.help@gmail.com"
                >
                  <View style={[styles.contactIconCircle, { backgroundColor: `${theme.info}20` }]}>
                    <Feather name="mail" size={18} color={theme.info} />
                  </View>
                  <View style={styles.contactItemTextCol}>
                    <ThemedText style={styles.contactItemLabel}>Email</ThemedText>
                    <ThemedText style={[styles.contactItemValue, { color: theme.textSecondary }]}>
                      maternalmind.help@gmail.com
                    </ThemedText>
                  </View>
                  <Feather name="chevron-right" size={16} color={theme.textMuted} />
                </Pressable>
              </View>
            </GlassCard>

            <View style={styles.actionsContainer}>
              <PrimaryButton
                title="Continue to App"
                onPress={handleContinueToApp}
                icon="arrow-right"
                style={styles.continueButton}
              />

              <Pressable
                onPress={handleCheckAgain}
                disabled={isChecking}
                style={[styles.refreshButton, isChecking && styles.refreshButtonDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Check status again"
              >
                {isChecking ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Feather name="refresh-cw" size={16} color={theme.primary} />
                )}
                <ThemedText style={{ color: theme.primary, fontSize: 14, fontWeight: "600" }}>
                  {isChecking ? "Checking Status..." : "Check Status Again"}
                </ThemedText>
              </Pressable>
            </View>

            {checkError ? (
              <ThemedText style={[styles.checkErrorText, { color: theme.error }]}>
                {checkError}
              </ThemedText>
            ) : null}
          </>
        )}

        <Pressable onPress={logout} style={styles.signOut}>
          <ThemedText style={[styles.signOutText, { color: theme.textMuted }]}>
            Sign Out
          </ThemedText>
        </Pressable>
      </ScrollView>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
    marginTop: Spacing.md,
  },
  title: { textAlign: "center", marginBottom: Spacing.sm },
  subtitle: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  statusText: { fontSize: 14 },
  contactCard: {
    width: "100%",
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  contactCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  contactList: {
    gap: Spacing.sm,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  contactIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  contactItemTextCol: {
    flex: 1,
  },
  contactItemLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  contactItemValue: {
    fontSize: 13,
  },
  actionsContainer: {
    width: "100%",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  continueButton: {
    width: "100%",
  },
  reasonCard: {
    width: "100%",
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  reasonLabel: { fontSize: 12, marginBottom: Spacing.xs },
  reasonText: { fontSize: 15, lineHeight: 21 },
  cta: { width: "100%", marginTop: Spacing.lg },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
  },
  refreshButtonDisabled: {
    opacity: 0.6,
  },
  checkErrorText: {
    fontSize: 13,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  signOut: { marginTop: Spacing.xl, padding: Spacing.md, marginBottom: Spacing.lg },
  signOutText: { fontSize: 14 },
});
