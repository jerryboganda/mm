import React from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { StatCard } from "@/components/StatCard";
import { LoadingSkeleton, CardSkeleton } from "@/components/LoadingSkeleton";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type AttemptDetailRouteProp = RouteProp<RootStackParamList, "AttemptDetail">;

interface QuestionDetail {
  id: string;
  question: string;
  options: { label: string; text: string }[];
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
}

interface AttemptDetail {
  id: string;
  date: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  timeTaken?: number;
  mode: string;
  topicId?: string;
  topicTitle?: string;
  questions: QuestionDetail[];
}

export default function AttemptDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<AttemptDetailRouteProp>();
  const { attemptId } = route.params;
  const { theme } = useTheme();

  const { data: attempt, isLoading } = useQuery<AttemptDetail>({
    queryKey: ["/api/attempts", attemptId],
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTime = (seconds?: number) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case "topic":
        return "Topic Quiz";
      case "mixed":
        return "Mixed Quiz";
      case "wrong":
        return "Wrong Questions";
      default:
        return mode;
    }
  };

  const isHighScore = (attempt?.score || 0) >= 80;

  if (isLoading) {
    return (
      <BackgroundGradient>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.content,
            { paddingTop: headerHeight + Spacing.xl },
          ]}
        >
          <LoadingSkeleton
            width="100%"
            height={120}
            style={{ marginBottom: 16 }}
          />
          <View style={styles.statsRow}>
            <CardSkeleton />
          </View>
          <CardSkeleton />
          <CardSkeleton />
        </ScrollView>
      </BackgroundGradient>
    );
  }

  if (!attempt) {
    return (
      <BackgroundGradient>
        <View style={[styles.emptyContainer, { paddingTop: headerHeight }]}>
          <ThemedText>Attempt not found</ThemedText>
        </View>
      </BackgroundGradient>
    );
  }

  return (
    <BackgroundGradient>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <View style={styles.scoreSection}>
          <View
            style={[
              styles.scoreCircle,
              isHighScore && styles.scoreCircleSuccess,
            ]}
          >
            <LinearGradient
              colors={
                isHighScore
                  ? [theme.success, "#16a34a"]
                  : [theme.primary, theme.primaryDark]
              }
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <ThemedText type="h1" style={styles.scoreValue}>
              {attempt.score}%
            </ThemedText>
          </View>
          <ThemedText type="h3" style={styles.modeTitle}>
            {getModeLabel(attempt.mode)}
          </ThemedText>
          {attempt.topicTitle ? (
            <ThemedText style={[styles.topicName, { color: theme.textSecondary }]}>
              {attempt.topicTitle}
            </ThemedText>
          ) : null}
          <ThemedText style={[styles.dateText, { color: theme.textMuted }]}>
            {formatDate(attempt.date)}
          </ThemedText>
        </View>

        <View style={styles.statsRow}>
          <StatCard
            label="Correct"
            value={attempt.correctCount}
            icon="check-circle"
            color={theme.success}
          />
          <View style={{ width: Spacing.md }} />
          <StatCard
            label="Wrong"
            value={attempt.wrongCount}
            icon="x-circle"
            color={theme.error}
          />
          <View style={{ width: Spacing.md }} />
          <StatCard
            label="Time"
            value={formatTime(attempt.timeTaken)}
            icon="clock"
            color={theme.info}
          />
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>QUESTION REVIEW</ThemedText>
          {attempt.questions.map((q, index) => (
            <GlassCard
              key={q.id}
              active={false}
              style={[
                styles.questionCard,
                { borderLeftColor: q.isCorrect ? theme.success : theme.error },
              ]}
            >
              <View style={styles.questionHeader}>
                <View
                  style={[
                    styles.questionBadge,
                    {
                      backgroundColor: q.isCorrect
                        ? theme.success
                        : theme.error,
                    },
                  ]}
                >
                  <Feather
                    name={q.isCorrect ? "check" : "x"}
                    size={14}
                    color="#fff"
                  />
                </View>
                <ThemedText style={[styles.questionNumber, { color: theme.textSecondary }]}>
                  Question {index + 1}
                </ThemedText>
              </View>

              <ThemedText style={[styles.questionText, { color: theme.text }]}>{q.question}</ThemedText>

              <View style={styles.answersContainer}>
                {q.options.map((option) => {
                  const isSelected = option.label === q.selectedAnswer;
                  const isCorrect = option.label === q.correctAnswer;
                  return (
                    <View
                      key={option.label}
                      style={[
                        styles.answerOption,
                        { backgroundColor: theme.glass },
                        isSelected && !isCorrect && { backgroundColor: `${theme.error}15` },
                        isCorrect && { backgroundColor: `${theme.success}15` },
                      ]}
                    >
                      <View style={[styles.optionLabel, { backgroundColor: theme.glass }]}>
                        <ThemedText
                          style={[
                            styles.optionLabelText,
                            { color: theme.textSecondary },
                            isCorrect && { color: theme.success },
                            isSelected &&
                            !isCorrect && { color: theme.error },
                          ]}
                        >
                          {option.label}
                        </ThemedText>
                      </View>
                      <ThemedText
                        style={[
                          styles.optionText,
                          { color: theme.text },
                          isCorrect && { color: theme.success },
                          isSelected &&
                          !isCorrect && { color: theme.error },
                        ]}
                      >
                        {option.text}
                      </ThemedText>
                      {isSelected ? (
                        <Feather
                          name={isCorrect ? "check-circle" : "x-circle"}
                          size={16}
                          color={
                            isCorrect ? theme.success : theme.error
                          }
                          style={styles.optionIcon}
                        />
                      ) : isCorrect ? (
                        <Feather
                          name="check-circle"
                          size={16}
                          color={theme.success}
                          style={styles.optionIcon}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </View>

              {q.explanation ? (
                <View style={[styles.explanationContainer, { backgroundColor: `${theme.info}10` }]}>
                  <View style={styles.explanationHeader}>
                    <Feather name="info" size={14} color={theme.info} />
                    <ThemedText style={[styles.explanationLabel, { color: theme.info }]}>
                      Explanation
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.explanationText, { color: theme.textSecondary }]}>
                    {q.explanation}
                  </ThemedText>
                </View>
              ) : null}
            </GlassCard>
          ))}
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
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreSection: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  scoreCircleSuccess: {},
  scoreValue: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
  },
  modeTitle: {
    marginBottom: Spacing.xs,
  },
  topicName: {
    fontSize: 14,
    marginBottom: Spacing.xs,
  },
  dateText: {
    fontSize: 12,
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
  questionCard: {
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
  },
  questionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  questionBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  questionNumber: {
    fontSize: 14,
    fontWeight: "600",
  },
  questionText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  answersContainer: {
    marginBottom: Spacing.md,
  },
  answerOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  optionLabel: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  optionLabelText: {
    fontSize: 12,
    fontWeight: "600",
  },
  optionText: {
    flex: 1,
    fontSize: 14,
  },
  optionIcon: {
    marginLeft: Spacing.sm,
  },
  explanationContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  explanationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  explanationLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: Spacing.xs,
  },
  explanationText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
