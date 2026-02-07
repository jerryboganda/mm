import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { PrimaryButton } from "@/components/PrimaryButton";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ThemedText } from "@/components/ThemedText";
import { ImageViewer } from "@/components/ImageViewer";
import { apiRequest, queryClient } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type TopicReaderRouteProp = RouteProp<RootStackParamList, "TopicReader">;

interface ContentBlock {
  id: string;
  type: "text" | "image" | "note" | "heading";
  content: string;
  order: number;
}

interface TopicDetail {
  id: string;
  title: string;
  isCompleted: boolean;
  isBookmarked: boolean;
  blocks: ContentBlock[];
  nextTopicId?: string;
  previousTopicId?: string;
}

export default function TopicReaderScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const route = useRoute<TopicReaderRouteProp>();
  const { topicId, topicTitle } = route.params;
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportType, setReportType] = useState<string>("factual_error");
  const [reportDescription, setReportDescription] = useState("");

  const { data: topic, isLoading } = useQuery<TopicDetail>({
    queryKey: ["/api/topics", topicId],
  });

  const bookmarkMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/topics/${topicId}/bookmark`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", topicId] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  });

  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/topics/${topicId}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", topicId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const reportMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/content-reports", {
        contentType: "topic",
        contentId: topicId,
        reportType,
        description: reportDescription,
      });
    },
    onSuccess: () => {
      setReportVisible(false);
      setReportDescription("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (Platform.OS === "web") {
        window.alert("Thank you! Your report has been submitted.");
      } else {
        Alert.alert("Thank you!", "Your report has been submitted for review.");
      }
    },
    onError: () => {
      if (Platform.OS === "web") {
        window.alert("Failed to submit report. Please try again.");
      } else {
        Alert.alert("Error", "Failed to submit report. Please try again.");
      }
    },
  });

  const renderBlock = (block: ContentBlock) => {
    switch (block.type) {
      case "heading":
        return (
          <ThemedText key={block.id} type="h3" style={styles.heading}>
            {block.content}
          </ThemedText>
        );
      case "text":
        return (
          <ThemedText key={block.id} style={styles.paragraph}>
            {block.content}
          </ThemedText>
        );
      case "image":
        return (
          <Pressable
            key={block.id}
            style={styles.imageContainer}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setViewerImage(block.content);
            }}
          >
            <Image
              source={{ uri: block.content }}
              style={styles.image}
              contentFit="cover"
            />
            <View style={styles.imageOverlay}>
              <Feather name="maximize-2" size={16} color="#fff" />
            </View>
          </Pressable>
        );
      case "note":
        return (
          <View key={block.id} style={styles.noteContainer}>
            <View style={styles.noteIcon}>
              <Feather name="info" size={16} color={Colors.dark.purple} />
            </View>
            <ThemedText style={styles.noteText}>{block.content}</ThemedText>
          </View>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <BackgroundGradient>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.content,
            { paddingTop: headerHeight + Spacing.xl },
          ]}
        >
          <LoadingSkeleton
            width="80%"
            height={32}
            style={{ marginBottom: 24 }}
          />
          <LoadingSkeleton
            width="100%"
            height={16}
            style={{ marginBottom: 12 }}
          />
          <LoadingSkeleton
            width="100%"
            height={16}
            style={{ marginBottom: 12 }}
          />
          <LoadingSkeleton
            width="90%"
            height={16}
            style={{ marginBottom: 12 }}
          />
          <LoadingSkeleton
            width="100%"
            height={16}
            style={{ marginBottom: 24 }}
          />
          <LoadingSkeleton width="100%" height={200} borderRadius={16} />
        </ScrollView>
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
            paddingBottom: insets.bottom + 100,
          },
        ]}
      >
        <View style={styles.header}>
          <ThemedText type="h2" style={styles.title}>
            {topic?.title || topicTitle}
          </ThemedText>
          <Pressable
            onPress={() => bookmarkMutation.mutate()}
            style={styles.bookmarkButton}
          >
            <Feather
              name="bookmark"
              size={24}
              color={
                topic?.isBookmarked
                  ? Colors.dark.primary
                  : Colors.dark.textSecondary
              }
              style={{
                opacity: topic?.isBookmarked ? 1 : 0.6,
              }}
            />
            {topic?.isBookmarked && (
              <View
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: Colors.dark.primary,
                }}
              />
            )}
          </Pressable>
          <Pressable
            onPress={() => setReportVisible(true)}
            style={styles.bookmarkButton}
            accessibilityRole="button"
            accessibilityLabel="Report an error in this topic"
          >
            <Feather
              name="flag"
              size={22}
              color={Colors.dark.textSecondary}
              style={{ opacity: 0.6 }}
            />
          </Pressable>
        </View>

        {topic?.blocks?.map(renderBlock)}

        {!topic?.isCompleted ? (
          <PrimaryButton
            title="Mark as Complete"
            onPress={() => markCompleteMutation.mutate()}
            loading={markCompleteMutation.isPending}
            icon="check"
            style={styles.completeButton}
          />
        ) : (
          <View style={styles.completedBadge}>
            <Feather
              name="check-circle"
              size={20}
              color={Colors.dark.success}
            />
            <ThemedText style={styles.completedText}>Completed</ThemedText>
          </View>
        )}
      </ScrollView>

      <View
        style={[styles.floatingNav, { bottom: insets.bottom + Spacing.lg }]}
      >
        {topic?.previousTopicId ? (
          <Pressable
            style={styles.navButton}
            onPress={() =>
              navigation.setParams({ topicId: topic.previousTopicId })
            }
          >
            <Feather name="chevron-left" size={24} color={Colors.dark.text} />
            <ThemedText style={styles.navButtonText}>Previous</ThemedText>
          </Pressable>
        ) : (
          <View style={styles.navButtonPlaceholder} />
        )}
        {topic?.nextTopicId ? (
          <Pressable
            style={[styles.navButton, styles.navButtonPrimary]}
            onPress={() => navigation.setParams({ topicId: topic.nextTopicId })}
          >
            <ThemedText style={styles.navButtonTextPrimary}>
              Next Topic
            </ThemedText>
            <Feather name="chevron-right" size={24} color="#fff" />
          </Pressable>
        ) : null}
      </View>

      <ImageViewer
        visible={viewerImage !== null}
        imageUri={viewerImage || ""}
        onClose={() => setViewerImage(null)}
      />

      {/* Report Error Modal */}
      <Modal
        visible={reportVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReportVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setReportVisible(false)}
        >
          <Pressable
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="h3">Report an Error</ThemedText>
              <Pressable onPress={() => setReportVisible(false)}>
                <Feather name="x" size={24} color={Colors.dark.text} />
              </Pressable>
            </View>

            <ThemedText style={styles.modalLabel}>Error Type</ThemedText>
            <View style={styles.reportTypeRow}>
              {[
                { value: "factual_error", label: "Factual" },
                { value: "typo", label: "Typo" },
                { value: "outdated", label: "Outdated" },
                { value: "other", label: "Other" },
              ].map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.reportTypeChip,
                    reportType === opt.value && styles.reportTypeChipActive,
                  ]}
                  onPress={() => setReportType(opt.value)}
                >
                  <ThemedText
                    style={[
                      styles.reportTypeChipText,
                      reportType === opt.value &&
                        styles.reportTypeChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={styles.modalLabel}>Description</ThemedText>
            <TextInput
              style={styles.reportInput}
              placeholder="Describe the error..."
              placeholderTextColor={Colors.dark.textSecondary}
              multiline
              numberOfLines={4}
              value={reportDescription}
              onChangeText={setReportDescription}
              textAlignVertical="top"
            />

            <PrimaryButton
              title="Submit Report"
              onPress={() => reportMutation.mutate()}
              loading={reportMutation.isPending}
              icon="send"
              disabled={!reportDescription.trim()}
              style={{ marginTop: Spacing.lg }}
            />
          </Pressable>
        </Pressable>
      </Modal>
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
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Spacing["2xl"],
  },
  title: {
    flex: 1,
    marginRight: Spacing.md,
  },
  bookmarkButton: {
    padding: Spacing.sm,
  },
  heading: {
    marginTop: Spacing["2xl"],
    marginBottom: Spacing.md,
  },
  paragraph: {
    marginBottom: Spacing.lg,
    lineHeight: 26,
    color: Colors.dark.textSecondary,
  },
  imageContainer: {
    marginVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  image: {
    width: "100%",
    height: 200,
  },
  imageOverlay: {
    position: "absolute",
    bottom: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  noteContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(168,85,247,0.1)",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginVertical: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.dark.purple,
  },
  noteIcon: {
    marginRight: Spacing.md,
    marginTop: 2,
  },
  noteText: {
    flex: 1,
    color: Colors.dark.text,
    lineHeight: 22,
  },
  completeButton: {
    marginTop: Spacing["2xl"],
  },
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing["2xl"],
    padding: Spacing.lg,
    backgroundColor: "rgba(34,197,94,0.1)",
    borderRadius: BorderRadius.lg,
  },
  completedText: {
    marginLeft: Spacing.sm,
    color: Colors.dark.success,
    fontWeight: "600",
  },
  floatingNav: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.dark.glass,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  navButtonPrimary: {
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  navButtonPlaceholder: {
    flex: 1,
  },
  navButtonText: {
    marginLeft: Spacing.xs,
    color: Colors.dark.text,
  },
  navButtonTextPrimary: {
    marginRight: Spacing.xs,
    color: "#fff",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.dark.card,
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    padding: Spacing.xl,
    paddingBottom: Spacing["3xl"],
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  modalLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  reportTypeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  reportTypeChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
    backgroundColor: Colors.dark.glass,
  },
  reportTypeChipActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: "rgba(139,92,246,0.15)",
  },
  reportTypeChipText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  reportTypeChipTextActive: {
    color: Colors.dark.primary,
    fontWeight: "600",
  },
  reportInput: {
    backgroundColor: Colors.dark.glass,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
    padding: Spacing.md,
    color: Colors.dark.text,
    fontSize: 15,
    minHeight: 100,
  },
});
