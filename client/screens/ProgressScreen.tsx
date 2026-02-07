import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  RefreshControl,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { StatCard } from "@/components/StatCard";
import { ProgressBar } from "@/components/ProgressBar";
import { EmptyState } from "@/components/EmptyState";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type ProgressScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

interface ProgressData {
  totalAttempts: number;
  averageAccuracy: number;
  topicsCompleted: number;
  totalTopics: number;
  topicProgress: {
    id: string;
    title: string;
    accuracy: number;
    attempts: number;
  }[];
  recentAttempts: {
    id: string;
    date: string;
    score: number;
    mode: string;
    topicTitle?: string;
  }[];
}

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<ProgressScreenNavigationProp>();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: progress,
    isLoading,
    refetch,
  } = useQuery<ProgressData>({
    queryKey: ["/api/progress"],
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
          <View style={styles.statsRow}>
            <CardSkeleton />
          </View>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </ScrollView>
      </BackgroundGradient>
    );
  }

  if (!progress?.totalAttempts) {
    return (
      <BackgroundGradient>
        <View style={[styles.emptyContainer, { paddingTop: headerHeight }]}>
          <EmptyState
            image={require("../../assets/images/empty-progress.png")}
            title="No Progress Yet"
            description="Start practicing MCQs to track your learning progress and improvement over time."
          />
        </View>
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
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.dark.primary}
          />
        }
      >
        <View style={styles.statsRow}>
          <StatCard
            label="Total Attempts"
            value={progress.totalAttempts}
            icon="activity"
            color={Colors.dark.primary}
          />
          <View style={{ width: Spacing.md }} />
          <StatCard
            label="Avg Accuracy"
            value={`${progress.averageAccuracy}%`}
            icon="target"
            color={Colors.dark.success}
          />
          <View style={{ width: Spacing.md }} />
          <StatCard
            label="Topics Done"
            value={`${progress.topicsCompleted}/${progress.totalTopics}`}
            icon="book"
            color={Colors.dark.info}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionLabel}>TOPIC ACCURACY</ThemedText>
          </View>
          {progress.topicProgress.map((topic) => (
            <Pressable
              key={topic.id}
              onPress={() =>
                navigation.navigate("TopicProgressDetail", {
                  topicId: topic.id,
                  topicTitle: topic.title,
                })
              }
              style={styles.topicRow}
            >
              <View style={styles.topicInfo}>
                <ThemedText style={styles.topicTitle} numberOfLines={1}>{topic.title}</ThemedText>
                <ThemedText style={styles.topicAttempts}>
                  {topic.attempts} attempts
                </ThemedText>
              </View>
              <View style={styles.topicProgress}>
                <ProgressBar
                  progress={topic.accuracy}
                  height={6}
                  style={{ flex: 1, marginRight: Spacing.md }}
                />
                <ThemedText style={styles.topicAccuracy}>
                  {topic.accuracy}%
                </ThemedText>
                <Feather
                  name="chevron-right"
                  size={16}
                  color={Colors.dark.textMuted}
                  style={{ marginLeft: Spacing.sm }}
                />
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionLabel}>RECENT ATTEMPTS</ThemedText>
            <Pressable onPress={() => navigation.navigate("AttemptHistory")}>
              <ThemedText style={styles.viewAllText}>View All</ThemedText>
            </Pressable>
          </View>
          {progress.recentAttempts.map((attempt) => (
            <GlassCard
              key={attempt.id}
              onPress={() =>
                navigation.navigate("AttemptDetail", { attemptId: attempt.id })
              }
              style={styles.attemptCard}
            >
              <View style={styles.attemptHeader}>
                <View style={styles.attemptInfo}>
                  <ThemedText style={styles.attemptMode} numberOfLines={1}>
                    {attempt.mode === "topic"
                      ? attempt.topicTitle
                      : attempt.mode === "mixed"
                        ? "Mixed Quiz"
                        : "Wrong Questions"}
                  </ThemedText>
                  <ThemedText style={styles.attemptDate}>
                    {formatDate(attempt.date)}
                  </ThemedText>
                </View>
                <View
                  style={[
                    styles.scoreBadge,
                    {
                      backgroundColor:
                        attempt.score >= 80
                          ? "rgba(34,197,94,0.2)"
                          : attempt.score >= 50
                            ? "rgba(234,179,8,0.2)"
                            : "rgba(239,68,68,0.2)",
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.scoreText,
                      {
                        color:
                          attempt.score >= 80
                            ? Colors.dark.success
                            : attempt.score >= 50
                              ? Colors.dark.warning
                              : Colors.dark.error,
                      },
                    ]}
                  >
                    {attempt.score}%
                  </ThemedText>
                </View>
              </View>
            </GlassCard>
          ))}
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
  emptyContainer: {
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    marginBottom: Spacing["2xl"],
  },
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 1.5,
    color: Colors.dark.textMuted,
  },
  viewAllText: {
    fontSize: 13,
    color: Colors.dark.primary,
    fontWeight: "500",
  },
  topicRow: {
    marginBottom: Spacing.lg,
  },
  topicInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  topicTitle: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    marginRight: Spacing.sm,
  },
  topicAttempts: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  topicProgress: {
    flexDirection: "row",
    alignItems: "center",
  },
  topicAccuracy: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.primary,
    width: 40,
    textAlign: "right",
  },
  attemptCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  attemptHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  attemptInfo: {
    flex: 1,
  },
  attemptMode: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  attemptDate: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  scoreBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
