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
import { LearnStackParamList } from "@/navigation/LearnStackNavigator";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useBottomLayout } from "@/hooks/useBottomLayout";

type TopicsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
type TopicsScreenRouteProp = RouteProp<LearnStackParamList, "Topics">;

interface Topic {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  isBookmarked: boolean;
  isLocked: boolean;
  isPremium: boolean;
  order: number;
}

export default function TopicsScreen() {
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<TopicsScreenNavigationProp>();
  const route = useRoute<TopicsScreenRouteProp>();
  const { chapterId, chapterTitle } = route.params;
  const [refreshing, setRefreshing] = useState(false);
  const { theme } = useTheme();
  const bottomLayout = useBottomLayout({ extraContentPadding: Spacing.xl });

  const {
    data: topics,
    isLoading,
    refetch,
  } = useQuery<Topic[]>({
    queryKey: ["/api/chapters", chapterId, "topics"],
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderTopic = ({ item, index }: { item: Topic; index: number }) => (
    <GlassCard
      title={item.title}
      subtitle={item.description}
      density="compact"
      titleNumberOfLines={2}
      subtitleNumberOfLines={1}
      onPress={() => {
        if (!item.isLocked) {
          navigation.navigate("TopicReader", {
            topicId: item.id,
            topicTitle: item.title,
          });
        }
      }}
      icon={
        item.isLocked ? (
          <View
            style={[
              styles.lockedIcon,
              { backgroundColor: theme.glass, borderColor: theme.glassBorder },
            ]}
          >
            <Feather name="lock" size={18} color={theme.textMuted} />
          </View>
        ) : item.isCompleted ? (
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
          {item.isPremium && (
            <View
              style={[
                styles.premiumBadge,
                { backgroundColor: theme.warningGlow },
              ]}
            >
              <Feather name="star" size={10} color={theme.warning} />
            </View>
          )}
          {item.isBookmarked && (
            <Feather name="bookmark" size={20} color={theme.primary} />
          )}
        </View>
      }
      testID={`card-topic-${item.id}`}
      style={[styles.topicCard, item.isLocked && styles.lockedCard]}
    />
  );

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
              {chapterTitle}
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
  premiumBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
