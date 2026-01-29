import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/lib/auth";
import {
  Colors,
  Spacing,
  BorderRadius,
  Typography,
  Shadows,
} from "@/constants/theme";
import { AnimatedListItem } from "@/components/AnimatedListItem";
import { GlassCard } from "@/components/GlassCard";
import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";

type NavigationProp = NativeStackNavigationProp<HomeStackParamList>;

type StatCardData = {
  id: string;
  label: string;
  value: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  variant: "accent" | "success" | "warning" | "purple";
};

type RecommendedTopic = {
  id: string;
  title: string;
  chapterTitle: string;
  bookTitle: string;
  progress: number;
};

function BentoStatCard({ item, index }: { item: StatCardData; index: number }) {
  const { theme } = useTheme();
  const glowColor = {
    accent: "rgba(0,212,255,0.12)",
    success: "rgba(34,197,94,0.12)",
    warning: "rgba(245,158,11,0.12)",
    purple: "rgba(168,85,247,0.12)",
  }[item.variant];

  const renderBackground = () => {
    if (Platform.OS === "web") {
      return (
        <View style={styles.bentoBackground}>
          <LinearGradient
            colors={[glowColor, "rgba(255,255,255,0.02)"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </View>
      );
    }

    return (
      <BlurView intensity={18} tint="dark" style={styles.bentoBackground}>
        <LinearGradient
          colors={[glowColor, "rgba(255,255,255,0.08)"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </BlurView>
    );
  };

  return (
    <View
      style={[
        styles.bentoCardContainer,
        index === 0 && styles.bentoCardWide,
      ]}
    >
      <AnimatedListItem index={index} delay={60} style={{ width: "100%" }}>
        <View
          style={[
            styles.bentoCard,
            { borderColor: theme.glassBorder },
          ]}
        >
          {renderBackground()}
          <View style={styles.bentoContent}>
            <View style={styles.bentoHeader}>
              <View
                style={[
                  styles.bentoIconContainer,
                  { backgroundColor: `${item.color}20` },
                ]}
              >
                <Feather name={item.icon} size={20} color={item.color} />
              </View>
            </View>
            <View style={styles.bentoValueContainer}>
              <Text style={[styles.bentoValue, { color: item.color }]}>
                {item.value}
              </Text>
              <Text style={[styles.bentoLabel, { color: theme.textSecondary }]}>
                {item.label}
              </Text>
            </View>
          </View>
        </View>
      </AnimatedListItem>
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
    <GlassCard onPress={onPress} variant="glow" style={styles.continueCard}>
      <View style={styles.continueContent}>
        <Text style={[styles.continueLabel, { color: theme.primary }]}>
          CONTINUE LEARNING
        </Text>
        <Text
          style={[styles.continueTitle, { color: theme.text }]}
          numberOfLines={1}
        >
          {topic.title}
        </Text>
        <Text
          style={[styles.continueSubtitle, { color: theme.textSecondary }]}
          numberOfLines={1}
        >
          {topic.chapterTitle} - {topic.bookTitle}
        </Text>
        <View style={styles.progressContainer}>
          <View
            style={[styles.progressBar, { backgroundColor: theme.glassBorder }]}
          >
            <View
              style={[
                styles.progressFill,
                { width: `${topic.progress}%`, backgroundColor: theme.primary },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: theme.textMuted }]}>
            {topic.progress}%
          </Text>
        </View>
      </View>
      <View style={[styles.continueArrow, { backgroundColor: theme.primary }]}>
        <Feather name="arrow-right" size={20} color="#fff" />
      </View>
    </GlassCard>
  );
}

function RecommendedCard({
  topic,
  onPress,
  index,
}: {
  topic: RecommendedTopic;
  onPress: () => void;
  index: number;
}) {
  const { theme } = useTheme();

  return (
    <AnimatedListItem index={index} delay={80}>
      <GlassCard onPress={onPress} style={styles.recommendedCard}>
        <View style={styles.recommendedIcon}>
          <Feather name="book-open" size={16} color={theme.primary} />
        </View>
        <View style={styles.recommendedContent}>
          <Text
            style={[styles.recommendedTitle, { color: theme.text }]}
            numberOfLines={1}
          >
            {topic.title}
          </Text>
          <Text
            style={[styles.recommendedSubtitle, { color: theme.textMuted }]}
            numberOfLines={1}
          >
            {topic.chapterTitle}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={theme.textMuted} />
      </GlassCard>
    </AnimatedListItem>
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

  const {
    data: progressData,
    isLoading: progressLoading,
    refetch: refetchProgress,
  } = useQuery({
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
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await Promise.all([refetchProgress(), refetchRecent()]);
    setRefreshing(false);
  };

  const handleNotifications = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    navigation.navigate("Notifications");
  };

  const handleTopicPress = (topic: RecommendedTopic) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    navigation.navigate("TopicReader", {
      topicId: topic.id,
      topicTitle: topic.title,
    });
  };

  const progress = progressData as any;
  const stats: StatCardData[] = [
    {
      id: "topics",
      label: "Topics Read",
      value: progress?.topicsCompleted?.toString() || "0",
      icon: "book",
      color: Colors.dark.primary,
      variant: "accent",
    },
    {
      id: "quizzes",
      label: "Quizzes Done",
      value: progress?.quizzesCompleted?.toString() || "0",
      icon: "check-circle",
      color: Colors.dark.success,
      variant: "success",
    },
    {
      id: "accuracy",
      label: "Avg. Score",
      value: progress?.averageScore
        ? `${Math.round(progress.averageScore)}%`
        : "—",
      icon: "target",
      color: Colors.dark.warning,
      variant: "warning",
    },
    {
      id: "streak",
      label: "Study Streak",
      value: progress?.studyStreak?.toString() || "0",
      icon: "zap",
      color: Colors.dark.purple,
      variant: "purple",
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

  const continueTopic =
    recentTopics && recentTopics.length > 0 ? recentTopics[0] : null;

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
    ...(continueTopic
      ? [{ type: "continue" as const, data: continueTopic }]
      : []),
    { type: "recommended" as const },
  ];

  const renderItem = ({
    item,
    index,
  }: {
    item: (typeof sections)[0];
    index: number;
  }) => {
    switch (item.type) {
      case "header":
        return (
          <AnimatedListItem index={0} delay={0}>
            <View style={styles.headerSection}>
              <View style={styles.greetingRow}>
                <View>
                  <Text
                    style={[styles.greeting, { color: theme.textSecondary }]}
                  >
                    {greeting},
                  </Text>
                  <Text style={[styles.userName, { color: theme.text }]}>
                    {firstName}
                  </Text>
                </View>
                <Pressable
                  style={[
                    styles.notificationButton,
                    {
                      backgroundColor: theme.glass,
                      borderColor: theme.glassBorder,
                    },
                  ]}
                  onPress={handleNotifications}
                >
                  <Feather name="bell" size={20} color={theme.text} />
                  <View
                    style={[
                      styles.notificationBadge,
                      { backgroundColor: theme.primary },
                    ]}
                  />
                </Pressable>
              </View>
            </View>
          </AnimatedListItem>
        );

      case "stats":
        return (
          <View style={styles.statsSection}>
            <AnimatedListItem index={1} delay={50}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Your Progress
              </Text>
            </AnimatedListItem>
            {progressLoading ? (
              <ActivityIndicator
                size="small"
                color={theme.primary}
                style={{ marginTop: Spacing.lg }}
              />
            ) : (
              <View style={styles.bentoGrid}>
                {stats.map((stat, idx) => (
                  <BentoStatCard key={stat.id} item={stat} index={idx} />
                ))}
              </View>
            )}
          </View>
        );

      case "continue":
        return (
          <AnimatedListItem index={7} delay={60}>
            <View style={styles.continueSection}>
              <ContinueLearningCard
                topic={item.data as RecommendedTopic}
                onPress={() => handleTopicPress(item.data as RecommendedTopic)}
              />
            </View>
          </AnimatedListItem>
        );

      case "recommended":
        return (
          <View style={styles.recommendedSection}>
            <AnimatedListItem index={8} delay={60}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Recommended Topics
              </Text>
            </AnimatedListItem>
            {recommendedTopics.map((topic, idx) => (
              <RecommendedCard
                key={topic.id}
                topic={topic}
                onPress={() => handleTopicPress(topic)}
                index={idx + 9}
              />
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
    ...Typography.h1,
    marginTop: Spacing.xs,
  },
  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statsSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.lg,
  },
  bentoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -Spacing.xs,
  },
  bentoCardContainer: {
    width: "48%",
    marginHorizontal: "1%",
    marginBottom: Spacing.md,
  },
  bentoCard: {
    width: "100%",
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: "hidden",
    minHeight: 130,
  },
  bentoCardWide: {
    width: "98%",
  },
  bentoBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  bentoContent: {
    flex: 1,
    padding: Spacing.cardPadding,
    justifyContent: "space-between",
  },
  bentoHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  bentoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  bentoValueContainer: {
    marginTop: Spacing.sm,
  },
  bentoValue: {
    ...Typography.stat,
  },
  bentoLabel: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  continueSection: {
    marginBottom: Spacing.xl,
  },
  continueCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 0,
  },
  continueContent: {
    flex: 1,
    padding: Spacing.lg,
    paddingRight: 0,
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
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.lg,
  },
  recommendedSection: {
    marginBottom: Spacing.xl,
  },
  recommendedCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  recommendedIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: "rgba(0, 212, 255, 0.1)",
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
