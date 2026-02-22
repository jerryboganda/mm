import React, { useState, useCallback, useRef } from "react";
import { StyleSheet, View, Pressable, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { PrimaryButton } from "@/components/PrimaryButton";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ThemedText } from "@/components/ThemedText";
import { OptionButton } from "@/components/OptionButton";
import { apiRequest, queryClient } from "@/lib/query-client";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

interface ReviewQuestion {
  reviewId: string;
  mcqId: string;
  question: string;
  options: { label: string; text: string }[];
  difficulty: string;
  interval: number;
  repetitions: number;
}

interface ReviewResponse {
  questions: ReviewQuestion[];
}

export default function SpacedReviewScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    reviewed: 0,
    easy: 0,
    good: 0,
    hard: 0,
    again: 0,
  });
  const [isComplete, setIsComplete] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const QUALITY_OPTIONS = [
    {
      value: 0,
      label: "No Clue",
      color: theme.error,
      icon: "x-circle",
    },
    {
      value: 2,
      label: "Hard",
      color: theme.warning,
      icon: "alert-circle",
    },
    {
      value: 4,
      label: "Good",
      color: theme.info,
      icon: "check-circle",
    },
    {
      value: 5,
      label: "Easy",
      color: theme.success,
      icon: "star",
    },
  ] as const;

  const { data, isLoading } = useQuery<ReviewResponse>({
    queryKey: ["/api/reviews/due"],
  });

  const submitMutation = useMutation({
    mutationFn: async ({
      reviewId,
      quality,
    }: {
      reviewId: string;
      quality: number;
    }) => {
      await apiRequest("POST", "/api/reviews/submit", { reviewId, quality });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/due-count"] });
    },
  });

  const questions = data?.questions || [];
  const currentQuestion = questions[currentIndex];
  const progress =
    questions.length > 0
      ? (currentIndex + (showAnswer ? 1 : 0)) / questions.length
      : 0;

  const handleOptionSelect = useCallback(
    (optionLabel: string) => {
      if (showAnswer) return;
      setSelectedOption(optionLabel);
    },
    [showAnswer],
  );

  const handleCheckAnswer = useCallback(() => {
    if (!selectedOption || !currentQuestion) return;
    setShowAnswer(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [selectedOption, currentQuestion]);

  const handleQualityRating = useCallback(
    (quality: number) => {
      if (!currentQuestion) return;

      setSessionStats((prev) => ({
        reviewed: prev.reviewed + 1,
        easy: prev.easy + (quality === 5 ? 1 : 0),
        good: prev.good + (quality === 4 ? 1 : 0),
        hard: prev.hard + (quality === 2 ? 1 : 0),
        again: prev.again + (quality === 0 ? 1 : 0),
      }));

      submitMutation.mutate({
        reviewId: currentQuestion.reviewId,
        quality,
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();

      if (currentIndex < questions.length - 1) {
        setTimeout(() => {
          setCurrentIndex((prev) => prev + 1);
          setSelectedOption(null);
          setShowAnswer(false);
        }, 150);
      } else {
        setTimeout(() => {
          setIsComplete(true);
        }, 200);
      }
    },
    [currentQuestion, currentIndex, questions.length, fadeAnim, submitMutation],
  );

  // Empty state
  if (!isLoading && questions.length === 0) {
    return (
      <BackgroundGradient>
        <View style={[styles.emptyContainer, { paddingTop: insets.top + 60 }]}>
          <View style={styles.emptyIcon}>
            <Feather
              name="check-circle"
              size={64}
              color={theme.success}
            />
          </View>
          <ThemedText type="h2" style={styles.emptyTitle}>
            All Caught Up!
          </ThemedText>
          <ThemedText
            style={[styles.emptySubtitle, { color: theme.textSecondary }]}
          >
            No reviews due right now. Keep studying and your review cards will
            appear here automatically.
          </ThemedText>
          <PrimaryButton
            title="Go Back"
            onPress={() => navigation.goBack()}
            icon="arrow-left"
            style={{ marginTop: Spacing.xl }}
          />
        </View>
      </BackgroundGradient>
    );
  }

  // Session complete
  if (isComplete) {
    return (
      <BackgroundGradient>
        <View style={[styles.emptyContainer, { paddingTop: insets.top + 60 }]}>
          <View style={styles.emptyIcon}>
            <Feather name="award" size={64} color={theme.primary} />
          </View>
          <ThemedText type="h2" style={styles.emptyTitle}>
            Review Complete!
          </ThemedText>
          <ThemedText
            style={[styles.emptySubtitle, { color: theme.textSecondary }]}
          >
            You reviewed {sessionStats.reviewed} cards this session.
          </ThemedText>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <ThemedText
                style={[styles.statValue, { color: theme.success }]}
              >
                {sessionStats.easy}
              </ThemedText>
              <ThemedText
                style={[styles.statLabel, { color: theme.textSecondary }]}
              >
                Easy
              </ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText
                style={[styles.statValue, { color: theme.info }]}
              >
                {sessionStats.good}
              </ThemedText>
              <ThemedText
                style={[styles.statLabel, { color: theme.textSecondary }]}
              >
                Good
              </ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText
                style={[styles.statValue, { color: theme.warning }]}
              >
                {sessionStats.hard}
              </ThemedText>
              <ThemedText
                style={[styles.statLabel, { color: theme.textSecondary }]}
              >
                Hard
              </ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText
                style={[styles.statValue, { color: theme.error }]}
              >
                {sessionStats.again}
              </ThemedText>
              <ThemedText
                style={[styles.statLabel, { color: theme.textSecondary }]}
              >
                Again
              </ThemedText>
            </View>
          </View>

          <PrimaryButton
            title="Done"
            onPress={() => navigation.goBack()}
            icon="check"
            style={{ marginTop: Spacing["2xl"] }}
          />
        </View>
      </BackgroundGradient>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <BackgroundGradient>
        <View style={[styles.container, { paddingTop: insets.top + 60 }]}>
          <LoadingSkeleton
            width="100%"
            height={32}
            style={{ marginBottom: 24 }}
          />
          <LoadingSkeleton
            width="100%"
            height={120}
            style={{ marginBottom: 16 }}
          />
          <LoadingSkeleton
            width="100%"
            height={56}
            style={{ marginBottom: 12 }}
          />
          <LoadingSkeleton
            width="100%"
            height={56}
            style={{ marginBottom: 12 }}
          />
          <LoadingSkeleton
            width="100%"
            height={56}
            style={{ marginBottom: 12 }}
          />
          <LoadingSkeleton width="100%" height={56} />
        </View>
      </BackgroundGradient>
    );
  }

  return (
    <BackgroundGradient>
      <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.closeButton}
          >
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <ThemedText
              style={[styles.counterText, { color: theme.textSecondary }]}
            >
              {currentIndex + 1} / {questions.length}
            </ThemedText>
          </View>
          <View style={styles.closeButton} />
        </View>

        {/* Progress Bar */}
        <View style={[styles.progressBar, { backgroundColor: theme.glass }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress * 100}%`, backgroundColor: theme.primary },
            ]}
          />
        </View>

        {/* Card */}
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: theme.glass,
              borderColor: theme.glassBorder,
              opacity: fadeAnim,
            },
          ]}
        >
          {currentQuestion?.difficulty && (
            <View
              style={[
                styles.difficultyBadge,
                { backgroundColor: `${theme.purple}26` },
              ]}
            >
              <ThemedText
                style={[styles.difficultyText, { color: theme.purple }]}
              >
                {currentQuestion.difficulty}
              </ThemedText>
            </View>
          )}

          <ThemedText type="h3" style={styles.questionText}>
            {currentQuestion?.question}
          </ThemedText>

          <View style={styles.optionsContainer}>
            {currentQuestion?.options.map((option) => (
              <OptionButton
                key={option.label}
                label={option.label}
                text={option.text}
                selected={selectedOption === option.label}
                onPress={() => handleOptionSelect(option.label)}
                disabled={showAnswer}
              />
            ))}
          </View>

          {!showAnswer ? (
            <PrimaryButton
              title="Check Answer"
              onPress={handleCheckAnswer}
              disabled={!selectedOption}
              icon="eye"
              style={{ marginTop: Spacing.lg }}
            />
          ) : (
            <View
              style={[
                styles.qualityContainer,
                { borderTopColor: theme.glassBorder },
              ]}
            >
              <ThemedText
                style={[styles.qualityLabel, { color: theme.textSecondary }]}
              >
                How well did you know this?
              </ThemedText>
              <View style={styles.qualityButtons}>
                {QUALITY_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.qualityButton,
                      {
                        borderColor: opt.color,
                        backgroundColor: theme.glass,
                      },
                    ]}
                    onPress={() => handleQualityRating(opt.value)}
                  >
                    <Feather
                      name={opt.icon as any}
                      size={20}
                      color={opt.color}
                    />
                    <ThemedText
                      style={[styles.qualityButtonText, { color: opt.color }]}
                    >
                      {opt.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </Animated.View>

        {/* Review info */}
        {currentQuestion && (
          <View style={styles.reviewInfo}>
            <Feather
              name="repeat"
              size={14}
              color={theme.textSecondary}
            />
            <ThemedText
              style={[styles.reviewInfoText, { color: theme.textSecondary }]}
            >
              {currentQuestion.repetitions === 0
                ? "First review"
                : `Reviewed ${currentQuestion.repetitions} time${currentQuestion.repetitions > 1 ? "s" : ""
                }`}
              {currentQuestion.interval > 0
                ? ` · Next in ${currentQuestion.interval} day${currentQuestion.interval > 1 ? "s" : ""
                }`
                : ""}
            </ThemedText>
          </View>
        )}
      </View>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  counterText: {
    fontSize: 15,
    fontWeight: "600",
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.xl,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  card: {
    borderRadius: BorderRadius["2xl"],
    padding: Spacing.xl,
    borderWidth: 1,
  },
  difficultyBadge: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  questionText: {
    marginBottom: Spacing.xl,
    lineHeight: 28,
  },
  optionsContainer: {
    gap: Spacing.sm,
  },
  qualityContainer: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  qualityLabel: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  qualityButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  qualityButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  qualityButtonText: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  reviewInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xl,
    gap: Spacing.xs,
  },
  reviewInfoText: {
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  emptySubtitle: {
    textAlign: "center",
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: Spacing["2xl"],
    paddingHorizontal: Spacing.lg,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 13,
    marginTop: 4,
  },
});
