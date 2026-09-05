import React, { useState } from "react";
import { StyleSheet, View, FlatList } from "react-native";
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
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useBottomLayout } from "@/hooks/useBottomLayout";

type QuizYearSelectNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "QuizYearSelect"
>;

interface QuizYear {
  year: number;
  questionCount: number;
}

export default function QuizYearSelectScreen() {
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<QuizYearSelectNavigationProp>();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const { theme } = useTheme();
  const bottomLayout = useBottomLayout({
    footerHeight: 58,
    footerSpacing: Spacing["2xl"],
  });

  const { data: years, isLoading } = useQuery<QuizYear[]>({
    queryKey: ["/api/quiz/years"],
    staleTime: 5 * 60 * 1000,
  });

  const handleStartQuiz = () => {
    if (selectedYear) {
      navigation.navigate("QuizPlayer", {
        mode: "yearly",
        year: selectedYear,
      });
    }
  };

  const renderYear = ({ item }: { item: QuizYear }) => (
    <GlassCard
      title={String(item.year)}
      subtitle={`${item.questionCount} questions`}
      onPress={() =>
        setSelectedYear((prev) => (prev === item.year ? null : item.year))
      }
      active={selectedYear === item.year}
      icon={
        <Feather
          name="calendar"
          size={24}
          color={
            selectedYear === item.year ? theme.primary : theme.textSecondary
          }
        />
      }
      testID={`card-year-${item.year}`}
      style={{ marginBottom: Spacing.md }}
    />
  );

  return (
    <BackgroundGradient>
      <FlatList
        data={years || []}
        renderItem={renderYear}
        keyExtractor={(item) => String(item.year)}
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
              SELECT A YEAR
            </ThemedText>
            <ThemedText
              type="small"
              style={[styles.subtitle, { color: theme.textSecondary }]}
            >
              Choose a year to practice MCQs from
            </ThemedText>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View>
              {[1, 2, 3, 4, 5].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </View>
          ) : null
        }
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
          disabled={!selectedYear}
          icon="play"
          testID="button-start-yearly-quiz"
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
  footer: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: 0,
    paddingTop: Spacing.lg,
  },
});
