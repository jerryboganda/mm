import React from "react";
import { StyleSheet, View, ScrollView, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatCard } from "@/components/StatCard";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type QuizResultsRouteProp = RouteProp<RootStackParamList, "QuizResults">;
type QuizResultsNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "QuizResults"
>;

interface QuestionResult {
  id: string;
  question: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
}

interface QuizResult {
  id: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  timeTaken: number;
  questions: QuestionResult[];
}

export default function QuizResultsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<QuizResultsNavigationProp>();
  const route = useRoute<QuizResultsRouteProp>();
  const { resultId } = route.params;
  const { theme } = useTheme();

  const { data: result } = useQuery<QuizResult>({
    queryKey: ["/api/quiz/results", resultId],
  });

  const isHighScore = (result?.score || 0) >= 80;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <BackgroundGradient>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing["3xl"],
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
        ]}
      >
        <View
          style={styles.scoreSection}
          accessibilityRole="summary"
          accessibilityLabel={
            result
              ? `You scored ${result.correctCount} out of ${result.totalQuestions}, that's ${result.score} percent`
              : undefined
          }
        >
          {isHighScore ? (
            <Image
              source={require("../../assets/images/quiz-success.png")}
              style={styles.successImage}
              resizeMode="contain"
              accessibilityLabel="Quiz success celebration"
            />
          ) : null}

          <View
            style={[
              styles.scoreCircle,
              isHighScore && { shadowColor: theme.success },
            ]}
          >
            <LinearGradient
              colors={
                isHighScore
                  ? [theme.success, theme.successGlow || theme.success]
                  : [theme.primary, theme.primaryDark || theme.text]
              }
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <ThemedText type="h1" style={styles.scoreValue}>
              {result?.score || 0}%
            </ThemedText>
            <ThemedText style={styles.scoreLabel}>Your Score</ThemedText>
          </View>

          <ThemedText
            type="h2"
            style={styles.resultTitle}
            accessibilityRole="header"
          >
            {isHighScore ? "Excellent Work!" : "Keep Practicing!"}
          </ThemedText>
          <ThemedText
            style={[styles.resultSubtitle, { color: theme.textSecondary }]}
          >
            {isHighScore
              ? "You've mastered this topic!"
              : "Review your answers and try again."}
          </ThemedText>
        </View>

        <View style={styles.statsRow}>
          <StatCard
            label="Correct"
            value={result?.correctCount || 0}
            icon="check-circle"
            color={theme.success}
          />
          <View style={{ width: Spacing.md }} />
          <StatCard
            label="Wrong"
            value={result?.wrongCount || 0}
            icon="x-circle"
            color={theme.error}
          />
          <View style={{ width: Spacing.md }} />
          <StatCard
            label="Time"
            value={formatTime(result?.timeTaken || 0)}
            icon="clock"
            color={theme.textMuted}
          />
        </View>

        <View style={styles.reviewSection}>
          <ThemedText style={[styles.sectionLabel, { color: theme.primary }]}>
            ANSWER REVIEW
          </ThemedText>
          {result?.questions.map((q, index) => (
            <GlassCard
              key={q.id}
              active={false}
              style={[
                styles.questionCard,
                q.isCorrect
                  ? { borderColor: `${theme.success}4D` }
                  : { borderColor: `${theme.error}4D` },
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
                <ThemedText
                  style={[styles.questionIndex, { color: theme.textSecondary }]}
                >
                  Q{index + 1}
                </ThemedText>
              </View>
              <ThemedText style={styles.questionText} numberOfLines={4}>
                {q.question}
              </ThemedText>
              <View style={styles.answerRow}>
                <ThemedText
                  style={[styles.answerLabel, { color: theme.textSecondary }]}
                >
                  Your answer:
                </ThemedText>
                <ThemedText
                  style={[
                    styles.answerValue,
                    {
                      color: q.isCorrect ? theme.success : theme.error,
                    },
                  ]}
                >
                  {q.selectedAnswer}
                </ThemedText>
              </View>
              {!q.isCorrect ? (
                <View style={styles.answerRow}>
                  <ThemedText
                    style={[styles.answerLabel, { color: theme.textSecondary }]}
                  >
                    Correct answer:
                  </ThemedText>
                  <ThemedText
                    style={[styles.answerValue, { color: theme.success }]}
                  >
                    {q.correctAnswer}
                  </ThemedText>
                </View>
              ) : null}
              <View
                style={[
                  styles.explanationBox,
                  { backgroundColor: `${theme.primary}1A` },
                ]}
              >
                <Feather name="info" size={14} color={theme.primary} />
                <ThemedText
                  style={[
                    styles.explanationText,
                    { color: theme.textSecondary },
                  ]}
                >
                  {q.explanation}
                </ThemedText>
              </View>
            </GlassCard>
          ))}
        </View>

        <View style={styles.actionsSection}>
          <PrimaryButton
            title="Back to Practice"
            onPress={() => navigation.popToTop()}
            icon="arrow-left"
            testID="button-back-to-practice"
          />
          <PrimaryButton
            title="Retry Quiz"
            onPress={() => navigation.goBack()}
            variant="secondary"
            style={[
              styles.retryButton,
              { backgroundColor: theme.glass, borderColor: theme.glassBorder },
            ]}
            testID="button-retry-quiz"
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
  scoreSection: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  successImage: {
    width: 120,
    height: 120,
    marginBottom: Spacing.lg,
  },
  scoreCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: Spacing["2xl"],
    ...Shadows.glow,
  },
  scoreValue: {
    color: "#fff",
    fontSize: 40,
    fontWeight: "700",
  },
  scoreLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "500",
  },
  resultTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  resultSubtitle: {
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    marginBottom: Spacing["3xl"],
  },
  reviewSection: {
    marginBottom: Spacing["2xl"],
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: Spacing.lg,
  },
  questionCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
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
  questionIndex: {
    fontSize: 12,
    fontWeight: "600",
  },
  questionText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  answerRow: {
    flexDirection: "row",
    marginBottom: Spacing.xs,
  },
  answerLabel: {
    fontSize: 13,
    marginRight: Spacing.sm,
  },
  answerValue: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  explanationBox: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  explanationText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    marginLeft: Spacing.sm,
  },
  actionsSection: {
    marginTop: Spacing["2xl"],
  },
  retryButton: {
    marginTop: Spacing.md,
    borderWidth: 1,
  },
});
