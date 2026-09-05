import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  RefreshControl,
  Pressable,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics-wrapper";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { ProgressBar } from "@/components/ProgressBar";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/lib/auth";
import { LearnStackParamList } from "@/navigation/LearnStackNavigator";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useBottomLayout } from "@/hooks/useBottomLayout";

type SubtopicsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
type SubtopicsScreenRouteProp = RouteProp<LearnStackParamList, "Subtopics">;

interface SubtopicItem {
  id: string;
  topicId: string;
  title: string;
  description: string | null;
  order: number;
  isPublished: boolean;
  isPaid: boolean;
  estimatedMinutes: number;
  isCompleted: boolean;
  isBookmarked: boolean;
}

interface TopicDetailResponse {
  topic: {
    id: string;
    title: string;
    description: string | null;
    bookId: string | null;
    chapterId: string | null;
    isPaid: boolean;
    progress: number;
    completedCount: number;
    totalCount: number;
    isCompleted: boolean;
  };
  subtopics: SubtopicItem[];
}

export default function SubtopicsScreen() {
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<SubtopicsScreenNavigationProp>();
  const route = useRoute<SubtopicsScreenRouteProp>();
  const { topicId, topicTitle, bookId } = route.params;

  const [refreshing, setRefreshing] = useState(false);
  const { theme } = useTheme();
  const { user } = useAuth();
  const bottomLayout = useBottomLayout({ extraContentPadding: Spacing.xl });

  const {
    data,
    isLoading,
    refetch,
  } = useQuery<TopicDetailResponse>({
    queryKey: ["/api/topics", topicId, "subtopics"],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: true,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleSubtopicPress = (item: SubtopicItem) => {
    Haptics.selectionAsync();
    const hasActiveSubscription = user?.subscriptionStatus === "active";
    if (item.isPaid && !hasActiveSubscription) {
      navigation.navigate("Paywall");
      return;
    }

    navigation.navigate("TopicReader", {
      subtopicId: item.id,
      subtopicTitle: item.title,
      topicId,
      topicTitle,
    });
  };

  const handleStartQuiz = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("QuizPlayer", {
      topicId,
      mode: "topic",
    });
  };

  const topicInfo = data?.topic;
  const subtopicsList = data?.subtopics || [];

  const renderHeader = () => {
    const progress = topicInfo?.progress ?? 0;
    const completedCount = topicInfo?.completedCount ?? 0;
    const totalCount = topicInfo?.totalCount ?? subtopicsList.length;

    return (
      <View style={styles.headerContainer}>
        <View style={styles.topicMetaContainer}>
          <ThemedText style={[styles.sectionLabel, { color: theme.primary }]}>
            TOPIC
          </ThemedText>
          <ThemedText type="h2" style={styles.headerTitle}>
            {topicInfo?.title || topicTitle}
          </ThemedText>
          {topicInfo?.description ? (
            <ThemedText
              type="small"
              style={[styles.headerDescription, { color: theme.textSecondary }]}
            >
              {topicInfo.description}
            </ThemedText>
          ) : null}
        </View>

        {/* Topic Progress Card */}
        <View
          style={[
            styles.progressCard,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.glassBorder,
            },
          ]}
        >
          <View style={styles.progressCardHeader}>
            <View style={styles.progressLabelGroup}>
              <Feather name="check-circle" size={16} color={theme.primary} />
              <ThemedText style={styles.progressText}>
                {completedCount} of {totalCount} completed
              </ThemedText>
            </View>
            <ThemedText style={[styles.progressPercent, { color: theme.primary }]}>
              {progress}%
            </ThemedText>
          </View>
          <ProgressBar progress={progress} style={styles.progressBar} />
        </View>

        {/* Quiz Shortcut Action */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={handleStartQuiz}
            style={({ pressed }) => [
              styles.quizButton,
              {
                backgroundColor: theme.cyanGlow,
                borderColor: theme.primary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather name="help-circle" size={16} color={theme.primary} />
            <ThemedText style={[styles.quizButtonText, { color: theme.primary }]}>
              Practice Topic MCQs
            </ThemedText>
          </Pressable>
        </View>

        <ThemedText
          style={[
            styles.sectionHeader,
            { color: theme.textSecondary, marginTop: Spacing.lg },
          ]}
        >
          SUBTOPICS ({subtopicsList.length})
        </ThemedText>
      </View>
    );
  };

  const renderSubtopic = ({
    item,
    index,
  }: {
    item: SubtopicItem;
    index: number;
  }) => {
    const isPaid = item.isPaid;
    const minutes = item.estimatedMinutes || 3;

    return (
      <GlassCard
        title={item.title}
        subtitle={`${minutes} min read`}
        density="compact"
        titleNumberOfLines={2}
        subtitleNumberOfLines={1}
        onPress={() => handleSubtopicPress(item)}
        icon={
          item.isCompleted ? (
            <View
              style={[styles.completedIcon, { backgroundColor: theme.success }]}
            >
              <Feather name="check" size={16} color="#fff" />
            </View>
          ) : (
            <View
              style={[
                styles.numberPill,
                { backgroundColor: theme.glassHover, borderColor: theme.glassBorder },
              ]}
            >
              <ThemedText style={[styles.numberText, { color: theme.primary }]}>
                {index + 1}
              </ThemedText>
            </View>
          )
        }
        rightElement={
          <View style={styles.rightElements}>
            {isPaid ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: theme.warningGlow },
                ]}
              >
                <Feather name="star" size={10} color={theme.warning} />
                <ThemedText
                  style={[styles.badgeText, { color: theme.warning }]}
                >
                  Premium
                </ThemedText>
              </View>
            ) : null}
            {item.isBookmarked ? (
              <Feather name="bookmark" size={18} color={theme.primary} />
            ) : null}
            <Feather name="chevron-right" size={18} color={theme.textMuted} />
          </View>
        }
        testID={`card-subtopic-${item.id}`}
        style={styles.subtopicCard}
      />
    );
  };

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      {[1, 2, 3, 4, 5].map((i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );

  return (
    <BackgroundGradient>
      <FlatList
        data={subtopicsList}
        renderItem={renderSubtopic}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: bottomLayout.contentBottomInset,
          },
        ]}
        scrollIndicatorInsets={{
          bottom: bottomLayout.scrollIndicatorBottomInset,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={isLoading ? renderLoading() : null}
      />
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  headerContainer: {
    marginBottom: Spacing.md,
  },
  topicMetaContainer: {
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: Spacing.xs,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  headerDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  progressCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  progressCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  progressLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  progressText: {
    fontSize: 13,
    fontWeight: "600",
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: "700",
  },
  progressBar: {
    marginTop: Spacing.xs,
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  quizButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  quizButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
  },
  subtopicCard: {
    marginBottom: Spacing.sm,
  },
  numberPill: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  numberText: {
    fontSize: 12,
    fontWeight: "700",
  },
  completedIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  rightElements: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    marginLeft: 3,
  },
  loadingContainer: {
    marginTop: Spacing.sm,
  },
});
