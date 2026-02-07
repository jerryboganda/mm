import React, { useState } from "react";
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
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useMutation } from "@tanstack/react-query";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface FAQ {
  question: string;
  answer: string;
  isOpen?: boolean;
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
      "Currently, Maternal Mind requires an internet connection to sync your progress and access content. Offline mode is planned for a future update.",
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

export default function HelpSupportScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user } = useAuth();

  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [issueType, setIssueType] = useState<string>("");
  const [issueDescription, setIssueDescription] = useState("");

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
        "Issue Reported",
        "Thank you for your feedback. We'll review your report and get back to you within 24-48 hours.",
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
        "Error",
        error.message || "Failed to submit report. Please try again.",
      );
    },
  });

  const handleToggleFaq = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const handleContactSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(
      "mailto:support@maternalmind.com.pk?subject=Support%20Request",
    );
  };

  const handleSubmitIssue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!issueType) {
      Alert.alert("Error", "Please select an issue type");
      return;
    }

    if (!issueDescription.trim()) {
      Alert.alert("Error", "Please describe your issue");
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
          <ThemedText style={styles.sectionLabel}>
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
                  color={Colors.dark.textSecondary}
                />
              </View>
              {expandedFaq === index ? (
                <ThemedText style={styles.faqAnswer}>{faq.answer}</ThemedText>
              ) : null}
            </GlassCard>
          ))}
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>CONTACT US</ThemedText>
          <GlassCard style={styles.contactCard} onPress={handleContactSupport}>
            <View style={styles.contactRow}>
              <View style={styles.contactIcon}>
                <Feather name="mail" size={20} color={Colors.dark.primary} />
              </View>
              <View style={styles.contactContent}>
                <ThemedText style={styles.contactTitle}>
                  Email Support
                </ThemedText>
                <ThemedText style={styles.contactSubtitle}>
                  support@maternalmind.com.pk
                </ThemedText>
              </View>
              <Feather
                name="external-link"
                size={18}
                color={Colors.dark.textSecondary}
              />
            </View>
          </GlassCard>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>REPORT AN ISSUE</ThemedText>

          <View style={styles.issueTypes}>
            {issueTypes.map((type) => (
              <Pressable
                key={type.id}
                style={[
                  styles.issueTypeButton,
                  issueType === type.id && styles.issueTypeButtonActive,
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
                      ? Colors.dark.primary
                      : Colors.dark.textSecondary
                  }
                />
                <ThemedText
                  style={[
                    styles.issueTypeLabel,
                    issueType === type.id && styles.issueTypeLabelActive,
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
              style={styles.textArea}
              placeholder="Describe your issue in detail..."
              placeholderTextColor={Colors.dark.textMuted}
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
    letterSpacing: 1.5,
    color: Colors.dark.textMuted,
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
    color: Colors.dark.textSecondary,
    marginTop: Spacing.md,
    lineHeight: 20,
  },
  contactCard: {
    padding: Spacing.lg,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${Colors.dark.primary}15`,
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
    color: Colors.dark.textSecondary,
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
    backgroundColor: Colors.dark.glass,
    borderWidth: 1,
    borderColor: "transparent",
  },
  issueTypeButtonActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: `${Colors.dark.primary}15`,
  },
  issueTypeLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginLeft: Spacing.xs,
  },
  issueTypeLabelActive: {
    color: Colors.dark.primary,
    fontWeight: "500",
  },
  textAreaCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  textArea: {
    fontSize: 15,
    color: Colors.dark.text,
    minHeight: 100,
    fontFamily: "Inter_400Regular",
  },
  submitButton: {},
});
