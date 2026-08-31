import React, { useState } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  Pressable,
  ScrollView,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/lib/auth";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useBottomLayout } from "@/hooks/useBottomLayout";

type QuizTopicSelectNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "QuizTopicSelect"
>;

interface QuizTopic {
  id: string;
  title: string;
  chapterTitle: string;
  questionCount: number;
  isPaid?: boolean;
}

interface FilterOptions {
  years: number[];
  sources: { id: string; name: string }[];
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? `${theme.primary}26` : theme.glass,
          borderColor: selected ? theme.primary : theme.glassBorder,
        },
      ]}
    >
      <ThemedText
        type="small"
        style={[
          styles.chipText,
          { color: selected ? theme.primary : theme.textSecondary },
        ]}
        numberOfLines={1}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function QuizTopicSelectScreen() {
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<QuizTopicSelectNavigationProp>();
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const { theme } = useTheme();
  const { user } = useAuth();
  const bottomLayout = useBottomLayout({
    footerHeight: 58,
    footerSpacing: Spacing["2xl"],
  });

  const { data: topics, isLoading } = useQuery<QuizTopic[]>({
    queryKey: ["/api/quiz/topics"],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: true,
  });

  const { data: filterOptions } = useQuery<FilterOptions>({
    queryKey: ["/api/quiz/filter-options"],
    staleTime: 5 * 60 * 1000,
  });

  const hasFilters =
    (filterOptions?.years?.length ?? 0) > 0 ||
    (filterOptions?.sources?.length ?? 0) > 0;

  const handleStartQuiz = () => {
    if (selectedTopicId) {
      const selectedTopic = topics?.find((t) => t.id === selectedTopicId);
      const hasActiveSubscription = user?.subscriptionStatus === "active";
      if (selectedTopic?.isPaid && !hasActiveSubscription) {
        navigation.navigate("Paywall");
        return;
      }

      navigation.navigate("QuizPlayer", {
        mode: "topic",
        topicId: selectedTopicId,
        year: selectedYear ?? undefined,
        sourceId: selectedSourceId ?? undefined,
      });
    }
  };

  const renderTopic = ({ item }: { item: QuizTopic }) => {
    const isPaid = Boolean(item.isPaid);

    return (
      <GlassCard
        title={item.title}
        subtitle={`${item.chapterTitle} • ${item.questionCount} questions`}
        onPress={() => {
          const hasActiveSubscription = user?.subscriptionStatus === "active";
          if (isPaid && !hasActiveSubscription) {
            navigation.navigate("Paywall");
          } else {
            setSelectedTopicId(item.id);
          }
        }}
        active={selectedTopicId === item.id}
        icon={
          <Feather
            name="file-text"
            size={24}
            color={
              selectedTopicId === item.id ? theme.primary : theme.textSecondary
            }
          />
        }
        rightElement={
          <View
            style={[
              styles.badge,
              isPaid
                ? { backgroundColor: theme.warningGlow }
                : { backgroundColor: `${theme.success}26` },
            ]}
          >
            <Feather
              name={isPaid ? "star" : "unlock"}
              size={10}
              color={isPaid ? theme.warning : theme.success}
            />
            <ThemedText
              style={[
                styles.badgeText,
                { color: isPaid ? theme.warning : theme.success },
              ]}
            >
              {isPaid ? "Premium" : "Free"}
            </ThemedText>
          </View>
        }
        testID={`card-topic-${item.id}`}
        style={{ marginBottom: Spacing.md }}
      />
    );
  };

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
            paddingBottom: bottomLayout.contentBottomInset,
          },
        ]}
        scrollIndicatorInsets={{
          bottom: bottomLayout.scrollIndicatorBottomInset,
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText style={[styles.sectionLabel, { color: theme.primary }]}>
              SELECT A TOPIC
            </ThemedText>
            <ThemedText
              type="small"
              style={[styles.subtitle, { color: theme.textSecondary }]}
            >
              Choose a topic to practice MCQs from
            </ThemedText>
            {hasFilters ? (
              <View style={styles.filtersWrap}>
                {(filterOptions?.years?.length ?? 0) > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    <FilterChip
                      label="All years"
                      selected={selectedYear === null}
                      onPress={() => setSelectedYear(null)}
                    />
                    {filterOptions!.years.map((y) => (
                      <FilterChip
                        key={y}
                        label={String(y)}
                        selected={selectedYear === y}
                        onPress={() =>
                          setSelectedYear((prev) => (prev === y ? null : y))
                        }
                      />
                    ))}
                  </ScrollView>
                )}
                {(filterOptions?.sources?.length ?? 0) > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    <FilterChip
                      label="All sources"
                      selected={selectedSourceId === null}
                      onPress={() => setSelectedSourceId(null)}
                    />
                    {filterOptions!.sources.map((s) => (
                      <FilterChip
                        key={s.id}
                        label={s.name}
                        selected={selectedSourceId === s.id}
                        onPress={() =>
                          setSelectedSourceId((prev) =>
                            prev === s.id ? null : s.id,
                          )
                        }
                      />
                    ))}
                  </ScrollView>
                )}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={isLoading ? renderLoading() : null}
      />

      <View
        style={[
          styles.footer,
          {
            paddingBottom: bottomLayout.baseBottomInset + Spacing.lg,
            backgroundColor: "transparent",
          },
        ]}
      >
        <PrimaryButton
          title="Start Quiz"
          onPress={handleStartQuiz}
          disabled={!selectedTopicId}
          icon="play"
          testID="button-start-quiz"
        />
      </View>
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
  subtitle: {
    marginTop: Spacing.xs,
  },
  filtersWrap: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  chipRow: {
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    maxWidth: 200,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  footer: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: 0,
    paddingTop: Spacing.lg,
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
