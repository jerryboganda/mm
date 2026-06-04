import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import RenderHtml from "react-native-render-html";
import TableRenderer, { tableModel } from "@native-html/table-plugin";
import WebView from "react-native-webview";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics-wrapper";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { AppModalSurface } from "@/components/AppModalSurface";
import { PrimaryButton } from "@/components/PrimaryButton";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ThemedText } from "@/components/ThemedText";
import { ImageViewer } from "@/components/ImageViewer";
import { useMobileContent } from "@/lib/mobile-content";
import { apiRequest, queryClient } from "@/lib/query-client";
import { enqueueMutationIfOffline } from "@/lib/mutation-queue";
import { useNetwork } from "@/lib/network";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useFeedback } from "@/lib/feedback";
import { useBottomLayout } from "@/hooks/useBottomLayout";

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
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<TopicReaderNavigationProp>();
  const route = useRoute<TopicReaderRouteProp>();
  const { topicId, topicTitle } = route.params;
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportType, setReportType] = useState<string>("factual_error");
  const [reportDescription, setReportDescription] = useState("");
  const { theme, isDark } = useTheme();
  const feedback = useFeedback();
  const { isOffline } = useNetwork();
  const { readerWatermark, resolveText } = useMobileContent();
  const t = resolveText;
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = windowWidth - Spacing.lg * 2;
  const watermarkSize = Math.min(windowWidth * 0.68, 280);
  const bottomLayout = useBottomLayout({
    footerHeight: 56,
    footerSpacing: Spacing["3xl"],
    anchorSpacing: Spacing.lg,
  });

  const { data: topic, isLoading } = useQuery<TopicDetail>({
    queryKey: ["/api/topics", topicId],
  });

  /* ─── HTML rendering configuration for react-native-render-html ─── */
  const htmlTagsStyles = useMemo(
    () => ({
      body: { color: theme.text, fontSize: 15, lineHeight: 24 },
      p: {
        marginTop: 0,
        marginBottom: 6,
        color: theme.text,
        fontSize: 15,
        lineHeight: 24,
      },
      h1: {
        fontSize: 24,
        lineHeight: 30,
        fontWeight: "700" as const,
        color: theme.text,
        marginTop: 0,
        marginBottom: 6,
      },
      h2: {
        fontSize: 20,
        lineHeight: 26,
        fontWeight: "700" as const,
        color: theme.text,
        marginTop: 0,
        marginBottom: 5,
      },
      h3: {
        fontSize: 17,
        lineHeight: 23,
        fontWeight: "700" as const,
        color: theme.text,
        marginTop: 0,
        marginBottom: 4,
      },
      strong: { fontWeight: "700" as const, color: theme.text },
      b: { fontWeight: "700" as const },
      em: { fontStyle: "italic" as const },
      u: { textDecorationLine: "underline" as const },
      s: { textDecorationLine: "line-through" as const },
      mark: { backgroundColor: `${theme.warning}26`, color: theme.text },
      span: { color: theme.text },
      a: {
        color: theme.primary,
        textDecorationLine: "underline" as const,
      },
      ul: { paddingLeft: 18, marginTop: 0, marginBottom: 6 },
      ol: { paddingLeft: 18, marginTop: 0, marginBottom: 6 },
      li: {
        marginBottom: 4,
        color: theme.text,
        fontSize: 15,
        lineHeight: 24,
      },
      blockquote: {
        borderLeftWidth: 3,
        borderLeftColor: theme.primary,
        paddingLeft: 12,
        fontStyle: "italic" as const,
        color: theme.textSecondary,
        marginTop: 0,
        marginBottom: 8,
      },
      sup: { fontSize: 10, lineHeight: 14 },
      sub: { fontSize: 10, lineHeight: 14 },
      hr: {
        borderColor: theme.glassBorder,
        borderWidth: 0.5,
        marginVertical: 12,
      },
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
        lineHeight: 19,
      },
      td: {
        borderWidth: 1,
        borderColor: theme.glassBorder,
        padding: 8,
        color: theme.text,
        fontSize: 13,
        lineHeight: 19,
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
        lineHeight: 18,
        fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
        color: theme.primary,
      },
      pre: {
        backgroundColor: `${theme.text}12`,
        borderRadius: 8,
        padding: 12,
        marginVertical: 8,
        color: theme.text,
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
        color: ${theme.text};
        font-size: 15px;
        line-height: 1.6;
        overflow-x: auto;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        min-width: 100%;
        margin: 0;
        table-layout: auto;
        border: 1.5px solid ${theme.glassBorderLight};
      }
      thead tr {
        background-color: ${theme.primary}${isDark ? "2E" : "1F"};
      }
      th {
        padding: 10px 12px;
        font-weight: 700;
        font-size: 14px;
        line-height: 1.4;
        color: ${isDark ? theme.primaryLight : theme.primaryDark};
        text-align: left;
        border: 1px solid ${theme.glassBorder};
      }
      td {
        padding: 9px 12px;
        font-size: 13px;
        line-height: 1.45;
        color: ${theme.text};
        border: 1px solid ${theme.glassBorder};
        vertical-align: top;
      }
      td p, th p {
        margin: 0 0 6px;
      }
      td p:last-child, th p:last-child {
        margin-bottom: 0;
      }
      tbody tr:nth-child(odd) {
        background-color: transparent;
      }
      tbody tr:nth-child(even) {
        background-color: ${theme.glass};
      }
      td strong, th strong {
        color: ${isDark ? theme.primaryLight : theme.primaryDark};
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
        webViewProps: {
          style: {
            backgroundColor: "transparent",
            opacity: 0.99, // Workaround for Android WebView transparency
          },
        },
        computeContainerHeight(state: any) {
          return state.contentHeight != null
            ? state.contentHeight + 2
            : undefined;
        },
      },
    }),
    [tableWebViewCss],
  );

  const bookmarkMutation = useMutation({
    mutationFn: async () => {
      const route = `/api/topics/${topicId}/bookmark`;
      const queued = await enqueueMutationIfOffline("POST", route);
      if (!queued) {
        await apiRequest("POST", route);
      }
    },
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/topics", topicId] });
      // Snapshot previous value
      const previous = queryClient.getQueryData<TopicDetail>([
        "/api/topics",
        topicId,
      ]);
      const wasBookmarked = previous?.isBookmarked ?? false;
      // Optimistic toggle
      if (previous) {
        queryClient.setQueryData<TopicDetail>(["/api/topics", topicId], {
          ...previous,
          isBookmarked: !previous.isBookmarked,
        });
      }
      return { previous, wasBookmarked };
    },
    onError: (_err, _vars, context) => {
      // Rollback
      if (context?.previous) {
        queryClient.setQueryData(["/api/topics", topicId], context.previous);
      }
    },
    onSettled: (_data, _error, _vars, context) => {
      if (!isOffline) {
        queryClient.invalidateQueries({ queryKey: ["/api/topics", topicId] });
      }
      // Adding bookmark → success haptic; removing → light tap
      if (context?.wasBookmarked) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      feedback.playSound("tap");
    },
  });

  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      const route = `/api/topics/${topicId}/complete`;
      const queued = await enqueueMutationIfOffline("POST", route);
      if (!queued) {
        await apiRequest("POST", route);
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["/api/topics", topicId] });
      const previous = queryClient.getQueryData<TopicDetail>([
        "/api/topics",
        topicId,
      ]);
      if (previous) {
        queryClient.setQueryData<TopicDetail>(["/api/topics", topicId], {
          ...previous,
          isCompleted: true,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/topics", topicId], context.previous);
      }
    },
    onSettled: () => {
      if (!isOffline) {
        queryClient.invalidateQueries({ queryKey: ["/api/topics", topicId] });
        queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      feedback.playSound("success");
    },
  });

  const markUncompleteMutation = useMutation({
    mutationFn: async () => {
      const route = `/api/topics/${topicId}/uncomplete`;
      const queued = await enqueueMutationIfOffline("POST", route);
      if (!queued) {
        await apiRequest("POST", route);
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["/api/topics", topicId] });
      const previous = queryClient.getQueryData<TopicDetail>([
        "/api/topics",
        topicId,
      ]);
      if (previous) {
        queryClient.setQueryData<TopicDetail>(["/api/topics", topicId], {
          ...previous,
          isCompleted: false,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/topics", topicId], context.previous);
      }
    },
    onSettled: () => {
      if (!isOffline) {
        queryClient.invalidateQueries({ queryKey: ["/api/topics", topicId] });
        queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      feedback.playSound("tap");
    },
  });

  const reportMutation = useMutation({
    mutationFn: async () => {
      if (isOffline) {
        throw new Error("OFFLINE");
      }
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
    onError: (error) => {
      const msg =
        (error as Error)?.message === "OFFLINE"
          ? t(
              "Report submission requires an internet connection. Please try again when you're online.",
            )
          : t("Failed to submit report. Please try again.");
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert(t("Error"), msg);
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
            accessibilityRole="button"
            accessibilityLabel="View image fullscreen"
            accessibilityHint="Opens image in fullscreen viewer"
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
      {readerWatermark.enabled ? (
        <View
          pointerEvents="none"
          style={[
            styles.readerWatermark,
            {
              width: watermarkSize,
              height: watermarkSize,
              marginLeft: -watermarkSize / 2,
              marginTop: -watermarkSize / 2,
              opacity: readerWatermark.opacity,
            },
          ]}
        >
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.readerWatermarkImage}
            contentFit="contain"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </View>
      ) : null}
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: bottomLayout.contentBottomInset,
          },
        ]}
        scrollIndicatorInsets={{
          bottom: bottomLayout.scrollIndicatorBottomInset,
        }}
      >
        <View style={styles.header}>
          <ThemedText type="h2" style={styles.title} accessibilityRole="header">
            {topic?.title || topicTitle}
          </ThemedText>
          <Pressable
            onPress={() => bookmarkMutation.mutate()}
            style={styles.bookmarkButton}
            accessibilityRole="button"
            accessibilityLabel={
              topic?.isBookmarked ? "Remove bookmark" : "Add bookmark"
            }
            accessibilityState={{ selected: topic?.isBookmarked }}
          >
            <Feather
              name="bookmark"
              size={24}
              color={topic?.isBookmarked ? theme.primary : theme.textSecondary}
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
                      style={[styles.metaBadgeText, { color: theme.textMuted }]}
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
                      style={[styles.metaBadgeText, { color: theme.textMuted }]}
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
                  <Feather name="book-open" size={14} color={theme.primary} />
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
          <Pressable
            onPress={() => markUncompleteMutation.mutate()}
            disabled={markUncompleteMutation.isPending}
            style={({ pressed }) => [
              styles.completedBadge,
              {
                backgroundColor: `${theme.success}1A`,
                opacity: pressed
                  ? 0.6
                  : markUncompleteMutation.isPending
                    ? 0.5
                    : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Mark for revision"
            accessibilityHint="Tap to mark this topic as not completed"
          >
            <Feather name="check-circle" size={20} color={theme.success} />
            <ThemedText
              style={[styles.completedText, { color: theme.success }]}
            >
              {markUncompleteMutation.isPending ? "Removing..." : "Completed"}
            </ThemedText>
            <ThemedText
              style={[styles.tapToRevise, { color: theme.textMuted }]}
            >
              Tap to mark for revision
            </ThemedText>
          </Pressable>
        )}
      </ScrollView>

      <View
        style={[
          styles.floatingNav,
          { bottom: bottomLayout.bottomAnchorOffset },
        ]}
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
            accessibilityRole="button"
            accessibilityLabel="Previous topic"
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
            accessibilityRole="button"
            accessibilityLabel="Next topic"
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
      <AppModalSurface
        visible={reportVisible}
        variant="sheet"
        onClose={() => setReportVisible(false)}
        dismissible={!reportMutation.isPending}
        scrollable
        accessibilityLabel="Report an error"
        footer={
          <PrimaryButton
            title="Submit Report"
            onPress={() => reportMutation.mutate()}
            loading={reportMutation.isPending}
            icon="send"
            disabled={
              !reportDescription.trim() || reportDescription.trim().length < 3
            }
          />
        }
      >
        <View style={styles.modalHeader}>
          <ThemedText type="h3" accessibilityRole="header">
            Report an Error
          </ThemedText>
        </View>

        <ThemedText style={[styles.modalLabel, { color: theme.textSecondary }]}>
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
                  backgroundColor: theme.backgroundSecondary,
                },
                reportType === opt.value && {
                  borderColor: theme.primary,
                  backgroundColor: `${theme.primary}26`,
                },
              ]}
              onPress={() => setReportType(opt.value)}
              accessibilityRole="radio"
              accessibilityLabel={`Error type: ${opt.label}`}
              accessibilityState={{ selected: reportType === opt.value }}
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

        <ThemedText style={[styles.modalLabel, { color: theme.textSecondary }]}>
          Description
        </ThemedText>
        <TextInput
          style={[
            styles.reportInput,
            {
              backgroundColor: theme.backgroundSecondary,
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
          accessibilityLabel="Error description"
          accessibilityHint="Describe the error you found in this topic"
        />
      </AppModalSurface>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  readerWatermark: {
    position: "absolute",
    left: "50%",
    top: "48%",
  },
  readerWatermarkImage: {
    width: "100%",
    height: "100%",
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  title: {
    flex: 1,
    marginRight: Spacing.md,
  },
  bookmarkButton: {
    padding: Spacing.sm,
  },
  heading: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  paragraph: {
    marginBottom: Spacing.md,
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
    flexWrap: "wrap",
    marginTop: Spacing["2xl"],
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  completedText: {
    marginLeft: Spacing.sm,
    fontWeight: "600",
  },
  tapToRevise: {
    width: "100%",
    textAlign: "center",
    marginTop: Spacing.xs,
    fontSize: 12,
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
