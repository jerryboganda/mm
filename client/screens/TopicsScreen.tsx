import React, { useState, useCallback } from "react";
import { StyleSheet, View, FlatList, RefreshControl } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/lib/auth";
import { LearnStackParamList } from "@/navigation/LearnStackNavigator";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useBottomLayout } from "@/hooks/useBottomLayout";

type TopicsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
type TopicsScreenRouteProp = RouteProp<LearnStackParamList, "Topics">;

interface Topic {
  id: string;
  title: string;
  description: string;
  subtopicsCount?: number;
  completedSubtopicsCount?: number;
  progress?: number;
  isCompleted: boolean;
  isBookmarked: boolean;
  isLocked?: boolean;
  isPremium?: boolean;
  isPaid?: boolean;
  order: number;
}

export default function TopicsScreen() {
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<TopicsScreenNavigationProp>();
  const route = useRoute<TopicsScreenRouteProp>();
  const { bookId, bookTitle, chapterId, chapterTitle } = route.params;
  const [refreshing, setRefreshing] = useState(false);
  const { theme } = useTheme();
  const { user } = useAuth();
  const bottomLayout = useBottomLayout({ extraContentPadding: Spacing.xl });

  const queryUrl = bookId
    ? `/api/books/${bookId}/topics`
    : `/api/chapters/${chapterId}/topics`;

  const {
    data: topics,
    isLoading,
    refetch,
  } = useQuery<Topic[]>({
    queryKey: bookId
      ? ["/api/books", bookId, "topics"]
      : ["/api/chapters", chapterId, "topics"],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: true,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderTopic = ({ item, index }: { item: Topic; index: number }) => {
    const isPaid = Boolean(item.isPaid || item.isPremium);
    const subtopicSubtitle =
      typeof item.subtopicsCount === "number" && item.subtopicsCount > 0
        ? `${item.subtopicsCount} Subtopics${typeof item.progress === "number" && item.progress > 0 ? ` · ${item.progress}% complete` : ""}`
        : item.description;

    return (
      <GlassCard
        title={item.title}
        subtitle={subtopicSubtitle}
        density="compact"
        titleNumberOfLines={2}
        subtitleNumberOfLines={1}
        onPress={() => {
          const hasActiveSubscription = user?.subscriptionStatus === "active";
          if (isPaid && !hasActiveSubscription) {
            navigation.navigate("Paywall");
          } else {
            navigation.navigate("Subtopics", {
              topicId: item.id,
              topicTitle: item.title,
              bookId: bookId || "",
            });
          }
        }}
        icon={
          item.isCompleted ? (
            <View
              style={[styles.completedIcon, { backgroundColor: theme.success }]}
            >
              <Feather name="check" size={20} color="#fff" />
            </View>
          ) : (
            <Feather name="file-text" size={24} color={theme.primary} />
          )
        }
        rightElement={
          <View style={styles.rightElements}>
            <View
              style={[
                styles.badge,
                isPaid
                  ? { backgroundColor: theme.warningGlow }
                  : { backgroundColor: `${theme.success}26` },
              ]}
            >
              <Feather
                name={isPaid ? "star" : "unlock"}
                size={10}
                color={isPaid ? theme.warning : theme.success}
              />
              <ThemedText
                style={[
                  styles.badgeText,
                  { color: isPaid ? theme.warning : theme.success },
                ]}
              >
                {isPaid ? "Premium" : "Free"}
              </ThemedText>
            </View>
            {item.isBookmarked && (
              <Feather name="bookmark" size={20} color={theme.primary} />
            )}
          </View>
        }
        testID={`card-topic-${item.id}`}
        style={styles.topicCard}
      />
    );
  };

  const renderLoading = () => (
    <View>
      {[1, 2, 3, 4, 5].map((i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );

  return (
    <BackgroundGradient>
      <FlatList
        data={topics || []}
        renderItem={renderTopic}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.xl,
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
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText style={[styles.sectionLabel, { color: theme.primary }]}>
              TOPICS
            </ThemedText>
            <ThemedText
              type="small"
              style={[styles.chapterTitle, { color: theme.textSecondary }]}
            >
              {bookTitle || chapterTitle}
            </ThemedText>
          </View>
        }
        ListEmptyComponent={isLoading ? renderLoading() : null}
      />
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  chapterTitle: {
    marginTop: Spacing.xs,
  },
  completedIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  lockedIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  topicCard: {
    marginBottom: Spacing.sm,
  },
  lockedCard: {
    opacity: 0.6,
  },
  rightElements: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    marginLeft: 4,
  },
});
