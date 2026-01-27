import React from "react";
import { StyleSheet, View, ScrollView, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { StatCard } from "@/components/StatCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { LoadingSkeleton, CardSkeleton } from "@/components/LoadingSkeleton";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type TopicProgressDetailRouteProp = RouteProp<RootStackParamList, "TopicProgressDetail">;
type TopicProgressDetailNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface RecentAttempt {
  id: string;
  date: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  totalQuestions: number;
}

interface TopicProgressData {
  topicId: string;
  topicTitle: string;
  chapterTitle: string;
  totalAttempts: number;
  averageScore: number;
  bestScore: number;
  lastAttempt: string | null;
  accuracyTrend: { date: string; score: number }[];
  recentAttempts: RecentAttempt[];
}

const { width: screenWidth } = Dimensions.get("window");
const chartWidth = screenWidth - (Spacing.lg * 2) - 32;

export default function TopicProgressDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<TopicProgressDetailNavigationProp>();
  const route = useRoute<TopicProgressDetailRouteProp>();
  const { topicId, topicTitle } = route.params;

  const { data: progress, isLoading } = useQuery<TopicProgressData>({
    queryKey: ["/api/progress/topic", topicId],
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return Colors.dark.success;
    if (score >= 50) return Colors.dark.warning;
    return Colors.dark.error;
  };

  const renderTrendChart = () => {
    if (!progress?.accuracyTrend || progress.accuracyTrend.length === 0) {
      return (
        <View style={styles.noChartData}>
          <ThemedText style={styles.noChartText}>No data to display</ThemedText>
        </View>
      );
    }

    const data = progress.accuracyTrend.slice(-10);
    const maxScore = 100;
    const chartHeight = 120;

    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartYAxis}>
          <ThemedText style={styles.chartAxisLabel}>100%</ThemedText>
          <ThemedText style={styles.chartAxisLabel}>50%</ThemedText>
          <ThemedText style={styles.chartAxisLabel}>0%</ThemedText>
        </View>
        <View style={styles.chartArea}>
          <View style={styles.chartGrid}>
            <View style={styles.chartGridLine} />
            <View style={styles.chartGridLine} />
            <View style={styles.chartGridLine} />
          </View>
          <View style={styles.chartBars}>
            {data.map((point, index) => {
              const barHeight = (point.score / maxScore) * chartHeight;
              return (
                <View key={index} style={styles.chartBarContainer}>
                  <View style={[styles.chartBar, { height: barHeight }]}>
                    <LinearGradient
                      colors={[getScoreColor(point.score), `${getScoreColor(point.score)}80`]}
                      style={StyleSheet.absoluteFill}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                    />
                  </View>
                  <ThemedText style={styles.chartBarLabel}>
                    {formatDate(point.date)}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
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
          <LoadingSkeleton width="60%" height={24} style={{ marginBottom: 8 }} />
          <LoadingSkeleton width="40%" height={16} style={{ marginBottom: 24 }} />
          <View style={styles.statsRow}>
            <CardSkeleton />
          </View>
          <CardSkeleton />
          <CardSkeleton />
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
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <View style={styles.header}>
          <ThemedText type="h3" style={styles.topicTitle}>
            {progress?.topicTitle || topicTitle}
          </ThemedText>
          <ThemedText style={styles.chapterTitle}>
            {progress?.chapterTitle}
          </ThemedText>
        </View>

        <View style={styles.statsRow}>
          <StatCard
            label="Total Attempts"
            value={progress?.totalAttempts || 0}
            icon="activity"
            color={Colors.dark.primary}
          />
          <View style={{ width: Spacing.md }} />
          <StatCard
            label="Avg Score"
            value={`${progress?.averageScore || 0}%`}
            icon="trending-up"
            color={Colors.dark.info}
          />
          <View style={{ width: Spacing.md }} />
          <StatCard
            label="Best Score"
            value={`${progress?.bestScore || 0}%`}
            icon="award"
            color={Colors.dark.success}
          />
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>ACCURACY TREND</ThemedText>
          <GlassCard style={styles.chartCard}>
            {renderTrendChart()}
          </GlassCard>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>RECENT ATTEMPTS</ThemedText>
          {progress?.recentAttempts && progress.recentAttempts.length > 0 ? (
            progress.recentAttempts.map((attempt) => (
              <GlassCard
                key={attempt.id}
                onPress={() => navigation.navigate("AttemptDetail", { attemptId: attempt.id })}
                style={styles.attemptCard}
              >
                <View style={styles.attemptRow}>
                  <View style={styles.attemptInfo}>
                    <ThemedText style={styles.attemptDate}>
                      {formatFullDate(attempt.date)}
                    </ThemedText>
                    <View style={styles.attemptStats}>
                      <View style={styles.attemptStat}>
                        <Feather name="check" size={12} color={Colors.dark.success} />
                        <ThemedText style={styles.attemptStatText}>
                          {attempt.correctCount}/{attempt.totalQuestions}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.scoreBadge,
                      { backgroundColor: `${getScoreColor(attempt.score)}20` },
                    ]}
                  >
                    <ThemedText
                      style={[styles.scoreText, { color: getScoreColor(attempt.score) }]}
                    >
                      {attempt.score}%
                    </ThemedText>
                  </View>
                </View>
              </GlassCard>
            ))
          ) : (
            <View style={styles.noAttempts}>
              <ThemedText style={styles.noAttemptsText}>
                No attempts yet for this topic
              </ThemedText>
            </View>
          )}
        </View>

        <View style={styles.actionSection}>
          <PrimaryButton
            title="Practice This Topic"
            onPress={() => navigation.navigate("QuizPlayer", { mode: "topic", topicId })}
            icon="play"
            testID="button-practice-topic"
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
  header: {
    marginBottom: Spacing["2xl"],
  },
  topicTitle: {
    marginBottom: Spacing.xs,
  },
  chapterTitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  statsRow: {
    flexDirection: "row",
    marginBottom: Spacing["2xl"],
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
  chartCard: {
    padding: Spacing.md,
  },
  chartContainer: {
    flexDirection: "row",
    height: 160,
  },
  chartYAxis: {
    width: 40,
    justifyContent: "space-between",
    paddingBottom: 20,
  },
  chartAxisLabel: {
    fontSize: 10,
    color: Colors.dark.textMuted,
  },
  chartArea: {
    flex: 1,
  },
  chartGrid: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 20,
    justifyContent: "space-between",
  },
  chartGridLine: {
    height: 1,
    backgroundColor: Colors.dark.glass,
  },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    height: 140,
    paddingBottom: 20,
  },
  chartBarContainer: {
    alignItems: "center",
    flex: 1,
  },
  chartBar: {
    width: 16,
    borderRadius: 4,
    overflow: "hidden",
  },
  chartBarLabel: {
    fontSize: 8,
    color: Colors.dark.textMuted,
    marginTop: 4,
  },
  noChartData: {
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  noChartText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  attemptCard: {
    marginBottom: Spacing.sm,
  },
  attemptRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  attemptInfo: {
    flex: 1,
  },
  attemptDate: {
    fontSize: 14,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  attemptStats: {
    flexDirection: "row",
  },
  attemptStat: {
    flexDirection: "row",
    alignItems: "center",
  },
  attemptStatText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginLeft: 4,
  },
  scoreBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: "700",
  },
  noAttempts: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  noAttemptsText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  actionSection: {
    marginTop: Spacing.lg,
  },
});
