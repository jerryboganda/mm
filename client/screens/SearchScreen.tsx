import React, { useState, useCallback, useMemo } from "react";
import {
  View,
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
import * as Haptics from "@/lib/haptics-wrapper";
import debounce from "lodash.debounce";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { ThemedText } from "@/components/ThemedText";
import { useMobileContent } from "@/lib/mobile-content";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
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

function SearchResultCard({
  item,
  onPress,
}: {
  item: SearchResult;
  onPress: () => void;
}) {
  const { theme } = useTheme();

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
    <Pressable
      style={[styles.resultCard, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}
      onPress={onPress}
    >
      <View style={[styles.resultIcon, { backgroundColor: `${theme.primary}1A` }]}>
        <Feather name={getIcon()} size={18} color={theme.primary} />
      </View>
      <View style={styles.resultContent}>
        <View style={styles.resultHeader}>
          <ThemedText style={[styles.resultTitle, { color: theme.text }]} numberOfLines={1}>
            {item.title}
          </ThemedText>
          <View style={[styles.typeTag, { backgroundColor: theme.glass }]}>
            <ThemedText style={[styles.typeTagText, { color: theme.textMuted }]}>{getTypeLabel()}</ThemedText>
          </View>
        </View>
        <ThemedText style={[styles.resultSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
          {item.subtitle}
        </ThemedText>
      </View>
      <Feather name="chevron-right" size={18} color={theme.textMuted} />
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
  const { theme } = useTheme();
  const { resolveText } = useMobileContent();
  const t = resolveText;

  const debouncedSetQuery = useMemo(
    () => debounce((text: string) => setDebouncedQuery(text), 300),
    [],
  );

  const handleQueryChange = (text: string) => {
    setQuery(text);
    debouncedSetQuery(text);
  };

  const {
    data: results,
    isLoading,
    isFetching,
  } = useQuery<SearchResult[]>({
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
        // Navigate to the Library tab's Chapters screen
        navigation.navigate("Main", {
          screen: "LibraryTab",
          params: {
            screen: "Chapters",
            params: {
              bookId: item.id,
              bookTitle: item.title,
            },
          },
        } as any);
        break;
      case "chapter":
        // Navigate to the Library tab's Topics screen
        navigation.navigate("Main", {
          screen: "LibraryTab",
          params: {
            screen: "Topics",
            params: {
              chapterId: item.id,
              chapterTitle: item.title,
              bookId: item.bookId || "",
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
      <View
        style={[styles.container, { paddingTop: headerHeight + Spacing.lg }]}
      >
        <View style={styles.searchContainer}>
          <View style={[styles.searchInputWrapper, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}>
            <Feather name="search" size={18} color={theme.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder={t("Search topics, chapters, books...")}
              placeholderTextColor={theme.textMuted}
              value={query}
              onChangeText={handleQueryChange}
              autoFocus
              returnKeyType="search"
              testID="input-search"
            />
            {query.length > 0 && (
              <Pressable onPress={handleClear} hitSlop={10}>
                <Feather name="x" size={18} color={theme.textMuted} />
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
                { backgroundColor: theme.glass, borderColor: theme.glassBorder },
                activeFilter === filter.key && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
              onPress={() => handleFilterPress(filter.key)}
            >
              <ThemedText
                style={[
                  styles.filterText,
                  { color: theme.textSecondary },
                  activeFilter === filter.key && { color: theme.buttonText, fontWeight: "600" },
                ]}
              >
                {filter.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {debouncedQuery.length < 2 ? (
          <View style={styles.emptyContainer}>
            <Feather name="search" size={48} color={theme.textMuted} />
            <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>Search Content</ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Enter at least 2 characters to search books, chapters, and topics
            </ThemedText>
          </View>
        ) : isLoading || isFetching ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : filteredResults.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather
              name="file-minus"
              size={48}
              color={theme.textMuted}
            />
            <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>No Results</ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Try different keywords or change the filter
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={filteredResults}
            keyExtractor={(item) => `${item.type}-${item.id}`}
            renderItem={({ item }) => (
              <SearchResultCard
                item={item}
                onPress={() => handleResultPress(item)}
              />
            )}
            contentContainerStyle={{
              paddingHorizontal: Spacing.lg,
              paddingBottom: tabBarHeight + Spacing.xl,
            }}
            scrollIndicatorInsets={{ bottom: insets.bottom }}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => (
              <View style={{ height: Spacing.sm }} />
            )}
            ListHeaderComponent={
              <ThemedText style={[styles.resultsCount, { color: theme.textMuted }]}>
                {filteredResults.length} result
                {filteredResults.length !== 1 ? "s" : ""} found
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
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
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
    borderWidth: 1,
  },
  filterChipActive: {
    // Handled inline
  },
  filterText: {
    ...Typography.small,
  },
  filterTextActive: {
    // Handled inline
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
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: "center",
  },
  resultsCount: {
    ...Typography.small,
    marginBottom: Spacing.md,
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.xs,
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
    flex: 1,
  },
  typeTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    marginLeft: Spacing.sm,
  },
  typeTagText: {
    ...Typography.caption,
  },
  resultSubtitle: {
    ...Typography.caption,
  },
});
