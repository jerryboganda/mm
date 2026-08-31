import { Router } from "express";
import { storage } from "../storage";
import type { MCQ } from "../../shared/schema";
import { AuthRequest, authMiddleware } from "../middleware";
import {
  getOptionTextByLabel,
  normalizeOptions,
  resolveAnswerLabel,
  resolveCorrectLabel,
} from "../lib/mcq-options";
import { logger } from "../lib/logger";
import { effectiveSubscriptionStatus } from "../lib/subscription-status";

const router = Router();

router.get("/stats", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const stats = await storage.getQuizStats(req.userId!);
    res.json(stats);
  } catch (error) {
    logger.error("Get quiz stats error", { error: String(error) });
    res.status(500).json({ message: "Failed to get quiz stats" });
  }
});

router.get("/topics", authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Single JOIN query replaces triple-nested N+1 loop
    const quizTopics = await storage.getQuizTopicsWithCounts();
    res.json(quizTopics);
  } catch (error) {
    logger.error("Get quiz topics error", { error: String(error) });
    res.status(500).json({ message: "Failed to get quiz topics" });
  }
});

router.get(
  "/filter-options",
  authMiddleware,
  async (_req: AuthRequest, res) => {
    try {
      const options = await storage.getQuizFilterOptions();
      res.json(options);
    } catch (error) {
      logger.error("Get quiz filter options error", { error: String(error) });
      res.status(500).json({ message: "Failed to get filter options" });
    }
  },
);

router.get("/start/:mode", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { mode } = req.params;
    const topicId = req.query.topicId as string | undefined;
    const year = parseInt(req.query.year as string, 10);
    const sourceId = req.query.sourceId as string | undefined;
    const metaOpts = {
      year: Number.isFinite(year) ? year : undefined,
      sourceId: sourceId || undefined,
    };
    const questionCount = Math.min(
      Math.max(parseInt(req.query.count as string) || 10, 1),
      50, // cap at 50
    );

    const user = await storage.getUser(req.userId!);
    const subscriptionStatus = effectiveSubscriptionStatus(
      user?.subscriptionStatus,
      user?.subscriptionExpiresAt,
    );
    const hasActiveSubscription = subscriptionStatus === "active";

    if (mode === "topic" && topicId) {
      const topic = await storage.getTopic(topicId);
      if (topic?.isPaid && !hasActiveSubscription) {
        return res.status(403).json({
          code: "SUBSCRIPTION_REQUIRED",
          message: "This material requires an active Premium subscription.",
          topicId: topic.id,
          topicTitle: topic.title,
        });
      }
    }

    let questions: MCQ[] = [];

    if (mode === "topic" && topicId) {
      questions = await storage.getMCQsByTopic(topicId, metaOpts);
    } else if (mode === "wrong") {
      questions = await storage.getWrongQuestions(req.userId!);
    } else {
      questions = await storage.getMCQs(questionCount, undefined, metaOpts);
    }

    if (!hasActiveSubscription) {
      questions = questions.filter((q) => !q.isPaid);
      if (questions.length === 0) {
        return res.status(403).json({
          code: "SUBSCRIPTION_REQUIRED",
          message: "This material requires an active Premium subscription.",
        });
      }
    }

    const isTopicMode = mode === "topic";
    const selectedQuestions = isTopicMode
      ? questions
      : [...questions].sort(() => Math.random() - 0.5).slice(0, questionCount);

    const metaMap = await storage.getMCQMetadataByIds(
      selectedQuestions.map((q) => q.id),
    );

    const formattedQuestions = selectedQuestions.map((q) => {
      const meta = metaMap.get(q.id);
      return {
        id: q.id,
        question: q.question,
        options: normalizeOptions(q.options),
        difficulty: q.difficulty,
        isPaid: q.isPaid ?? false,
        year: meta?.year ?? null,
        sourceName: meta?.sourceName ?? null,
        subjectName: meta?.subjectName ?? null,
      };
    });

    res.json({
      quizId: `quiz-${Date.now()}`,
      questions: formattedQuestions,
      questionCount: formattedQuestions.length,
      timeLimit: Math.max(formattedQuestions.length, 1), // 1 minute per question
    });
  } catch (error) {
    logger.error("Start quiz error", { error: String(error) });
    res.status(500).json({ message: "Failed to start quiz" });
  }
});

