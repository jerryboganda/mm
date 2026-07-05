import React, { useEffect, useState } from "react";
import { StyleSheet, View, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

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
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + Spacing["3xl"],
            paddingBottom: insets.bottom + Spacing["2xl"],
          },
        ]}
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
              Pending Review
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              Thanks! We&apos;ve received your payment proof
              {latest?.packageName ? ` for ${latest.packageName}` : ""}. Our team
              will verify it shortly. This screen will update automatically once
              your subscription is approved, and we&apos;ll email you too.
            </ThemedText>
            <GlassCard style={styles.statusCard}>
              <Feather name="clock" size={18} color={theme.primary} />
              <ThemedText style={[styles.statusText, { color: theme.textSecondary }]}>
                Awaiting admin approval
              </ThemedText>
            </GlassCard>
            <Pressable
              onPress={handleCheckAgain}
              disabled={isChecking}
              style={[styles.refreshButton, isChecking && styles.refreshButtonDisabled]}
            >
              {isChecking ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Feather name="refresh-cw" size={16} color={theme.primary} />
              )}
              <ThemedText style={{ color: theme.primary, fontSize: 14 }}>
                {isChecking ? "Checking..." : "Check again"}
              </ThemedText>
            </Pressable>
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
      </View>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["2xl"],
  },
  title: { textAlign: "center", marginBottom: Spacing.md },
  subtitle: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  statusText: { fontSize: 14 },
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
    marginTop: Spacing.xl,
    padding: Spacing.md,
  },
  refreshButtonDisabled: {
    opacity: 0.6,
  },
  checkErrorText: {
    fontSize: 13,
    textAlign: "center",
    marginTop: -Spacing.sm,
  },
  signOut: { marginTop: "auto", padding: Spacing.md },
  signOutText: { fontSize: 14 },
});
