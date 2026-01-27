import React, { useState, useCallback } from "react";
import { StyleSheet, View, FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { LearnStackParamList } from "@/navigation/LearnStackNavigator";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type TopicsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
type TopicsScreenRouteProp = RouteProp<LearnStackParamList, "Topics">;

interface Topic {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  isBookmarked: boolean;
  order: number;
}

export default function TopicsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<TopicsScreenNavigationProp>();
  const route = useRoute<TopicsScreenRouteProp>();
  const { chapterId, chapterTitle } = route.params;
  const [refreshing, setRefreshing] = useState(false);

  const { data: topics, isLoading, refetch } = useQuery<Topic[]>({
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
      onPress={() => navigation.navigate("TopicReader", { 
        topicId: item.id, 
        topicTitle: item.title 
      })}
      icon={
        item.isCompleted ? (
          <View style={styles.completedIcon}>
            <Feather name="check" size={20} color="#fff" />
          </View>
        ) : (
          <Feather name="file-text" size={24} color={Colors.dark.primary} />
        )
      }
      rightElement={
        item.isBookmarked ? (
          <Feather name="bookmark" size={20} color={Colors.dark.primary} />
        ) : null
      }
      testID={`card-topic-${item.id}`}
      style={{ marginBottom: Spacing.md }}
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
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText style={styles.sectionLabel}>TOPICS</ThemedText>
            <ThemedText type="small" style={styles.chapterTitle}>
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
    letterSpacing: 1.5,
    color: Colors.dark.textMuted,
  },
  chapterTitle: {
    color: Colors.dark.textSecondary,
    marginTop: Spacing.xs,
  },
  completedIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.dark.success,
    alignItems: "center",
    justifyContent: "center",
  },
});
