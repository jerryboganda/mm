import React, { useState, useCallback } from "react";
import { StyleSheet, View, FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { EmptyState } from "@/components/EmptyState";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type RecentActivityScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Activity {
  id: string;
  topicId: string;
  topicTitle: string;
  chapterTitle: string;
  bookTitle: string;
  viewedAt: string;
}

export default function RecentActivityScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<RecentActivityScreenNavigationProp>();
  const [refreshing, setRefreshing] = useState(false);

  const { data: activities, isLoading, refetch } = useQuery<Activity[]>({
    queryKey: ["/api/recent-activity"],
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const renderActivity = ({ item }: { item: Activity }) => (
    <GlassCard
      title={item.topicTitle}
      subtitle={`${item.bookTitle} • ${item.chapterTitle}`}
      onPress={() =>
        navigation.navigate("TopicReader", {
          topicId: item.topicId,
          topicTitle: item.topicTitle,
        })
      }
      icon={<Feather name="clock" size={24} color={Colors.dark.primary} />}
      rightElement={
        <ThemedText style={styles.timeText}>{formatTimeAgo(item.viewedAt)}</ThemedText>
      }
      testID={`card-activity-${item.id}`}
      style={{ marginBottom: Spacing.md }}
    />
  );

  const renderEmpty = () => (
    <EmptyState
      image={require("../../assets/images/empty-content.png")}
      title="No Recent Activity"
      description="Topics you view will appear here so you can quickly pick up where you left off."
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
        data={activities || []}
        renderItem={renderActivity}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
          (!activities || activities.length === 0) && !isLoading && styles.emptyList,
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.dark.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText style={styles.sectionLabel}>RECENTLY VIEWED</ThemedText>
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
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 1.5,
    color: Colors.dark.textMuted,
  },
  timeText: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
});
