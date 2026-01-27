import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import debounce from "lodash.debounce";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { ThemedText } from "@/components/ThemedText";
import { apiRequest } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type FilterType = "all" | "books" | "chapters" | "topics";

type SearchResult = {
  id: string;
  type: "book" | "chapter" | "topic";
  title: string;
  subtitle: string;
  bookId?: string;
  bookTitle?: string;
  chapterId?: string;
  chapterTitle?: string;
};

const FILTERS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "books", label: "Books" },
  { key: "chapters", label: "Chapters" },
  { key: "topics", label: "Topics" },
];

function SearchResultCard({ item, onPress }: { item: SearchResult; onPress: () => void }) {
  const getIcon = () => {
    switch (item.type) {
      case "book":
        return "book";
      case "chapter":
        return "layers";
      case "topic":
        return "file-text";
      default:
        return "file";
    }
  };

  const getTypeLabel = () => {
    switch (item.type) {
      case "book":
        return "Book";
      case "chapter":
        return "Chapter";
      case "topic":
        return "Topic";
      default:
        return "";
    }
  };

  return (
    <Pressable style={styles.resultCard} onPress={onPress}>
      <View style={styles.resultIcon}>
        <Feather name={getIcon()} size={18} color={Colors.dark.primary} />
      </View>
      <View style={styles.resultContent}>
        <View style={styles.resultHeader}>
          <Text style={styles.resultTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.typeTag}>
            <Text style={styles.typeTagText}>{getTypeLabel()}</Text>
          </View>
        </View>
        <Text style={styles.resultSubtitle} numberOfLines={1}>
          {item.subtitle}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={Colors.dark.textMuted} />
    </Pressable>
  );
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const debouncedSetQuery = useMemo(
    () => debounce((text: string) => setDebouncedQuery(text), 300),
    []
  );

  const handleQueryChange = (text: string) => {
    setQuery(text);
    debouncedSetQuery(text);
  };

  const { data: results, isLoading, isFetching } = useQuery<SearchResult[]>({
    queryKey: ["/api/search", debouncedQuery, activeFilter],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return [];
      const searchPath = `/api/search?query=${encodeURIComponent(debouncedQuery)}&filter=${activeFilter}`;
      const res = await apiRequest("GET", searchPath);
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
  });

  const filteredResults = useMemo(() => {
    if (!results) return [];
    if (activeFilter === "all") return results;
    return results.filter((r) => r.type === activeFilter.slice(0, -1));
  }, [results, activeFilter]);

  const handleResultPress = (item: SearchResult) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();

    switch (item.type) {
      case "book":
        navigation.navigate("MainTabs", {
          screen: "LibraryTab",
          params: {
            screen: "Chapters",
            params: { bookId: item.id, bookTitle: item.title },
          },
        } as any);
        break;
      case "chapter":
        navigation.navigate("MainTabs", {
          screen: "LibraryTab",
          params: {
            screen: "Topics",
            params: {
              chapterId: item.id,
              chapterTitle: item.title,
              bookId: item.bookId,
            },
          },
        } as any);
        break;
      case "topic":
        navigation.navigate("TopicReader", {
          topicId: item.id,
          topicTitle: item.title,
        });
        break;
    }
  };

  const handleFilterPress = (filter: FilterType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveFilter(filter);
  };

  const handleClear = () => {
    setQuery("");
    setDebouncedQuery("");
  };

  return (
    <BackgroundGradient>
      <View style={[styles.container, { paddingTop: headerHeight + Spacing.lg }]}>
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Feather name="search" size={18} color={Colors.dark.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search topics, chapters, books..."
              placeholderTextColor={Colors.dark.textMuted}
              value={query}
              onChangeText={handleQueryChange}
              autoFocus
              returnKeyType="search"
              testID="input-search"
            />
            {query.length > 0 && (
              <Pressable onPress={handleClear} hitSlop={10}>
                <Feather name="x" size={18} color={Colors.dark.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.filtersContainer}>
          {FILTERS.map((filter) => (
            <Pressable
              key={filter.key}
              style={[
                styles.filterChip,
                activeFilter === filter.key && styles.filterChipActive,
              ]}
              onPress={() => handleFilterPress(filter.key)}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === filter.key && styles.filterTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {debouncedQuery.length < 2 ? (
          <View style={styles.emptyContainer}>
            <Feather name="search" size={48} color={Colors.dark.textMuted} />
            <ThemedText style={styles.emptyTitle}>Search Content</ThemedText>
            <ThemedText style={styles.emptySubtitle}>
              Enter at least 2 characters to search books, chapters, and topics
            </ThemedText>
          </View>
        ) : isLoading || isFetching ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
          </View>
        ) : filteredResults.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="file-minus" size={48} color={Colors.dark.textMuted} />
            <ThemedText style={styles.emptyTitle}>No Results</ThemedText>
            <ThemedText style={styles.emptySubtitle}>
              Try different keywords or change the filter
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={filteredResults}
            keyExtractor={(item) => `${item.type}-${item.id}`}
            renderItem={({ item }) => (
              <SearchResultCard item={item} onPress={() => handleResultPress(item)} />
            )}
            contentContainerStyle={{
              paddingHorizontal: Spacing.lg,
              paddingBottom: tabBarHeight + Spacing.xl,
            }}
            scrollIndicatorInsets={{ bottom: insets.bottom }}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
            ListHeaderComponent={
              <ThemedText style={styles.resultsCount}>
                {filteredResults.length} result{filteredResults.length !== 1 ? "s" : ""} found
              </ThemedText>
            }
          />
        )}
      </View>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.glass,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    color: Colors.dark.text,
    ...Typography.body,
  },
  filtersContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.dark.glass,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  filterChipActive: {
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  filterText: {
    ...Typography.small,
    color: Colors.dark.textSecondary,
  },
  filterTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.dark.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.body,
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
  resultsCount: {
    ...Typography.small,
    color: Colors.dark.textMuted,
    marginBottom: Spacing.md,
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    backgroundColor: Colors.dark.glass,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.xs,
    backgroundColor: "rgba(17, 164, 212, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  resultContent: {
    flex: 1,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  resultTitle: {
    ...Typography.body,
    fontWeight: "500",
    color: Colors.dark.text,
    flex: 1,
  },
  typeTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    backgroundColor: Colors.dark.glass,
    borderRadius: BorderRadius.xs,
    marginLeft: Spacing.sm,
  },
  typeTagText: {
    ...Typography.caption,
    color: Colors.dark.textMuted,
  },
  resultSubtitle: {
    ...Typography.caption,
    color: Colors.dark.textSecondary,
  },
});
