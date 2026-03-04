import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics-wrapper";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

type TabType = "terms" | "privacy";

export default function TermsPrivacyScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>("terms");

  const handleTabChange = (tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  return (
    <BackgroundGradient>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.tabContainer, { backgroundColor: theme.glass }]}>
          <Pressable
            style={[
              styles.tab,
              activeTab === "terms" && {
                backgroundColor: theme.backgroundSecondary,
              },
            ]}
            onPress={() => handleTabChange("terms")}
            testID="tab-terms"
          >
            <Feather
              name="file-text"
              size={18}
              color={
                activeTab === "terms"
                  ? theme.primary
                  : theme.textSecondary
              }
            />
            <ThemedText
              style={[
                styles.tabText,
                { color: theme.textSecondary },
                activeTab === "terms" && { color: theme.primary },
              ]}
            >
              Terms of Use
            </ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.tab,
              activeTab === "privacy" && {
                backgroundColor: theme.backgroundSecondary,
              },
            ]}
            onPress={() => handleTabChange("privacy")}
            testID="tab-privacy"
          >
            <Feather
              name="shield"
              size={18}
              color={
                activeTab === "privacy"
                  ? theme.primary
                  : theme.textSecondary
              }
            />
            <ThemedText
              style={[
                styles.tabText,
                { color: theme.textSecondary },
                activeTab === "privacy" && { color: theme.primary },
              ]}
            >
              Privacy Policy
            </ThemedText>
          </Pressable>
        </View>

        {activeTab === "terms" ? (
          <GlassCard style={styles.card}>
            <ThemedText type="h3" style={styles.sectionTitle}>
              Terms of Use
            </ThemedText>
            <ThemedText style={[styles.lastUpdated, { color: theme.textMuted }]}>
              Last updated: January 2026
            </ThemedText>

            <ThemedText type="h4" style={styles.heading}>
              1. Acceptance of Terms
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
              By accessing and using Maternal Mind, you accept and agree to be
              bound by these Terms of Use. If you do not agree to these terms,
              please do not use our application.
            </ThemedText>

            <ThemedText type="h4" style={styles.heading}>
              2. Educational Purpose
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
              Maternal Mind is designed as an educational tool for medical
              students studying obstetrics and gynecology. The content provided
              is for learning purposes only and should not be used as a
              substitute for professional medical advice, diagnosis, or
              treatment.
            </ThemedText>

            <ThemedText type="h4" style={styles.heading}>
              3. User Accounts
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
              You are responsible for maintaining the confidentiality of your
              account credentials and for all activities that occur under your
              account. You must notify us immediately of any unauthorized use of
              your account.
            </ThemedText>

            <ThemedText type="h4" style={styles.heading}>
              4. Subscription & Payments
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
              Premium features require a paid subscription. Subscriptions
              automatically renew unless cancelled at least 24 hours before the
              end of the current period. Refunds are subject to the policies of
              your app store.
            </ThemedText>

            <ThemedText type="h4" style={styles.heading}>
              5. Intellectual Property
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
              All content, including text, images, and quizzes, is protected by
              copyright. You may not reproduce, distribute, or create derivative
              works without prior written consent.
            </ThemedText>

            <ThemedText type="h4" style={styles.heading}>
              6. Limitation of Liability
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
              Maternal Mind is provided &quot;as is&quot; without warranties of
              any kind. We are not liable for any damages arising from your use
              of the application.
            </ThemedText>

            <ThemedText type="h4" style={styles.heading}>
              7. Changes to Terms
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
              We reserve the right to modify these terms at any time. Continued
              use of the application after changes constitutes acceptance of the
              new terms.
            </ThemedText>
          </GlassCard>
        ) : (
          <GlassCard style={styles.card}>
            <ThemedText type="h3" style={styles.sectionTitle}>
              Privacy Policy
            </ThemedText>
            <ThemedText style={[styles.lastUpdated, { color: theme.textMuted }]}>
              Last updated: January 2026
            </ThemedText>

            <ThemedText type="h4" style={styles.heading}>
              1. Information We Collect
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
              We collect information you provide directly, including your name,
              email address, and study progress data. We also collect usage data
              to improve our service.
            </ThemedText>

            <ThemedText type="h4" style={styles.heading}>
              2. How We Use Your Information
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
              Your information is used to provide and personalize the learning
              experience, track your progress, send notifications you&apos;ve
              opted into, and improve our content and features.
            </ThemedText>

            <ThemedText type="h4" style={styles.heading}>
              3. Data Storage & Security
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
              We use industry-standard security measures to protect your data.
              Your information is stored on secure servers and encrypted during
              transmission.
            </ThemedText>

            <ThemedText type="h4" style={styles.heading}>
              4. Data Sharing
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
              We do not sell your personal information. We may share data with
              service providers who assist in operating our application, subject
              to confidentiality agreements.
            </ThemedText>

            <ThemedText type="h4" style={styles.heading}>
              5. Your Rights
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
              You have the right to access, correct, or delete your personal
              data. You can export your study progress at any time from your
              profile settings.
            </ThemedText>

            <ThemedText type="h4" style={styles.heading}>
              6. Cookies & Analytics
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
              We use analytics to understand how users interact with our app.
              This helps us improve the learning experience. You can opt out of
              analytics in settings.
            </ThemedText>

            <ThemedText type="h4" style={styles.heading}>
              7. Contact Us
            </ThemedText>
            <ThemedText style={[styles.paragraph, { color: theme.textSecondary }]}>
              If you have questions about this Privacy Policy, please contact us
              at privacy@maternalmind.com.pk.
            </ThemedText>
          </GlassCard>
        )}
      </ScrollView>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  tabContainer: {
    flexDirection: "row",
    marginBottom: Spacing.xl,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xs,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
  },
  card: {
    padding: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.xs,
  },
  lastUpdated: {
    fontSize: 13,
    marginBottom: Spacing.xl,
  },
  heading: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
  },
});
