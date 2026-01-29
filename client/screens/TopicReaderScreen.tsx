import React, { useState, useCallback } from "react";
import { StyleSheet, View, ScrollView, Pressable } from "react-native";
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
              name={topic?.isBookmarked ? "bookmark" : "bookmark"}
              size={24}
              color={
                topic?.isBookmarked
                  ? Colors.dark.primary
                  : Colors.dark.textSecondary
              }
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
});
