import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Pressable, Alert, BackHandler } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { BackgroundGradient } from "@/components/BackgroundGradient";
import { OptionButton } from "@/components/OptionButton";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ProgressBar } from "@/components/ProgressBar";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ThemedText } from "@/components/ThemedText";
import { apiRequest, queryClient } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type QuizPlayerRouteProp = RouteProp<RootStackParamList, "QuizPlayer">;
type QuizPlayerNavigationProp = NativeStackNavigationProp<RootStackParamList, "QuizPlayer">;

interface QuizQuestion {
  id: string;
  question: string;
  options: { label: string; text: string }[];
  difficulty: "easy" | "medium" | "hard";
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
  const { mode, topicId } = route.params;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const { data: quizData, isLoading } = useQuery<QuizData>({
    queryKey: ["/api/quiz/start", mode, topicId],
  });

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
      navigation.replace("QuizResults", { resultId: result.id });
    },
  });

  const currentQuestion = quizData?.questions[currentIndex];
  const totalQuestions = quizData?.questions.length || 0;
  const progress = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  useEffect(() => {
    if (quizData?.timeLimit) {
      setTimeRemaining(quizData.timeLimit * 60);
    }
  }, [quizData?.timeLimit]);

  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        Alert.alert(
          "Quit Quiz?",
          "Your progress will be lost if you leave now.",
          [
            { text: "Continue Quiz", style: "cancel" },
            { text: "Quit", style: "destructive", onPress: () => navigation.goBack() },
          ]
        );
        return true;
      };

      BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => BackHandler.removeEventListener("hardwareBackPress", onBackPress);
    }, [navigation])
  );

  const handleSelectOption = (label: string) => {
    if (!currentQuestion) return;
    setSelectedOption(label);
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: label }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(answers[quizData!.questions[currentIndex + 1]?.id] || null);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setSelectedOption(answers[quizData!.questions[currentIndex - 1]?.id] || null);
    }
  };

  const handleSubmit = () => {
    if (!quizData) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    submitMutation.mutate({ 
      quizId: quizData.quizId, 
      answers,
      mode,
      topicId,
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <BackgroundGradient>
        <View style={[styles.container, { paddingTop: insets.top + Spacing["3xl"] }]}>
          <LoadingSkeleton width="60%" height={20} style={{ marginBottom: 24 }} />
          <LoadingSkeleton width="100%" height={100} style={{ marginBottom: 24 }} />
          <LoadingSkeleton width="100%" height={60} style={{ marginBottom: 12 }} />
          <LoadingSkeleton width="100%" height={60} style={{ marginBottom: 12 }} />
          <LoadingSkeleton width="100%" height={60} style={{ marginBottom: 12 }} />
          <LoadingSkeleton width="100%" height={60} />
        </View>
      </BackgroundGradient>
    );
  }

  const isLastQuestion = currentIndex === totalQuestions - 1;

  return (
    <BackgroundGradient variant="quiz">
      <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              Alert.alert(
                "Quit Quiz?",
                "Your progress will be lost.",
                [
                  { text: "Continue", style: "cancel" },
                  { text: "Quit", style: "destructive", onPress: () => navigation.goBack() },
                ]
              );
            }}
            style={styles.closeButton}
          >
            <Feather name="x" size={24} color={Colors.dark.text} />
          </Pressable>

          <View style={styles.progressInfo}>
            <ThemedText style={styles.questionNumber}>
              {currentIndex + 1} / {totalQuestions}
            </ThemedText>
            {timeRemaining !== null ? (
              <View style={[
                styles.timer,
                timeRemaining < 60 && styles.timerWarning,
              ]}>
                <Feather
                  name="clock"
                  size={14}
                  color={timeRemaining < 60 ? Colors.dark.error : Colors.dark.text}
                />
                <ThemedText
                  style={[
                    styles.timerText,
                    timeRemaining < 60 && { color: Colors.dark.error },
                  ]}
                >
                  {formatTime(timeRemaining)}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>

        <ProgressBar progress={progress} height={4} style={styles.progressBar} />

        <View style={styles.questionContainer}>
          <View style={styles.difficultyBadge}>
            <ThemedText style={styles.difficultyText}>
              {currentQuestion?.difficulty.toUpperCase()}
            </ThemedText>
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

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={styles.navButtons}>
            <Pressable
              onPress={handlePrevious}
              disabled={currentIndex === 0}
              style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
            >
              <Feather name="chevron-left" size={24} color={Colors.dark.text} />
            </Pressable>

            {isLastQuestion ? (
              <PrimaryButton
                title="Submit Quiz"
                onPress={handleSubmit}
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
    marginBottom: Spacing.lg,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.dark.glass,
    alignItems: "center",
    justifyContent: "center",
  },
  progressInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  questionNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  timer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.dark.glass,
    borderRadius: BorderRadius.full,
  },
  timerWarning: {
    backgroundColor: "rgba(239,68,68,0.2)",
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
  difficultyBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.dark.glass,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    color: Colors.dark.textSecondary,
  },
  questionText: {
    lineHeight: 32,
  },
  optionsContainer: {
    flex: 1,
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
    backgroundColor: Colors.dark.glass,
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
});
