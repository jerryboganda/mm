import React, { useState, useMemo, useCallback } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Alert,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import RenderHtml from "react-native-render-html";
import TableRenderer, {
  tableModel,
} from "@native-html/table-plugin";
import WebView from "react-native-webview";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { PrimaryButton } from "@/components/PrimaryButton";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ThemedText } from "@/components/ThemedText";
import { ImageViewer } from "@/components/ImageViewer";
import { useMobileContent } from "@/lib/mobile-content";
import { apiRequest, queryClient } from "@/lib/query-client";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type TopicReaderRouteProp = RouteProp<RootStackParamList, "TopicReader">;
type TopicReaderNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "TopicReader"
>;

interface ContentBlock {
  id: string;
  type: "text" | "image" | "note" | "heading" | "html" | "code" | "diagram";
  content: string;
  order: number;
}

interface TopicDetail {
  id: string;
  title: string;
  author?: string | null;
  source?: string | null;
  references?: string | null;
  updatedAt?: string | null;
  isCompleted: boolean;
  isBookmarked: boolean;
  blocks: ContentBlock[];
  nextTopicId?: string;
  previousTopicId?: string;
}

export default function TopicReaderScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<TopicReaderNavigationProp>();
  const route = useRoute<TopicReaderRouteProp>();
  const { topicId, topicTitle } = route.params;
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportType, setReportType] = useState<string>("factual_error");
  const [reportDescription, setReportDescription] = useState("");
  const { theme, isDark } = useTheme();
  const { resolveText } = useMobileContent();
  const t = resolveText;
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = windowWidth - Spacing.lg * 2;

  const { data: topic, isLoading } = useQuery<TopicDetail>({
    queryKey: ["/api/topics", topicId],
  });

  /* ─── HTML rendering configuration for react-native-render-html ─── */
  const htmlTagsStyles = useMemo(
    () => ({
      body: { color: theme.text, fontSize: 15, lineHeight: 24 },
      p: { marginBottom: 8, color: theme.text },
      h1: { fontSize: 24, fontWeight: "700" as const, color: theme.text, marginBottom: 8 },
      h2: { fontSize: 20, fontWeight: "700" as const, color: theme.text, marginBottom: 6 },
      h3: { fontSize: 17, fontWeight: "700" as const, color: theme.text, marginBottom: 4 },
      strong: { fontWeight: "700" as const, color: theme.text },
      b: { fontWeight: "700" as const },
      em: { fontStyle: "italic" as const },
      u: { textDecorationLine: "underline" as const },
      s: { textDecorationLine: "line-through" as const },
      a: { color: theme.primary, textDecorationLine: "underline" as const },
      ul: { paddingLeft: 18, marginBottom: 8 },
      ol: { paddingLeft: 18, marginBottom: 8 },
      li: { marginBottom: 4, color: theme.text, fontSize: 15 },
      blockquote: {
        borderLeftWidth: 3,
        borderLeftColor: theme.primary,
        paddingLeft: 12,
        fontStyle: "italic" as const,
        color: theme.textSecondary,
        marginVertical: 8,
      },
      sup: { fontSize: 10, lineHeight: 14 },
      sub: { fontSize: 10, lineHeight: 14 },
      hr: { borderColor: theme.glassBorder, borderWidth: 0.5, marginVertical: 12 },
      /* Table styles — prominent borders */
      table: {
        borderWidth: 1.5,
        borderColor: theme.glassBorder,
        borderRadius: 8,
        marginVertical: 12,
        overflow: "hidden" as const,
      },
      th: {
        backgroundColor: `${theme.primary}18`,
        borderWidth: 1,
        borderColor: theme.glassBorder,
        padding: 8,
        fontWeight: "700" as const,
        color: theme.text,
        fontSize: 13,
      },
      td: {
        borderWidth: 1,
        borderColor: theme.glassBorder,
        padding: 8,
        color: theme.text,
        fontSize: 13,
        verticalAlign: "top" as const,
      },
      tr: {},
      thead: {},
      tbody: {},
      /* Code */
      code: {
        backgroundColor: `${theme.text}12`,
        borderRadius: 4,
        paddingHorizontal: 4,
        fontSize: 13,
        fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
        color: theme.primary,
      },
      pre: {
        backgroundColor: `${theme.text}12`,
        borderRadius: 8,
        padding: 12,
        marginVertical: 8,
        overflow: "hidden" as const,
      },
      img: {
        borderRadius: 12,
        marginVertical: 8,
      },
    }),
    [theme],
  );

  const htmlClassesStyles = useMemo(
    () => ({
      "mm-table": { borderWidth: 1.5, borderColor: theme.glassBorder },
      "mm-link": { color: theme.primary },
    }),
    [theme],
  );

  /* ─── Table plugin: renders HTML tables via WebView for full CSS support ─── */
  const tableWebViewCss = useMemo(
    () => `
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        background-color: transparent;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        margin: 0;
        table-layout: auto;
        border: 1.5px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"};
      }
      thead tr {
        background-color: ${isDark ? "rgba(17,164,212,0.18)" : "rgba(0,153,204,0.12)"};
      }
      th {
        padding: 10px 12px;
        font-weight: 700;
        font-size: 14px;
        color: ${isDark ? "#3dbde8" : "#007aa3"};
        text-align: left;
        border: 1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"};
      }
      td {
        padding: 9px 12px;
        font-size: 13px;
        color: ${isDark ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.88)"};
        border: 1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"};
        vertical-align: top;
      }
      tbody tr:nth-child(odd) {
        background-color: ${isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"};
      }
      tbody tr:nth-child(even) {
        background-color: ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"};
      }
      td strong, th strong {
        color: ${isDark ? "#3dbde8" : "#007aa3"};
        font-weight: 700;
      }
    `,
    [theme, isDark],
  );

  const htmlRenderers = useMemo(
    () => ({
      table: TableRenderer,
    }),
    [],
  );

  const htmlCustomModels = useMemo(
    () => ({
      table: tableModel,
    }),
    [],
  );

  const htmlRenderersProps = useMemo(
    () => ({
      table: {
        animationType: "none" as const,
        cssRules: tableWebViewCss,
        computeContainerHeight(state: any) {
          return state.contentHeight != null ? state.contentHeight + 2 : undefined;
        },
      },
    }),
    [tableWebViewCss],
  );

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
        window.alert(t("Thank you! Your report has been submitted."));
      } else {
        Alert.alert(
          t("Thank you!"),
          t("Your report has been submitted for review."),
        );
      }
    },
    onError: () => {
      if (Platform.OS === "web") {
        window.alert(t("Failed to submit report. Please try again."));
      } else {
        Alert.alert(t("Error"), t("Failed to submit report. Please try again."));
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
      case "html": {
        // Render rich HTML produced by TipTap (tables, lists, formatting, etc.)
        const html = block.content || "";
        if (!html.trim()) return null;
        // Check if the content looks like HTML (contains tags)
        const looksLikeHtml = /<[a-z][\s\S]*>/i.test(html);
        if (!looksLikeHtml) {
          // Plain text fallback
          return (
            <ThemedText
              key={block.id}
              style={[styles.paragraph, { color: theme.textSecondary }]}
            >
              {html}
            </ThemedText>
          );
        }
        return (
          <View key={block.id} style={styles.htmlBlock}>
            <RenderHtml
              contentWidth={contentWidth}
              source={{ html }}
              tagsStyles={htmlTagsStyles}
              classesStyles={htmlClassesStyles}
              renderers={htmlRenderers}
              customHTMLElementModels={htmlCustomModels}
              renderersProps={htmlRenderersProps}
              WebView={WebView}
              enableExperimentalBRCollapsing
              enableExperimentalGhostLinesPrevention
              enableExperimentalMarginCollapsing
              defaultTextProps={{ selectable: true }}
            />
          </View>
        );
      }
      case "image":
        return (
          <Pressable
            key={block.id}
            style={[styles.imageContainer, { borderColor: theme.glassBorder }]}
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
          <View
            key={block.id}
            style={[
              styles.noteContainer,
              {
                backgroundColor: `${theme.purple || "#a855f7"}1A`,
                borderLeftColor: theme.purple || "#a855f7",
              },
            ]}
          >
            <View style={styles.noteIcon}>
              <Feather
                name="info"
                size={16}
                color={theme.purple || "#a855f7"}
              />
            </View>
            <ThemedText style={[styles.noteText, { color: theme.text }]}>
              {block.content}
            </ThemedText>
          </View>
        );
      case "diagram":
        return (
          <MermaidDiagram
            key={block.id}
            code={block.content}
            width={contentWidth}
          />
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
                topic?.isBookmarked ? theme.primary : theme.textSecondary
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
                  backgroundColor: theme.primary,
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
              color={theme.textSecondary}
              style={{ opacity: 0.6 }}
            />
          </Pressable>
        </View>

        {topic?.blocks?.map(renderBlock)}

        {/* Content metadata: last updated, author, references */}
        {(topic?.updatedAt ||
          topic?.author ||
          topic?.source ||
          topic?.references) && (
            <View
              style={[
                styles.metadataSection,
                { borderTopColor: theme.glassBorder },
              ]}
            >
              {(topic?.updatedAt || topic?.author) && (
                <View style={styles.metadataRow}>
                  {topic?.updatedAt && (
                    <View
                      style={[
                        styles.metaBadge,
                        {
                          backgroundColor: theme.glass,
                          borderColor: theme.glassBorder,
                        },
                      ]}
                    >
                      <Feather name="clock" size={12} color={theme.textMuted} />
                      <ThemedText
                        style={[
                          styles.metaBadgeText,
                          { color: theme.textMuted },
                        ]}
                      >
                        Updated{" "}
                        {new Date(topic.updatedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </ThemedText>
                    </View>
                  )}
                  {topic?.author && (
                    <View
                      style={[
                        styles.metaBadge,
                        {
                          backgroundColor: theme.glass,
                          borderColor: theme.glassBorder,
                        },
                      ]}
                    >
                      <Feather name="user" size={12} color={theme.textMuted} />
                      <ThemedText
                        style={[
                          styles.metaBadgeText,
                          { color: theme.textMuted },
                        ]}
                      >
                        {topic.author}
                      </ThemedText>
                    </View>
                  )}
                </View>
              )}
              {topic?.references && (
                <View
                  style={[
                    styles.referencesBox,
                    {
                      backgroundColor: `${theme.primary}15`,
                      borderColor: `${theme.primary}26`,
                    },
                  ]}
                >
                  <View style={styles.referencesHeader}>
                    <Feather
                      name="book-open"
                      size={14}
                      color={theme.primary}
                    />
                    <ThemedText
                      style={[styles.referencesTitle, { color: theme.primary }]}
                    >
                      References
                    </ThemedText>
                  </View>
                  <ThemedText
                    style={[
                      styles.referencesText,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {topic.references}
                  </ThemedText>
                </View>
              )}
              {topic?.source && (
                <View style={styles.sourceRow}>
                  <Feather name="link" size={12} color={theme.textMuted} />
                  <ThemedText
                    style={[styles.sourceText, { color: theme.textMuted }]}
                  >
                    Source: {topic.source}
                  </ThemedText>
                </View>
              )}
            </View>
          )}

        {!topic?.isCompleted ? (
          <PrimaryButton
            title="Mark as Complete"
            onPress={() => markCompleteMutation.mutate()}
            loading={markCompleteMutation.isPending}
            icon="check"
            style={styles.completeButton}
          />
        ) : (
          <View
            style={[
              styles.completedBadge,
              { backgroundColor: `${theme.success}1A` },
            ]}
          >
            <Feather name="check-circle" size={20} color={theme.success} />
            <ThemedText
              style={[styles.completedText, { color: theme.success }]}
            >
              Completed
            </ThemedText>
          </View>
        )}
      </ScrollView>

      <View
        style={[styles.floatingNav, { bottom: insets.bottom + Spacing.lg }]}
      >
        {topic?.previousTopicId ? (
          <Pressable
            style={[
              styles.navButton,
              { backgroundColor: theme.glass, borderColor: theme.glassBorder },
            ]}
            onPress={() =>
              navigation.replace("TopicReader", {
                topicId: topic.previousTopicId!,
                topicTitle: topic?.title || topicTitle,
              })
            }
          >
            <Feather name="chevron-left" size={24} color={theme.text} />
            <ThemedText style={[styles.navButtonText, { color: theme.text }]}>
              Previous
            </ThemedText>
          </Pressable>
        ) : (
          <View style={styles.navButtonPlaceholder} />
        )}
        {topic?.nextTopicId ? (
          <Pressable
            style={[
              styles.navButton,
              styles.navButtonPrimary,
              { backgroundColor: theme.primary, borderColor: theme.primary },
            ]}
            onPress={() =>
              navigation.replace("TopicReader", {
                topicId: topic.nextTopicId!,
                topicTitle: topic?.title || topicTitle,
              })
            }
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
            style={[
              styles.modalContent,
              { backgroundColor: theme.backgroundElevated },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="h3">Report an Error</ThemedText>
              <Pressable onPress={() => setReportVisible(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ThemedText
              style={[styles.modalLabel, { color: theme.textSecondary }]}
            >
              Error Type
            </ThemedText>
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
                    {
                      borderColor: theme.glassBorder,
                      backgroundColor: theme.glass,
                    },
                    reportType === opt.value && {
                      borderColor: theme.primary,
                      backgroundColor: `${theme.primary}26`,
                    },
                  ]}
                  onPress={() => setReportType(opt.value)}
                >
                  <ThemedText
                    style={[
                      styles.reportTypeChipText,
                      { color: theme.textSecondary },
                      reportType === opt.value && {
                        color: theme.primary,
                        fontWeight: "600",
                      },
                    ]}
                  >
                    {opt.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText
              style={[styles.modalLabel, { color: theme.textSecondary }]}
            >
              Description
            </ThemedText>
            <TextInput
              style={[
                styles.reportInput,
                {
                  backgroundColor: theme.glass,
                  borderColor: theme.glassBorder,
                  color: theme.text,
                },
              ]}
              placeholder={t("Describe the error...")}
              placeholderTextColor={theme.textSecondary}
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
  },
  imageContainer: {
    marginVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    borderWidth: 1,
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
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginVertical: Spacing.md,
    borderLeftWidth: 3,
  },
  noteIcon: {
    marginRight: Spacing.md,
    marginTop: 2,
  },
  noteText: {
    flex: 1,
    lineHeight: 22,
  },
  htmlBlock: {
    marginBottom: Spacing.md,
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
    borderRadius: BorderRadius.lg,
  },
  completedText: {
    marginLeft: Spacing.sm,
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
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  navButtonPrimary: {
    // Primary styles handled inline for dynamic support
  },
  navButtonPlaceholder: {
    flex: 1,
  },
  navButtonText: {
    marginLeft: Spacing.xs,
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
  },
  reportTypeChipText: {
    fontSize: 13,
  },
  reportInput: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    fontSize: 15,
    minHeight: 100,
  },
  metadataSection: {
    marginTop: Spacing["2xl"],
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
  },
  metadataRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  metaBadgeText: {
    fontSize: 12,
  },
  referencesBox: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  referencesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  referencesTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  referencesText: {
    fontSize: 13,
    lineHeight: 20,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sourceText: {
    fontSize: 12,
  },
});
