import React from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { StatCard } from "@/components/StatCard";
import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type PracticeScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

interface QuizStats {
  totalAttempts: number;
  averageScore: number;
  wrongQuestionsCount: number;
}

export default function PracticeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<PracticeScreenNavigationProp>();
  const { theme } = useTheme();

  const { data: stats } = useQuery<QuizStats>({
    queryKey: ["/api/quiz/stats"],
  });

  const quizModes = [
    {
      id: "topic",
      title: "Topic Quiz",
      description: "Practice questions from a specific topic",
      icon: "book" as const,
      color: theme.primary,
    },
    {
      id: "mixed",
      title: "Mixed Quiz",
      description: "Random questions from all topics",
      icon: "shuffle" as const,
      color: "#3b82f6", // Info color usually
    },
    {
      id: "wrong",
      title: "Wrong Questions",
      description: "Retry questions you got wrong",
      icon: "rotate-ccw" as const,
      color: theme.error,
      disabled: !stats?.wrongQuestionsCount,
    },
    {
      id: "exam",
      title: "Exam Simulation",
      description: "Timed exam with 30 questions, no going back",
      icon: "award" as const,
      color: theme.warning,
    },
  ];

  return (
    <BackgroundGradient>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <View style={styles.statsRow}>
          <StatCard
            label="Total Attempts"
            value={stats?.totalAttempts || 0}
            icon="activity"
            color={theme.primary}
          />
          <View style={{ width: Spacing.md }} />
          <StatCard
            label="Avg Score"
            value={`${stats?.averageScore || 0}%`}
            icon="trending-up"
            color={theme.success}
          />
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>QUIZ MODES</ThemedText>
          {quizModes.map((mode) => (
            <GlassCard
              key={mode.id}
              title={mode.title}
              subtitle={mode.description}
              onPress={() => {
                if (mode.id === "topic") {
                  navigation.navigate("QuizTopicSelect");
                } else if (mode.id === "exam") {
                  navigation.navigate("QuizPlayer", {
                    mode: "exam",
                    topicId: undefined,
                    questionCount: 30,
                  });
                } else {
                  navigation.navigate("QuizPlayer", {
                    mode: mode.id as "mixed" | "wrong",
                    topicId: undefined,
                  });
                }
              }}
              icon={<Feather name={mode.icon} size={24} color={mode.color} />}
              disabled={mode.disabled}
              testID={`card-quiz-${mode.id}`}
              style={{ marginBottom: Spacing.md }}
            />
          ))}
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>SETTINGS</ThemedText>
          <GlassCard
            title="Quiz Settings"
            subtitle="Timer, question count, difficulty"
            onPress={() => navigation.navigate("QuizSettings")}
            icon={
              <Feather
                name="settings"
                size={24}
                color={theme.textSecondary}
              />
            }
            testID="card-quiz-settings"
          />
        </View>
      </ScrollView>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  statsRow: {
    flexDirection: "row",
    marginBottom: Spacing["2xl"],
  },
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#11a4d4",
    marginBottom: Spacing.lg,
  },
});
