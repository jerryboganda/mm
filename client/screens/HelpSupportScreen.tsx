import React, { useCallback, useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TextInput,
  Alert,
  Pressable,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics-wrapper";
import { useMutation, useQuery } from "@tanstack/react-query";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/lib/auth";
import { useMobileContent } from "@/lib/mobile-content";
import { apiRequest } from "@/lib/query-client";
import { useNetwork } from "@/lib/network";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

interface FAQ {
  question: string;
  answer: string;
  isOpen?: boolean;
}

interface SupportContactSettings {
  whatsappNumber: string;
  phoneNumber: string;
  supportEmail: string;
  whatsappDefaultMessage: string;
  whatsappEnabled: boolean;
  phoneEnabled: boolean;
  emailEnabled: boolean;
}

const faqs: FAQ[] = [
  {
    question: "How do I access premium content?",
    answer:
      "Subscribe to Maternal Mind Premium to unlock all textbook content, unlimited quiz practice, and advanced progress tracking. Go to Profile > Subscription to view available plans.",
  },
  {
    question: "Can I use the app offline?",
    answer:
      "Yes! Maternal Mind caches content you've already viewed so you can read it offline. Bookmarks and completions are saved and synced when you reconnect. Some features like quizzes and password changes require an internet connection.",
  },
  {
    question: "How do I reset my password?",
    answer:
      "Go to Profile > Settings > Security Settings to change your password. If you forgot your password, use the 'Forgot Password' option on the login screen.",
  },
  {
    question: "How is my progress tracked?",
    answer:
      "The app tracks topics you've read, quizzes completed, and your accuracy scores. View detailed analytics in the Progress tab.",
  },
  {
    question: "Can I cancel my subscription?",
    answer:
      "Yes, you can manage or cancel your subscription through the App Store (iOS) or Google Play Store (Android). Go to Profile > Subscription for more options.",
  },
];

const DEFAULT_SUPPORT_CONTACT_SETTINGS: SupportContactSettings = {
  whatsappNumber: "",
  phoneNumber: "",
  supportEmail: "support@maternalmind.com.pk",
  whatsappDefaultMessage: "Hello Support Team, I need help.",
  whatsappEnabled: false,
  phoneEnabled: false,
  emailEnabled: true,
};

function normalizeWhatsappNumber(value: string): string {
  return value.replace(/\D/g, "");
}

export default function HelpSupportScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { resolveText } = useMobileContent();
  const t = resolveText;
  const { isOffline } = useNetwork();

  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [issueType, setIssueType] = useState<string>("");
  const [issueDescription, setIssueDescription] = useState("");
  const {
    data: supportContactSettingsData,
    isLoading: isSupportContactLoading,
    refetch: refetchSupportContact,
  } = useQuery<SupportContactSettings>({
    queryKey: ["/api/support/contact"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/support/contact");
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: true,
  });

  useFocusEffect(
    useCallback(() => {
      refetchSupportContact();
    }, [refetchSupportContact]),
  );

  const supportContactSettings =
    supportContactSettingsData || DEFAULT_SUPPORT_CONTACT_SETTINGS;

  const reportIssueMutation = useMutation({
    mutationFn: async (data: {
      type: string;
      description: string;
      email: string;
    }) => {
      const response = await apiRequest(
        "POST",
        "/api/support/report-issue",
        data,
      );
      return response.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t("Issue Reported"),
        t(
          "Thank you for your feedback. We'll review your report and get back to you within 24-48 hours.",
        ),
        [
          {
            text: "OK",
            onPress: () => {
              setIssueType("");
              setIssueDescription("");
            },
          },
        ],
      );
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        t("Error"),
        error.message || "Failed to submit report. Please try again.",
      );
    },
  });

  const handleToggleFaq = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const openExternalLink = useCallback(async (url: string, channel: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert(t("Unavailable"), `Unable to open ${channel} on this device.`);
      return;
    }
    await Linking.openURL(url);
  }, []);

  const handleContactSupportEmail = useCallback(() => {
    const subject = encodeURIComponent("Support Request");
    openExternalLink(
      `mailto:${supportContactSettings.supportEmail}?subject=${subject}`,
      "email",
    );
  }, [openExternalLink, supportContactSettings.supportEmail]);

  const handleContactSupportPhone = useCallback(() => {
    openExternalLink(`tel:${supportContactSettings.phoneNumber}`, "phone");
  }, [openExternalLink, supportContactSettings.phoneNumber]);

  const handleContactSupportWhatsApp = useCallback(() => {
    const number = normalizeWhatsappNumber(supportContactSettings.whatsappNumber);
    if (!number) {
      Alert.alert(t("Unavailable"), t("WhatsApp number is not configured."));
      return;
    }
    const message = encodeURIComponent(
      supportContactSettings.whatsappDefaultMessage ||
        "Hello Support Team, I need help.",
    );
    openExternalLink(`https://wa.me/${number}?text=${message}`, "WhatsApp");
  }, [
    openExternalLink,
    supportContactSettings.whatsappDefaultMessage,
    supportContactSettings.whatsappNumber,
  ]);

  const contactMethods = useMemo(
    () =>
      [
        {
          id: "email",
          title: "Email Support",
          subtitle: supportContactSettings.supportEmail,
          icon: "mail",
          onPress: handleContactSupportEmail,
          enabled:
            supportContactSettings.emailEnabled &&
            !!supportContactSettings.supportEmail,
        },
        {
          id: "phone",
          title: "Call Support",
          subtitle: supportContactSettings.phoneNumber,
          icon: "phone",
          onPress: handleContactSupportPhone,
          enabled:
            supportContactSettings.phoneEnabled &&
            !!supportContactSettings.phoneNumber,
        },
        {
          id: "whatsapp",
          title: "WhatsApp Support",
          subtitle: supportContactSettings.whatsappNumber,
          icon: "message-circle",
          onPress: handleContactSupportWhatsApp,
          enabled:
            supportContactSettings.whatsappEnabled &&
            !!supportContactSettings.whatsappNumber,
        },
      ].filter((method) => method.enabled),
    [
      handleContactSupportEmail,
      handleContactSupportPhone,
      handleContactSupportWhatsApp,
      supportContactSettings.emailEnabled,
      supportContactSettings.phoneEnabled,
      supportContactSettings.supportEmail,
      supportContactSettings.phoneNumber,
      supportContactSettings.whatsappEnabled,
      supportContactSettings.whatsappNumber,
    ],
  );

  const handleSubmitIssue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isOffline) {
      Alert.alert(t("No Internet"), t("Submitting a support request requires an internet connection. Please try again when you're online."));
      return;
    }

    if (!issueType) {
      Alert.alert(t("Error"), t("Please select an issue type"));
      return;
    }

    if (!issueDescription.trim()) {
      Alert.alert(t("Error"), t("Please describe your issue"));
      return;
    }

    reportIssueMutation.mutate({
      type: issueType,
      description: issueDescription.trim(),
      email: user?.email || "",
    });
  };

  const issueTypes = [
    { id: "bug", label: "Bug Report", icon: "alert-circle" },
    { id: "feature", label: "Feature Request", icon: "star" },
    { id: "content", label: "Content Issue", icon: "book" },
    { id: "other", label: "Other", icon: "help-circle" },
  ];

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
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <ThemedText style={[styles.sectionLabel, { color: theme.primary }]}>
            FREQUENTLY ASKED QUESTIONS
          </ThemedText>
          {faqs.map((faq, index) => (
            <GlassCard
              key={index}
              style={styles.faqCard}
              onPress={() => handleToggleFaq(index)}
            >
              <View style={styles.faqHeader}>
                <ThemedText style={styles.faqQuestion}>
                  {faq.question}
                </ThemedText>
                <Feather
                  name={expandedFaq === index ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={theme.textSecondary}
                />
              </View>
              {expandedFaq === index ? (
                <ThemedText style={[styles.faqAnswer, { color: theme.textSecondary }]}>
                  {faq.answer}
                </ThemedText>
              ) : null}
            </GlassCard>
          ))}
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionLabel, { color: theme.primary }]}>CONTACT US</ThemedText>
          {isSupportContactLoading ? (
            <ThemedText style={[styles.contactLoadingText, { color: theme.textSecondary }]}>
              Loading support contacts...
            </ThemedText>
          ) : null}
          {contactMethods.length === 0 ? (
            <GlassCard style={styles.contactCard}>
              <ThemedText style={[styles.contactSubtitle, { color: theme.textSecondary }]}>
                Support contact details are currently unavailable.
              </ThemedText>
            </GlassCard>
          ) : (
            contactMethods.map((method) => (
              <GlassCard key={method.id} style={styles.contactCard} onPress={method.onPress}>
                <View style={styles.contactRow}>
                  <View style={[styles.contactIcon, { backgroundColor: `${theme.primary}15` }]}>
                    <Feather name={method.icon as any} size={20} color={theme.primary} />
                  </View>
                  <View style={styles.contactContent}>
                    <ThemedText style={styles.contactTitle}>
                      {method.title}
                    </ThemedText>
                    <ThemedText style={[styles.contactSubtitle, { color: theme.textSecondary }]}>
                      {method.subtitle}
                    </ThemedText>
                  </View>
                  <Feather
                    name="external-link"
                    size={18}
                    color={theme.textSecondary}
                  />
                </View>
              </GlassCard>
            ))
          )}
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionLabel, { color: theme.primary }]}>REPORT AN ISSUE</ThemedText>

          <View style={styles.issueTypes}>
            {issueTypes.map((type) => (
              <Pressable
                key={type.id}
                style={[
                  styles.issueTypeButton,
                  { backgroundColor: theme.glass },
                  issueType === type.id && {
                    borderColor: theme.primary,
                    backgroundColor: `${theme.primary}15`,
                  },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIssueType(type.id);
                }}
              >
                <Feather
                  name={type.icon as any}
                  size={16}
                  color={
                    issueType === type.id
                      ? theme.primary
                      : theme.textSecondary
                  }
                />
                <ThemedText
                  style={[
                    styles.issueTypeLabel,
                    { color: theme.textSecondary },
                    issueType === type.id && {
                      color: theme.primary,
                      fontWeight: "500",
                    },
                  ]}
                >
                  {type.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <GlassCard style={styles.textAreaCard}>
            <TextInput
              value={issueDescription}
              onChangeText={setIssueDescription}
              style={[styles.textArea, { color: theme.text }]}
              placeholder={t("Describe your issue in detail...")}
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              testID="input-issue-description"
            />
          </GlassCard>

          <PrimaryButton
            title={
              reportIssueMutation.isPending ? "Submitting..." : "Submit Report"
            }
            onPress={handleSubmitIssue}
            disabled={reportIssueMutation.isPending}
            icon="send"
            style={styles.submitButton}
            testID="button-submit-issue"
          />
        </View>
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
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: Spacing.lg,
  },
  faqCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    marginRight: Spacing.md,
  },
  faqAnswer: {
    fontSize: 14,
    marginTop: Spacing.md,
    lineHeight: 20,
  },
  contactCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  contactContent: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 2,
  },
  contactSubtitle: {
    fontSize: 13,
  },
  contactLoadingText: {
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  issueTypes: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  issueTypeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: "transparent",
  },
  issueTypeLabel: {
    fontSize: 13,
    marginLeft: Spacing.xs,
  },
  textAreaCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  textArea: {
    fontSize: 15,
    minHeight: 100,
    fontFamily: "Inter_400Regular",
  },
  submitButton: {
    marginTop: Spacing.xl,
  },
});
