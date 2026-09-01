import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Alert,
  BackHandler,
  Modal,
  ScrollView,
  AppState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  RouteProp,
  useFocusEffect,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "@/lib/haptics-wrapper";
import { BlurView } from "expo-blur";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { AppModalSurface } from "@/components/AppModalSurface";
import { OptionButton } from "@/components/OptionButton";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ProgressBar } from "@/components/ProgressBar";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { MetaPillRow } from "@/components/MetaPill";
import { ThemedText } from "@/components/ThemedText";
import { apiRequest, queryClient } from "@/lib/query-client";
import { useNetwork } from "@/lib/network";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useFeedback } from "@/lib/feedback";
import { useBottomLayout } from "@/hooks/useBottomLayout";

type QuizPlayerRouteProp = RouteProp<RootStackParamList, "QuizPlayer">;
type QuizPlayerNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "QuizPlayer"
>;

interface QuizQuestion {
  id: string;
  question: string;
  options: { label: string; text: string }[];
  difficulty: "easy" | "medium" | "hard";
  year?: number | null;
  sourceName?: string | null;
  subjectName?: string | null;
}

interface QuizData {
  quizId: string;
  questions: QuizQuestion[];
  timeLimit?: number;
}

export default function QuizPlayerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<QuizPlayerNavigationProp>();
  const route = useRoute<QuizPlayerRouteProp>();
  const {
    mode,
    topicId,
    questionCount: paramQuestionCount,
    year: paramYear,
    sourceId: paramSourceId,
  } = route.params;
  const isExamMode = mode === "exam";
  const { theme, isDark } = useTheme();
  const feedback = useFeedback();
  const { isOffline } = useNetwork();
  const bottomLayout = useBottomLayout();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showNavigator, setShowNavigator] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const timerStartRef = useRef<number | null>(null);
  const totalTimerSecondsRef = useRef<number>(0);
  const warned60Ref = useRef(false);
  const warned30Ref = useRef(false);

  const {
    data: quizData,
    isLoading,
    error,
  } = useQuery<QuizData>({
    queryKey: [
      "/api/quiz/start",
      mode === "exam" ? "mixed" : mode,
      topicId,
      paramQuestionCount,
      paramYear ?? null,
      paramSourceId ?? null,
    ],
    queryFn: async () => {
      const queryMode = mode === "exam" ? "mixed" : mode;
      const countParam = paramQuestionCount
        ? `&count=${paramQuestionCount}`
        : "";
      const topicParam = topicId ? `&topicId=${topicId}` : "";
      const yearParam = paramYear ? `&year=${paramYear}` : "";
      const sourceParam = paramSourceId ? `&sourceId=${paramSourceId}` : "";
      const res = await apiRequest(
        "GET",
        `/api/quiz/start/${queryMode}?${topicParam}${countParam}${yearParam}${sourceParam}`,
      );
      return res.json();
    },
  });

  useEffect(() => {
    if (error) {
      const errStr = String((error as Error)?.message || error);
      if (errStr.includes("403") || errStr.includes("SUBSCRIPTION_REQUIRED")) {
        navigation.navigate("Paywall");
      }
    }
  }, [error, navigation]);

  const submitMutation = useMutation({
    mutationFn: async (data: {
      quizId: string;
      answers: Record<string, string>;
      mode: string;
      topicId?: string;
    }) => {
      const response = await apiRequest("POST", "/api/quiz/submit", data);
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quiz/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quiz/start", "wrong"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attempts"] });
      navigation.replace("QuizResults", { resultId: result.id });
    },
    onError: (err: Error) => {
      const errStr = String(err?.message || err);
      if (errStr.includes("403") || errStr.includes("SUBSCRIPTION_REQUIRED")) {
        navigation.navigate("Paywall");
      }
    },
  });

  const currentQuestion = quizData?.questions[currentIndex];
  const totalQuestions = quizData?.questions.length || 0;
  const progress =
    totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;
  const answeredCount = Object.keys(answers).length;
  const unansweredCount = totalQuestions - answeredCount;

  const confirmSubmit = useCallback(() => {
    if (!quizData) return;
    if (isOffline) {
      Alert.alert(
        "No Internet",
        "Quiz submission requires an internet connection. Your answers are saved \u2014 please submit when you\u2019re back online.",
      );
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    feedback.playSound("success");
    setShowSubmitModal(false);
    submitMutation.mutate({
      quizId: quizData.quizId,
      answers,
      mode,
      topicId,
    });
  }, [answers, feedback, isOffline, mode, quizData, submitMutation, topicId]);

  useEffect(() => {
    if (quizData?.timeLimit) {
      const totalSecs = quizData.timeLimit * 60;
      totalTimerSecondsRef.current = totalSecs;
      timerStartRef.current = Date.now();
      setTimeRemaining(totalSecs);
    }
  }, [quizData?.timeLimit]);

  // Recalculate time remaining when app returns from background
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        nextState === "active" &&
        timerStartRef.current &&
        totalTimerSecondsRef.current > 0
      ) {
        const elapsedSecs = Math.floor(
          (Date.now() - timerStartRef.current) / 1000,
        );
        const remaining = totalTimerSecondsRef.current - elapsedSecs;
        if (remaining <= 0) {
          setTimeRemaining(0);
          confirmSubmit();
        } else {
          setTimeRemaining(remaining);
        }
      }
    });
    return () => subscription.remove();
  }, [confirmSubmit]);

  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      if (!timerStartRef.current) return;
      const elapsedSecs = Math.floor(
        (Date.now() - timerStartRef.current) / 1000,
      );
      const remaining = totalTimerSecondsRef.current - elapsedSecs;
      if (remaining <= 0) {
        setTimeRemaining(0);
        confirmSubmit();
      } else {
        setTimeRemaining(remaining);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [confirmSubmit, timeRemaining]);

  // Haptic pulse at timer warning thresholds
  useEffect(() => {
    if (timeRemaining === null) return;
    if (timeRemaining <= 60 && timeRemaining > 30 && !warned60Ref.current) {
      warned60Ref.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    if (timeRemaining <= 30 && !warned30Ref.current) {
      warned30Ref.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [timeRemaining]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        Alert.alert(
          "Quit Quiz?",
          "Your progress will be lost if you leave now.",
          [
            { text: "Continue Quiz", style: "cancel" },
            {
              text: "Quit",
              style: "destructive",
              onPress: () => navigation.goBack(),
            },
          ],
        );
        return true;
      };

      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );
      return () => backHandler.remove();
    }, [navigation]),
  );

  const handleSelectOption = (label: string) => {
    if (!currentQuestion) return;
    setSelectedOption(label);
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: label }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    feedback.playSound("tap");
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(
        answers[quizData!.questions[currentIndex + 1]?.id] || null,
      );
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setSelectedOption(
        answers[quizData!.questions[currentIndex - 1]?.id] || null,
      );
    }
  };

  const handleJumpToQuestion = (index: number) => {
    setCurrentIndex(index);
    setSelectedOption(answers[quizData!.questions[index]?.id] || null);
    setShowNavigator(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSubmitPress = () => {
    setShowSubmitModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <BackgroundGradient>
        <View
          style={[
            styles.container,
            { paddingTop: insets.top + Spacing["3xl"] },
          ]}
        >
          <LoadingSkeleton
            width="60%"
            height={20}
            style={{ marginBottom: 24 }}
          />
          <LoadingSkeleton
            width="100%"
            height={100}
            style={{ marginBottom: 24 }}
          />
          <LoadingSkeleton
            width="100%"
            height={60}
            style={{ marginBottom: 12 }}
          />
          <LoadingSkeleton
            width="100%"
            height={60}
            style={{ marginBottom: 12 }}
          />
          <LoadingSkeleton
            width="100%"
            height={60}
            style={{ marginBottom: 12 }}
          />
          <LoadingSkeleton width="100%" height={60} />
        </View>
      </BackgroundGradient>
    );
  }

  const isLastQuestion = currentIndex === totalQuestions - 1;

  return (
    <BackgroundGradient variant="quiz">
      <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
        {isExamMode && (
          <View
            style={[
              styles.examBanner,
              {
                backgroundColor: `${theme.warning}26`,
                borderColor: `${theme.warning}4D`,
              },
            ]}
          >
            <Feather name="award" size={16} color={theme.warning} />
            <ThemedText
              style={[styles.examBannerText, { color: theme.warning }]}
            >
              Exam Simulation Mode
            </ThemedText>
          </View>
        )}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              Alert.alert("Quit Quiz?", "Your progress will be lost.", [
                { text: "Continue", style: "cancel" },
                {
                  text: "Quit",
                  style: "destructive",
                  onPress: () => navigation.goBack(),
                },
              ]);
            }}
            style={[styles.closeButton, { backgroundColor: theme.glass }]}
            accessibilityRole="button"
            accessibilityLabel="Quit quiz"
          >
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>

          <View style={styles.progressInfo}>
            <Pressable
              onPress={() => setShowNavigator(true)}
              style={[styles.questionCounter, { backgroundColor: theme.glass }]}
              accessibilityRole="button"
              accessibilityLabel={`Question ${currentIndex + 1} of ${totalQuestions}. Open question navigator`}
            >
              <ThemedText
                style={[styles.questionNumber, { color: theme.textSecondary }]}
              >
                {currentIndex + 1} / {totalQuestions}
              </ThemedText>
              <Feather
                name="grid"
                size={16}
                color={theme.textSecondary}
                style={{ marginLeft: 6 }}
              />
            </Pressable>
            {timeRemaining !== null ? (
              <View
                style={[
                  styles.timer,
                  { backgroundColor: theme.glass },
                  timeRemaining <= 60 &&
                    timeRemaining > 30 && {
                      backgroundColor: `${theme.warning}33`,
                    },
                  timeRemaining <= 30 && {
                    backgroundColor: `${theme.error}33`,
                  },
                ]}
              >
                <Feather
                  name="clock"
                  size={14}
                  color={
                    timeRemaining <= 30
                      ? theme.error
                      : timeRemaining <= 60
                        ? theme.warning
                        : theme.text
                  }
                />
                <ThemedText
                  style={[
                    styles.timerText,
                    timeRemaining <= 60 &&
                      timeRemaining > 30 && { color: theme.warning },
                    timeRemaining <= 30 && { color: theme.error },
                  ]}
                >
                  {formatTime(timeRemaining)}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>

        <ProgressBar
          progress={progress}
          height={4}
          style={styles.progressBar}
        />

        <View style={styles.questionContainer}>
          <View style={styles.difficultyRow}>
            <View
              style={[styles.difficultyBadge, { backgroundColor: theme.glass }]}
            >
              <ThemedText
                style={[styles.difficultyText, { color: theme.textSecondary }]}
              >
                {currentQuestion?.difficulty.toUpperCase()}
              </ThemedText>
            </View>
            <MetaPillRow
              year={currentQuestion?.year}
              subjectName={currentQuestion?.subjectName}
              sourceName={currentQuestion?.sourceName}
              style={{ flex: 1 }}
            />
          </View>
          <ThemedText type="h3" style={styles.questionText}>
            {currentQuestion?.question}
          </ThemedText>
        </View>

        <View style={styles.optionsContainer}>
          {currentQuestion?.options.map((option) => (
            <OptionButton
              key={option.label}
              label={option.label}
              text={option.text}
              selected={selectedOption === option.label}
              onPress={() => handleSelectOption(option.label)}
              testID={`option-${option.label}`}
            />
          ))}
        </View>

        <View
          style={[
            styles.footer,
            { paddingBottom: bottomLayout.baseBottomInset + Spacing.lg },
          ]}
        >
          <View style={styles.navButtons}>
            <Pressable
              onPress={handlePrevious}
              disabled={currentIndex === 0}
              style={[
                styles.navButton,
                { backgroundColor: theme.glass },
                currentIndex === 0 && styles.navButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Previous question"
              accessibilityState={{ disabled: currentIndex === 0 }}
            >
              <Feather name="chevron-left" size={24} color={theme.text} />
            </Pressable>

            {isLastQuestion ? (
              <PrimaryButton
                title="Submit Quiz"
                onPress={handleSubmitPress}
                loading={submitMutation.isPending}
                style={styles.submitButton}
                testID="button-submit-quiz"
              />
            ) : (
              <PrimaryButton
                title="Next"
                onPress={handleNext}
                disabled={!selectedOption}
                icon="arrow-right"
                style={styles.nextButton}
                testID="button-next-question"
              />
            )}
          </View>
        </View>
      </View>

      <Modal
        visible={showNavigator}
        animationType="slide"
        transparent
        accessibilityViewIsModal={true}
        onRequestClose={() => setShowNavigator(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowNavigator(false)}
          />
          <View
            style={[
              styles.navigatorSheet,
              {
                backgroundColor: theme.backgroundElevated,
                paddingBottom: bottomLayout.baseBottomInset + Spacing.lg,
              },
            ]}
          >
            <BlurView
              intensity={80}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[styles.navigatorHandle, { backgroundColor: theme.glass }]}
            />
            <View style={styles.navigatorHeader}>
              <ThemedText type="h4" accessibilityRole="header">
                Question Navigator
              </ThemedText>
              <Pressable
                onPress={() => setShowNavigator(false)}
                accessibilityRole="button"
                accessibilityLabel="Close question navigator"
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <View style={styles.navigatorStats}>
              <View style={[styles.statChip, { backgroundColor: theme.glass }]}>
                <View
                  style={[styles.statDot, { backgroundColor: theme.success }]}
                />
                <ThemedText
                  style={[styles.statText, { color: theme.textSecondary }]}
                >
                  {answeredCount} Answered
                </ThemedText>
              </View>
              <View style={[styles.statChip, { backgroundColor: theme.glass }]}>
                <View
                  style={[styles.statDot, { backgroundColor: theme.textMuted }]}
                />
                <ThemedText
                  style={[styles.statText, { color: theme.textSecondary }]}
                >
                  {unansweredCount} Unanswered
                </ThemedText>
              </View>
            </View>
            <ScrollView
              style={styles.navigatorGrid}
              contentContainerStyle={styles.navigatorGridContent}
            >
              <View style={styles.questionsGrid}>
                {quizData?.questions.map((q, index) => {
                  const isAnswered = Boolean(answers[q.id]);
                  const isCurrent = index === currentIndex;
                  return (
                    <Pressable
                      key={q.id}
                      onPress={() => handleJumpToQuestion(index)}
                      style={[
                        styles.questionDot,
                        { backgroundColor: theme.glass },
                        isAnswered && {
                          backgroundColor: `${theme.success}30`,
                          borderColor: theme.success,
                        },
                        isCurrent && {
                          borderColor: theme.primary,
                          borderWidth: 2,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Question ${index + 1}${isAnswered ? ", answered" : ", unanswered"}${isCurrent ? ", current" : ""}`}
                    >
                      <ThemedText
                        style={[
                          styles.questionDotText,
                          { color: theme.textMuted },
                          isAnswered && { color: theme.success },
                          isCurrent && { color: theme.primary },
                        ]}
                      >
                        {index + 1}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <AppModalSurface
        visible={showSubmitModal}
        variant="center"
        onClose={() => setShowSubmitModal(false)}
        dismissible={!submitMutation.isPending}
        scrollable
        accessibilityLabel="Submit quiz confirmation"
        footer={
          <View style={styles.submitModalButtons}>
            <Pressable
              onPress={() => setShowSubmitModal(false)}
              style={[
                styles.submitModalCancelButton,
                {
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: theme.glassBorder,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Review answers"
            >
              <ThemedText
                style={[styles.submitModalCancelText, { color: theme.text }]}
              >
                Review Answers
              </ThemedText>
            </Pressable>
            <PrimaryButton
              title="Submit"
              onPress={confirmSubmit}
              loading={submitMutation.isPending}
              style={styles.submitModalConfirmButton}
              testID="button-confirm-submit"
            />
          </View>
        }
      >
        <View
          style={[
            styles.submitModalIcon,
            { backgroundColor: `${theme.primary}20` },
          ]}
        >
          <Feather name="check-circle" size={48} color={theme.primary} />
        </View>
        <ThemedText type="h3" style={styles.submitModalTitle}>
          Submit Quiz?
        </ThemedText>
        <ThemedText
          style={[styles.submitModalText, { color: theme.textSecondary }]}
        >
          You&apos;ve answered {answeredCount} of {totalQuestions} questions.
          {unansweredCount > 0
            ? ` ${unansweredCount} question${unansweredCount > 1 ? "s" : ""} will be marked as incorrect.`
            : ""}
        </ThemedText>
        <View style={styles.submitModalStats}>
          <View style={styles.submitModalStat}>
            <Feather name="check" size={16} color={theme.success} />
            <ThemedText
              style={[
                styles.submitModalStatText,
                { color: theme.textSecondary },
              ]}
            >
              {answeredCount} Answered
            </ThemedText>
          </View>
          <View style={styles.submitModalStat}>
            <Feather name="minus" size={16} color={theme.textMuted} />
            <ThemedText
              style={[
                styles.submitModalStatText,
                { color: theme.textSecondary },
              ]}
            >
              {unansweredCount} Skipped
            </ThemedText>
          </View>
        </View>
      </AppModalSurface>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  examBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  examBannerText: {
    fontSize: 13,
    fontWeight: "600",
    marginLeft: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  progressInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  questionCounter: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  questionNumber: {
    fontSize: 14,
    fontWeight: "600",
  },
  timer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  timerText: {
    fontFamily: "monospace",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: Spacing.xs,
  },
  progressBar: {
    marginBottom: Spacing["2xl"],
  },
  questionContainer: {
    marginBottom: Spacing["2xl"],
  },
  difficultyRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  difficultyBadge: {
    alignSelf: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
  },
  questionText: {
    lineHeight: 32,
  },
  optionsContainer: {
    flex: 1,
    marginTop: Spacing.lg,
  },
  footer: {
    paddingTop: Spacing.lg,
  },
  navButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  navButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  nextButton: {
    flex: 1,
  },
  submitButton: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  navigatorSheet: {
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    maxHeight: "70%",
    overflow: "hidden",
  },
  navigatorHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  navigatorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  navigatorStats: {
    flexDirection: "row",
    marginBottom: Spacing.lg,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.md,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  statText: {
    fontSize: 12,
  },
  navigatorGrid: {
    flex: 1,
  },
  navigatorGridContent: {
    paddingBottom: Spacing.lg,
  },
  questionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  questionDot: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    margin: 4,
    borderWidth: 2,
    borderColor: "transparent",
  },
  questionDotText: {
    fontSize: 14,
    fontWeight: "600",
  },
  submitModalContent: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    top: "30%",
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    overflow: "hidden",
  },
  submitModalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    alignSelf: "center",
  },
  submitModalTitle: {
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  submitModalText: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  submitModalStats: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: Spacing.xl,
    gap: Spacing.xl,
  },
  submitModalStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  submitModalStatText: {
    fontSize: 14,
    fontWeight: "500",
  },
  submitModalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  submitModalCancelButton: {
    flex: 1,
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  submitModalCancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
  submitModalConfirmButton: {
    flex: 1,
  },
});
