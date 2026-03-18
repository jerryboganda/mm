import React, { useState, useCallback } from "react";
import { StyleSheet, View, FlatList, RefreshControl } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
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
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { LearnStackParamList } from "@/navigation/LearnStackNavigator";
import { useBottomLayout } from "@/hooks/useBottomLayout";

type LearnScreenNavigationProp = NativeStackNavigationProp<
  LearnStackParamList,
  "LearnHome"
>;

interface Book {
  id: string;
  title: string;
  description: string;
  chaptersCount: number;
  progress: number;
  imageUrl?: string;
  isPremium?: boolean;
}

export default function LearnScreen() {
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<LearnScreenNavigationProp>();
  const [refreshing, setRefreshing] = useState(false);
  const { theme } = useTheme();
  const bottomLayout = useBottomLayout({ extraContentPadding: Spacing.xl });

  const {
    data: books,
    isLoading,
    error,
    refetch,
  } = useQuery<Book[]>({
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
      density="compact"
      titleNumberOfLines={2}
      subtitleNumberOfLines={1}
      onPress={() =>
        navigation.navigate("Chapters", {
          bookId: item.id,
          bookTitle: item.title,
        })
      }
      icon={<Feather name="book-open" size={24} color={theme.primary} />}
      rightElement={
        <View
          style={[
            styles.badge,
            item.isPremium
              ? { backgroundColor: theme.warningGlow }
              : { backgroundColor: `${theme.success}26` },
          ]}
        >
          <Feather
            name={item.isPremium ? "star" : "unlock"}
            size={10}
            color={item.isPremium ? theme.warning : theme.success}
          />
          <ThemedText
            style={[
              styles.badgeText,
              { color: item.isPremium ? theme.warning : theme.success },
            ]}
          >
            {item.isPremium ? "Premium" : "Free"}
          </ThemedText>
        </View>
      }
      testID={`card-book-${item.id}`}
      style={{ marginBottom: Spacing.sm }}
    >
      <View style={styles.progressContainer}>
        <ProgressBar progress={item.progress} height={6} />
        <ThemedText
          style={[styles.progressText, { color: theme.textSecondary }]}
        >
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
          <Feather name="alert-circle" size={48} color={theme.error} />
          <ThemedText
            style={[styles.errorText, { color: theme.textSecondary }]}
          >
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
            paddingBottom: bottomLayout.contentBottomInset,
          },
          (!books || books.length === 0) && !isLoading && styles.emptyList,
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
              CONTENT LIBRARY
            </ThemedText>
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
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  progressContainer: {
    marginTop: Spacing.sm,
  },
  progressText: {
    fontSize: 12,
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
    marginTop: Spacing.md,
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
