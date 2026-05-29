import React, { useState, useCallback } from "react";
import { StyleSheet, View, FlatList, RefreshControl } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { ProgressBar } from "@/components/ProgressBar";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { LearnStackParamList } from "@/navigation/LearnStackNavigator";
import { useBottomLayout } from "@/hooks/useBottomLayout";

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
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<ChaptersScreenNavigationProp>();
  const route = useRoute<ChaptersScreenRouteProp>();
  const { bookId, bookTitle } = route.params;
  const [refreshing, setRefreshing] = useState(false);
  const { theme } = useTheme();
  const bottomLayout = useBottomLayout({ extraContentPadding: Spacing.xl });

  const {
    data: chapters,
    isLoading,
    refetch,
  } = useQuery<Chapter[]>({
    queryKey: ["/api/books", bookId, "chapters"],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: true,
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
      density="compact"
      titleNumberOfLines={2}
      subtitleNumberOfLines={1}
      onPress={() =>
        navigation.navigate("Topics", {
          chapterId: item.id,
          chapterTitle: item.title,
          bookId,
        })
      }
      icon={
        <ThemedText style={[styles.chapterNumber, { color: theme.primary }]}>
          {item.order}
        </ThemedText>
      }
      testID={`card-chapter-${item.id}`}
      style={{ marginBottom: Spacing.sm }}
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
              CHAPTERS
            </ThemedText>
            <ThemedText
              type="small"
              style={[styles.bookTitle, { color: theme.textSecondary }]}
            >
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
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  bookTitle: {
    marginTop: Spacing.xs,
  },
  chapterNumber: {
    fontSize: 18,
    fontWeight: "700",
  },
  progressContainer: {
    marginTop: Spacing.sm,
  },
});
