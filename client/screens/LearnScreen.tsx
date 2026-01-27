import React, { useState, useCallback } from "react";
import { StyleSheet, View, FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { ProgressBar } from "@/components/ProgressBar";
import { EmptyState } from "@/components/EmptyState";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing } from "@/constants/theme";
import { LearnStackParamList } from "@/navigation/LearnStackNavigator";

type LearnScreenNavigationProp = NativeStackNavigationProp<LearnStackParamList, "LearnHome">;

interface Book {
  id: string;
  title: string;
  description: string;
  chaptersCount: number;
  progress: number;
  imageUrl?: string;
}

export default function LearnScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<LearnScreenNavigationProp>();
  const [refreshing, setRefreshing] = useState(false);

  const { data: books, isLoading, error, refetch } = useQuery<Book[]>({
    queryKey: ["/api/books"],
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderBook = ({ item, index }: { item: Book; index: number }) => (
    <GlassCard
      title={item.title}
      subtitle={`${item.chaptersCount} Chapters`}
      onPress={() => navigation.navigate("Chapters", { bookId: item.id, bookTitle: item.title })}
      icon={
        <Feather name="book-open" size={24} color={Colors.dark.primary} />
      }
      testID={`card-book-${item.id}`}
      style={{ marginBottom: Spacing.md }}
    >
      <View style={styles.progressContainer}>
        <ProgressBar progress={item.progress} height={6} />
        <ThemedText style={styles.progressText}>
          {item.progress}% Complete
        </ThemedText>
      </View>
    </GlassCard>
  );

  const renderEmpty = () => (
    <EmptyState
      image={require("../../assets/images/empty-content.png")}
      title="No Content Yet"
      description="Educational content will appear here once your professor uploads study materials."
    />
  );

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      {[1, 2, 3].map((i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );

  if (error) {
    return (
      <BackgroundGradient>
        <View style={[styles.centered, { paddingTop: headerHeight }]}>
          <Feather name="alert-circle" size={48} color={Colors.dark.error} />
          <ThemedText style={styles.errorText}>
            Failed to load content
          </ThemedText>
        </View>
      </BackgroundGradient>
    );
  }

  return (
    <BackgroundGradient>
      <FlatList
        data={books || []}
        renderItem={renderBook}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
          (!books || books.length === 0) && !isLoading && styles.emptyList,
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
            <ThemedText style={styles.sectionLabel}>CONTENT LIBRARY</ThemedText>
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
  progressContainer: {
    marginTop: Spacing.md,
  },
  progressText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: Spacing.xs,
  },
  loadingContainer: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: Colors.dark.textSecondary,
    marginTop: Spacing.md,
  },
});
