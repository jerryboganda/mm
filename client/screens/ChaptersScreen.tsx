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
import { ProgressBar } from "@/components/ProgressBar";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing } from "@/constants/theme";
import { LearnStackParamList } from "@/navigation/LearnStackNavigator";

type ChaptersScreenNavigationProp = NativeStackNavigationProp<
  LearnStackParamList,
  "Chapters"
>;
type ChaptersScreenRouteProp = RouteProp<LearnStackParamList, "Chapters">;

interface Chapter {
  id: string;
  title: string;
  description: string;
  topicsCount: number;
  progress: number;
  order: number;
}

export default function ChaptersScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<ChaptersScreenNavigationProp>();
  const route = useRoute<ChaptersScreenRouteProp>();
  const { bookId, bookTitle } = route.params;
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: chapters,
    isLoading,
    refetch,
  } = useQuery<Chapter[]>({
    queryKey: ["/api/books", bookId, "chapters"],
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderChapter = ({ item, index }: { item: Chapter; index: number }) => (
    <GlassCard
      title={`${item.order}. ${item.title}`}
      subtitle={`${item.topicsCount} Topics`}
      onPress={() =>
        navigation.navigate("Topics", {
          chapterId: item.id,
          chapterTitle: item.title,
          bookId,
        })
      }
      icon={<ThemedText style={styles.chapterNumber}>{item.order}</ThemedText>}
      testID={`card-chapter-${item.id}`}
      style={{ marginBottom: Spacing.md }}
    >
      <View style={styles.progressContainer}>
        <ProgressBar progress={item.progress} height={4} />
      </View>
    </GlassCard>
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
        data={chapters || []}
        renderItem={renderChapter}
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
            <ThemedText style={styles.sectionLabel}>CHAPTERS</ThemedText>
            <ThemedText type="small" style={styles.bookTitle}>
              {bookTitle}
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
  bookTitle: {
    color: Colors.dark.textSecondary,
    marginTop: Spacing.xs,
  },
  chapterNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.dark.primary,
  },
  progressContainer: {
    marginTop: Spacing.md,
  },
});
