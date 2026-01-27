import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/lib/auth";
import { Colors, Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";
import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";

type NavigationProp = NativeStackNavigationProp<HomeStackParamList>;

type StatCardData = {
  id: string;
  label: string;
  value: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
};

type RecommendedTopic = {
  id: string;
  title: string;
  chapterTitle: string;
  bookTitle: string;
  progress: number;
};

function StatCard({ item }: { item: StatCardData }) {
  const { theme } = useTheme();

  return (
    <View style={[styles.statCard, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}>
      <View style={[styles.statIconContainer, { backgroundColor: `${item.color}20` }]}>
        <Feather name={item.icon} size={18} color={item.color} />
      </View>
      <Text style={[styles.statValue, { color: theme.text }]}>{item.value}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{item.label}</Text>
    </View>
  );
}

function ContinueLearningCard({
  topic,
  onPress,
}: {
  topic: RecommendedTopic;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      style={[styles.continueCard, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}
      onPress={onPress}
    >
      <View style={styles.continueContent}>
        <Text style={[styles.continueLabel, { color: theme.primary }]}>CONTINUE LEARNING</Text>
        <Text style={[styles.continueTitle, { color: theme.text }]} numberOfLines={1}>
          {topic.title}
        </Text>
        <Text style={[styles.continueSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
          {topic.chapterTitle} - {topic.bookTitle}
        </Text>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: theme.glassBorder }]}>
            <View
              style={[styles.progressFill, { width: `${topic.progress}%`, backgroundColor: theme.primary }]}
            />
          </View>
          <Text style={[styles.progressText, { color: theme.textMuted }]}>{topic.progress}%</Text>
        </View>
      </View>
      <View style={[styles.continueArrow, { backgroundColor: theme.primary }]}>
        <Feather name="arrow-right" size={20} color="#fff" />
      </View>
    </Pressable>
  );
}

function RecommendedCard({
  topic,
  onPress,
}: {
  topic: RecommendedTopic;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      style={[styles.recommendedCard, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}
      onPress={onPress}
    >
      <View style={styles.recommendedIcon}>
        <Feather name="book-open" size={16} color={theme.primary} />
      </View>
      <View style={styles.recommendedContent}>
        <Text style={[styles.recommendedTitle, { color: theme.text }]} numberOfLines={1}>
          {topic.title}
        </Text>
        <Text style={[styles.recommendedSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
          {topic.chapterTitle}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={theme.textMuted} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: progressData, isLoading: progressLoading, refetch: refetchProgress } = useQuery({
    queryKey: ["/api/user/progress"],
  });

  const { data: booksData } = useQuery({
    queryKey: ["/api/books"],
  });

  const { data: recentTopics, refetch: refetchRecent } = useQuery({
    queryKey: ["/api/user/recent-topics"],
    queryFn: async () => {
      return [] as RecommendedTopic[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([refetchProgress(), refetchRecent()]);
    setRefreshing(false);
  };

  const handleNotifications = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Notifications");
  };

  const handleTopicPress = (topic: RecommendedTopic) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("TopicReader", { topicId: topic.id, topicTitle: topic.title });
  };

  const progress = progressData as any;
  const stats: StatCardData[] = [
    {
      id: "topics",
      label: "Topics Read",
      value: progress?.topicsCompleted?.toString() || "0",
      icon: "book",
      color: Colors.dark.primary,
    },
    {
      id: "quizzes",
      label: "Quizzes Done",
      value: progress?.quizzesCompleted?.toString() || "0",
      icon: "check-circle",
      color: Colors.dark.success,
    },
    {
      id: "accuracy",
      label: "Avg. Score",
      value: progress?.averageScore ? `${Math.round(progress.averageScore)}%` : "—",
      icon: "target",
      color: Colors.dark.warning,
    },
    {
      id: "streak",
      label: "Study Streak",
      value: progress?.studyStreak?.toString() || "0",
      icon: "zap",
      color: Colors.dark.purple,
    },
  ];

  const recommendedTopics: RecommendedTopic[] = [
    {
      id: "rec1",
      title: "Normal Labor and Delivery",
      chapterTitle: "Labor & Delivery",
      bookTitle: "Obstetrics",
      progress: 0,
    },
    {
      id: "rec2",
      title: "Cervical Cancer Screening",
      chapterTitle: "Gynecologic Oncology",
      bookTitle: "Gynecology",
      progress: 0,
    },
    {
      id: "rec3",
      title: "Prenatal Vitamins & Supplements",
      chapterTitle: "Antepartum Care",
      bookTitle: "Obstetrics",
      progress: 0,
    },
  ];

  const continueTopic = recentTopics && recentTopics.length > 0 ? recentTopics[0] : null;

  const firstName = user?.name?.split(" ")[0] || "Student";
  const greeting = getGreeting();

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  const sections = [
    { type: "header" as const },
    { type: "stats" as const },
    ...(continueTopic ? [{ type: "continue" as const, data: continueTopic }] : []),
    { type: "recommended" as const },
  ];

  const renderItem = ({ item }: { item: (typeof sections)[0] }) => {
    switch (item.type) {
      case "header":
        return (
          <View style={styles.headerSection}>
            <View style={styles.greetingRow}>
              <View>
                <Text style={[styles.greeting, { color: theme.textSecondary }]}>{greeting},</Text>
                <Text style={[styles.userName, { color: theme.text }]}>{firstName}</Text>
              </View>
              <Pressable
                style={[styles.notificationButton, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}
                onPress={handleNotifications}
              >
                <Feather name="bell" size={20} color={theme.text} />
                <View style={[styles.notificationBadge, { backgroundColor: theme.primary }]} />
              </Pressable>
            </View>
          </View>
        );

      case "stats":
        return (
          <View style={styles.statsSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Progress</Text>
            {progressLoading ? (
              <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: Spacing.lg }} />
            ) : (
              <View style={styles.statsGrid}>
                {stats.map((stat) => (
                  <StatCard key={stat.id} item={stat} />
                ))}
              </View>
            )}
          </View>
        );

      case "continue":
        return (
          <View style={styles.continueSection}>
            <ContinueLearningCard
              topic={item.data as RecommendedTopic}
              onPress={() => handleTopicPress(item.data as RecommendedTopic)}
            />
          </View>
        );

      case "recommended":
        return (
          <View style={styles.recommendedSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recommended Topics</Text>
            {recommendedTopics.map((topic) => (
              <RecommendedCard key={topic.id} topic={topic} onPress={() => handleTopicPress(topic)} />
            ))}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={sections}
      keyExtractor={(item, index) => `${item.type}-${index}`}
      renderItem={renderItem}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  headerSection: {
    marginBottom: Spacing.xl,
  },
  greetingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  greeting: {
    ...Typography.body,
  },
  userName: {
    ...Typography.h2,
    marginTop: Spacing.xs,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statsSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: Spacing.lg,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -Spacing.xs,
  },
  statCard: {
    width: "48%",
    marginHorizontal: "1%",
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  statValue: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    ...Typography.caption,
  },
  continueSection: {
    marginBottom: Spacing.xl,
  },
  continueCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    ...Shadows.glowSmall,
  },
  continueContent: {
    flex: 1,
    marginRight: Spacing.md,
  },
  continueLabel: {
    ...Typography.caption,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  continueTitle: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  continueSubtitle: {
    ...Typography.small,
    marginBottom: Spacing.md,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginRight: Spacing.sm,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressText: {
    ...Typography.caption,
    width: 32,
    textAlign: "right",
  },
  continueArrow: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  recommendedSection: {
    marginBottom: Spacing.xl,
  },
  recommendedCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  recommendedIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.xs,
    backgroundColor: "rgba(17, 164, 212, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  recommendedContent: {
    flex: 1,
  },
  recommendedTitle: {
    ...Typography.body,
    fontWeight: "500",
    marginBottom: 2,
  },
  recommendedSubtitle: {
    ...Typography.caption,
  },
});
