import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  RefreshControl,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics-wrapper";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { EmptyState } from "@/components/EmptyState";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type AttemptHistoryScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

interface Attempt {
  id: string;
  date: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  timeTaken?: number;
  mode: string;
  topicId?: string;
  topicTitle?: string;
}

type FilterMode = "all" | "topic" | "mixed" | "wrong";

export default function AttemptHistoryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<AttemptHistoryScreenNavigationProp>();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterMode>("all");
  const { theme } = useTheme();

  const {
    data: attempts,
    isLoading,
    refetch,
  } = useQuery<Attempt[]>({
    queryKey: [
      "/api/attempts",
      selectedFilter !== "all" ? `mode=${selectedFilter}` : "",
    ],
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleFilterChange = (filter: FilterMode) => {
    setSelectedFilter(filter);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTime = (seconds?: number) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case "topic":
        return "Topic Quiz";
      case "mixed":
        return "Mixed Quiz";
      case "wrong":
        return "Wrong Questions";
      default:
        return mode;
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case "topic":
        return theme.primary;
      case "mixed":
        return theme.info;
      case "wrong":
        return theme.error;
      default:
        return theme.textSecondary;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return theme.success;
    if (score >= 50) return theme.warning;
    return theme.error;
  };

  const filters: { id: FilterMode; label: string }[] = [
    { id: "all", label: "All" },
    { id: "topic", label: "Topic" },
    { id: "mixed", label: "Mixed" },
    { id: "wrong", label: "Wrong" },
  ];

  const renderAttempt = ({ item }: { item: Attempt }) => (
    <GlassCard
      onPress={() =>
        navigation.navigate("AttemptDetail", { attemptId: item.id })
      }
      style={styles.attemptCard}
      testID={`card-attempt-${item.id}`}
    >
      <View style={styles.attemptHeader}>
        <View
          style={[
            styles.modeBadge,
            { backgroundColor: `${getModeColor(item.mode)}20` },
          ]}
        >
          <ThemedText
            style={[styles.modeText, { color: getModeColor(item.mode) }]}
          >
            {getModeLabel(item.mode)}
          </ThemedText>
        </View>
        <View
          style={[
            styles.scoreBadge,
            { backgroundColor: `${getScoreColor(item.score)}20` },
          ]}
        >
          <ThemedText
            style={[styles.scoreText, { color: getScoreColor(item.score) }]}
          >
            {item.score}%
          </ThemedText>
        </View>
      </View>

      {item.topicTitle ? (
        <ThemedText style={[styles.topicTitle, { color: theme.text }]} numberOfLines={1}>
          {item.topicTitle}
        </ThemedText>
      ) : null}

      <View style={styles.attemptStats}>
        <View style={styles.statItem}>
          <Feather name="check-circle" size={14} color={theme.success} />
          <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>{item.correctCount}</ThemedText>
        </View>
        <View style={styles.statItem}>
          <Feather name="x-circle" size={14} color={theme.error} />
          <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>{item.wrongCount}</ThemedText>
        </View>
        <View style={styles.statItem}>
          <Feather name="clock" size={14} color={theme.textSecondary} />
          <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
            {formatTime(item.timeTaken)}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.attemptFooter, { borderTopColor: theme.glass }]}>
        <ThemedText style={[styles.dateText, { color: theme.textMuted }]}>{formatDate(item.date)}</ThemedText>
        <Feather name="chevron-right" size={16} color={theme.textMuted} />
      </View>
    </GlassCard>
  );

  const renderEmpty = () => (
    <EmptyState
      image={require("../../assets/images/empty-progress.png")}
      title="No Quiz Attempts"
      description="Complete quizzes to see your attempt history here."
    />
  );

  const renderLoading = () => (
    <View>
      {[1, 2, 3, 4].map((i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );

  return (
    <BackgroundGradient>
      <FlatList
        data={attempts || []}
        renderItem={renderAttempt}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
          (!attempts || attempts.length === 0) &&
            !isLoading &&
            styles.emptyList,
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.filterRow}>
              {filters.map((filter) => (
                <Pressable
                  key={filter.id}
                  onPress={() => handleFilterChange(filter.id)}
                  style={[
                    styles.filterChip,
                    { backgroundColor: selectedFilter === filter.id ? theme.primary : theme.glass },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.filterText,
                      { color: theme.textSecondary },
                      selectedFilter === filter.id && styles.filterTextSelected,
                    ]}
                  >
                    {filter.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={isLoading ? renderLoading() : renderEmpty()}
      />
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  emptyList: {
    flex: 1,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  filterText: {
    fontSize: 13,
  },
  filterTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  attemptCard: {
    marginBottom: Spacing.md,
  },
  attemptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  modeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  modeText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  scoreBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: "700",
  },
  topicTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  attemptStats: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: Spacing.lg,
  },
  statText: {
    fontSize: 13,
    marginLeft: Spacing.xs,
  },
  attemptFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  dateText: {
    fontSize: 12,
  },
});
