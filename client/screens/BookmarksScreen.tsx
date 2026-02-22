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
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<BookmarksScreenNavigationProp>();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: bookmarks,
    isLoading,
    refetch,
  } = useQuery<Bookmark[]>({
    queryKey: ["/api/bookmarks"],
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
      subtitle={`${item.bookTitle} • ${item.chapterTitle}`}
      onPress={() =>
        navigation.navigate("TopicReader", {
          topicId: item.topicId,
          topicTitle: item.topicTitle,
        })
      }
      icon={<Feather name="bookmark" size={24} color={Colors.dark.primary} />}
      rightElement={
        <ThemedText style={styles.dateText}>
          {formatDate(item.createdAt)}
        </ThemedText>
      }
      testID={`card-bookmark-${item.id}`}
      style={{ marginBottom: Spacing.md }}
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
            paddingBottom: insets.bottom + Spacing.xl,
          },
          (!bookmarks || bookmarks.length === 0) &&
          !isLoading &&
          styles.emptyList,
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
    color: Colors.dark.textMuted,
  },
});
