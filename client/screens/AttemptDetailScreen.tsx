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
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
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
                  ? [Colors.dark.success, "#16a34a"]
                  : [Colors.dark.primary, Colors.dark.primaryDark]
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
            <ThemedText style={styles.topicName}>
              {attempt.topicTitle}
            </ThemedText>
          ) : null}
          <ThemedText style={styles.dateText}>
            {formatDate(attempt.date)}
          </ThemedText>
        </View>

        <View style={styles.statsRow}>
          <StatCard
            label="Correct"
            value={attempt.correctCount}
            icon="check-circle"
            color={Colors.dark.success}
          />
          <View style={{ width: Spacing.md }} />
          <StatCard
            label="Wrong"
            value={attempt.wrongCount}
            icon="x-circle"
            color={Colors.dark.error}
          />
          <View style={{ width: Spacing.md }} />
          <StatCard
            label="Time"
            value={formatTime(attempt.timeTaken)}
            icon="clock"
            color={Colors.dark.info}
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
                q.isCorrect ? styles.questionCorrect : styles.questionWrong,
              ]}
            >
              <View style={styles.questionHeader}>
                <View
                  style={[
                    styles.questionBadge,
                    {
                      backgroundColor: q.isCorrect
                        ? Colors.dark.success
                        : Colors.dark.error,
                    },
                  ]}
                >
                  <Feather
                    name={q.isCorrect ? "check" : "x"}
                    size={14}
                    color="#fff"
                  />
                </View>
                <ThemedText style={styles.questionNumber}>
                  Question {index + 1}
                </ThemedText>
              </View>

              <ThemedText style={styles.questionText}>{q.question}</ThemedText>

              <View style={styles.answersContainer}>
                {q.options.map((option) => {
                  const isSelected = option.label === q.selectedAnswer;
                  const isCorrect = option.label === q.correctAnswer;
                  return (
                    <View
                      key={option.label}
                      style={[
                        styles.answerOption,
                        isSelected && !isCorrect && styles.answerWrong,
                        isCorrect && styles.answerCorrect,
                      ]}
                    >
                      <View style={styles.optionLabel}>
                        <ThemedText
                          style={[
                            styles.optionLabelText,
                            isCorrect && { color: Colors.dark.success },
                            isSelected &&
                              !isCorrect && { color: Colors.dark.error },
                          ]}
                        >
                          {option.label}
                        </ThemedText>
                      </View>
                      <ThemedText
                        style={[
                          styles.optionText,
                          isCorrect && { color: Colors.dark.success },
                          isSelected &&
                            !isCorrect && { color: Colors.dark.error },
                        ]}
                      >
                        {option.text}
                      </ThemedText>
                      {isSelected ? (
                        <Feather
                          name={isCorrect ? "check-circle" : "x-circle"}
                          size={16}
                          color={
                            isCorrect ? Colors.dark.success : Colors.dark.error
                          }
                          style={styles.optionIcon}
                        />
                      ) : isCorrect ? (
                        <Feather
                          name="check-circle"
                          size={16}
                          color={Colors.dark.success}
                          style={styles.optionIcon}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </View>

              {q.explanation ? (
                <View style={styles.explanationContainer}>
                  <View style={styles.explanationHeader}>
                    <Feather name="info" size={14} color={Colors.dark.info} />
                    <ThemedText style={styles.explanationLabel}>
                      Explanation
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.explanationText}>
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
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.xs,
  },
  dateText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
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
    letterSpacing: 1.5,
    color: Colors.dark.textMuted,
    marginBottom: Spacing.lg,
  },
  questionCard: {
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
  },
  questionCorrect: {
    borderLeftColor: Colors.dark.success,
  },
  questionWrong: {
    borderLeftColor: Colors.dark.error,
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
    color: Colors.dark.textSecondary,
  },
  questionText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.dark.text,
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
    backgroundColor: Colors.dark.glass,
  },
  answerWrong: {
    backgroundColor: `${Colors.dark.error}15`,
  },
  answerCorrect: {
    backgroundColor: `${Colors.dark.success}15`,
  },
  optionLabel: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.dark.glass,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  optionLabelText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: Colors.dark.text,
  },
  optionIcon: {
    marginLeft: Spacing.sm,
  },
  explanationContainer: {
    padding: Spacing.md,
    backgroundColor: `${Colors.dark.info}10`,
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
    color: Colors.dark.info,
    marginLeft: Spacing.xs,
  },
  explanationText: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.dark.textSecondary,
  },
});
