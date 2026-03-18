import React, { useState, useCallback } from "react";
import { StyleSheet, View, FlatList, RefreshControl } from "react-native";
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
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useBottomLayout } from "@/hooks/useBottomLayout";

type BookmarksScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

interface Bookmark {
  id: string;
  topicId: string;
  topicTitle: string;
  chapterTitle: string;
  bookTitle: string;
  createdAt: string;
}

export default function BookmarksScreen() {
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<BookmarksScreenNavigationProp>();
  const [refreshing, setRefreshing] = useState(false);
  const { theme } = useTheme();
  const bottomLayout = useBottomLayout({ extraContentPadding: Spacing.xl });

  const {
    data: bookmarks,
    isLoading,
    refetch,
  } = useQuery<Bookmark[]>({
    queryKey: ["/api/profile/bookmarks"],
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderBookmark = ({ item }: { item: Bookmark }) => (
    <GlassCard
      title={item.topicTitle}
      subtitle={`${item.bookTitle} - ${item.chapterTitle}`}
      density="compact"
      titleNumberOfLines={2}
      subtitleNumberOfLines={1}
      onPress={() =>
        navigation.navigate("TopicReader", {
          topicId: item.topicId,
          topicTitle: item.topicTitle,
        })
      }
      icon={<Feather name="bookmark" size={24} color={theme.primary} />}
      rightElement={
        <ThemedText style={[styles.dateText, { color: theme.textMuted }]}>
          {formatDate(item.createdAt)}
        </ThemedText>
      }
      testID={`card-bookmark-${item.id}`}
      style={{ marginBottom: Spacing.sm }}
    />
  );

  const renderEmpty = () => (
    <EmptyState
      image={require("../../assets/images/empty-content.png")}
      title="No Bookmarks"
      description="Topics you bookmark will appear here for quick access."
    />
  );

  const renderLoading = () => (
    <View>
      {[1, 2, 3].map((i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );

  return (
    <BackgroundGradient>
      <FlatList
        data={bookmarks || []}
        renderItem={renderBookmark}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: bottomLayout.contentBottomInset,
          },
          (!bookmarks || bookmarks.length === 0) &&
            !isLoading &&
            styles.emptyList,
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
            <ThemedText style={styles.sectionLabel}>YOUR BOOKMARKS</ThemedText>
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
    color: "#11a4d4",
  },
  dateText: {
    fontSize: 11,
  },
});