router.post("/submit", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { quizId, answers, mode, topicId } = req.body;

    if (
      !answers ||
      typeof answers !== "object" ||
      Object.keys(answers).length === 0
    ) {
      return res.status(400).json({ message: "Answers object is required" });
    }
    if (!mode || typeof mode !== "string") {
      return res.status(400).json({ message: "Quiz mode is required" });
    }

    const user = await storage.getUser(req.userId!);
    const subscriptionStatus = effectiveSubscriptionStatus(
      user?.subscriptionStatus,
      user?.subscriptionExpiresAt,
    );
    const hasActiveSubscription = subscriptionStatus === "active";

    if (!hasActiveSubscription) {
      if (topicId) {
        const topic = await storage.getTopic(topicId);
        if (topic?.isPaid) {
          return res.status(403).json({
            code: "SUBSCRIPTION_REQUIRED",
            message: "This material requires an active Premium subscription.",
            topicId: topic.id,
            topicTitle: topic.title,
          });
        }
      }
    }

    const answerEntries = Object.entries(answers as Record<string, string>);

    // Batch-fetch all MCQs in one query instead of N individual fetches
    const mcqIds = answerEntries.map(([mcqId]) => mcqId);
    const allMcqs = await storage.getMCQsByIds(mcqIds);

    if (!hasActiveSubscription && allMcqs.some((m) => m.isPaid)) {
      return res.status(403).json({
        code: "SUBSCRIPTION_REQUIRED",
        message: "This material requires an active Premium subscription.",
      });
    }

    const mcqMap = new Map(allMcqs.map((m) => [m.id, m]));

    let correctCount = 0;
    const detailedAnswers: Record<string, any> = {};

    for (const [mcqId, selectedAnswer] of answerEntries) {
      const mcq = mcqMap.get(mcqId);
      if (mcq) {
        const selectedLabel = resolveAnswerLabel(selectedAnswer, mcq.options);
        const correctLabel = resolveCorrectLabel(
          mcq.correctAnswer,
          mcq.options,
        );
        const isNormalizedCorrect = selectedLabel === correctLabel;
        if (isNormalizedCorrect) correctCount++;

        // Store human-readable text for results display
        const selectedText =
          getOptionTextByLabel(selectedLabel, mcq.options) || selectedAnswer;
        const correctText = getOptionTextByLabel(correctLabel, mcq.options);

        detailedAnswers[mcqId] = {
          selected: selectedLabel,
          correct: correctLabel,
          selectedText,
          correctText,
          isCorrect: isNormalizedCorrect,
          explanation: mcq.explanation,
        };
      }
    }

    const totalQuestions = answerEntries.length;
    const wrongCount = totalQuestions - correctCount;
    const score =
      totalQuestions > 0
        ? Math.round((correctCount / totalQuestions) * 100)
        : 0;

    const attempt = await storage.createQuizAttempt({
      userId: req.userId!,
      topicId: topicId || null,
      mode: mode || "mixed",
      score,
      totalQuestions,
      correctCount,
      wrongCount,
      timeTaken: 0,
      answers: detailedAnswers,
    });

    const statsResults: Record<string, boolean> = {};
    for (const [mcqId, detail] of Object.entries(detailedAnswers)) {
      statsResults[mcqId] = Boolean(detail.isCorrect);
    }
    storage
      .recordMcqStats(statsResults)
      .catch((e) =>
        logger.error("MCQ stats update failed", { error: String(e) }),
      );

    res.json({ id: attempt.id });
  } catch (error) {
    logger.error("Submit quiz error", { error: String(error) });
    res.status(500).json({ message: "Failed to submit quiz" });
  }
});

router.get(
  "/results/:resultId",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { resultId } = req.params as { resultId: string };
      const attempt = await storage.getQuizAttempt(resultId);
      if (!attempt) {
        return res.status(404).json({ message: "Result not found" });
      }

      const answers = attempt.answers as Record<string, any>;
      const mcqIds = Object.keys(answers);
      const allMcqs = await storage.getMCQsByIds(mcqIds);
      const mcqMap = new Map(allMcqs.map((m) => [m.id, m]));
      const metaMap = await storage.getMCQMetadataByIds(mcqIds);

      const questions = mcqIds.map((mcqId) => {
        const mcq = mcqMap.get(mcqId);
        const answer = answers[mcqId];
        const meta = metaMap.get(mcqId);
        const selectedLabel = resolveAnswerLabel(
          String(answer?.selected || ""),
          mcq?.options,
        );
        const correctLabel = resolveAnswerLabel(
          String(answer?.correct || ""),
          mcq?.options,
        );
        return {
          id: mcqId,
          question: mcq?.question || "Question not found",
          selectedAnswer:
            answer?.selectedText ||
            getOptionTextByLabel(selectedLabel, mcq?.options) ||
            String(answer?.selected || ""),
          correctAnswer:
            answer?.correctText ||
            getOptionTextByLabel(correctLabel, mcq?.options) ||
            String(answer?.correct || ""),
          isCorrect: Boolean(answer?.isCorrect),
          explanation: answer.explanation || mcq?.explanation || "",
          images: (mcq?.images as unknown[] | null) ?? [],
          year: meta?.year ?? null,
          sourceName: meta?.sourceName ?? null,
          subjectName: meta?.subjectName ?? null,
        };
      });

      res.json({
        id: attempt.id,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        correctCount: attempt.correctCount,
        wrongCount: attempt.wrongCount,
        timeTaken: attempt.timeTaken || 0,
        questions,
      });
    } catch (error) {
      logger.error("Get quiz results error", { error: String(error) });
      res.status(500).json({ message: "Failed to get quiz results" });
    }
  },
);

export default router;
