import { Router } from "express";
import { storage } from "../storage";
import { AuthRequest, authMiddleware } from "../middleware";
import { normalizeOptions, resolveAnswerLabel } from "../lib/mcq-options";

const router = Router();

// Attempt History with filters
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { mode, topicId, startDate, endDate } = req.query;
    const attempts = await storage.getQuizAttempts(req.userId!);

    let filteredAttempts = attempts;

    if (mode && mode !== "all") {
      filteredAttempts = filteredAttempts.filter((a) => a.mode === mode);
    }

    if (topicId) {
      filteredAttempts = filteredAttempts.filter((a) => a.topicId === topicId);
    }

    if (startDate) {
      const start = new Date(startDate as string);
      filteredAttempts = filteredAttempts.filter(
        (a) => new Date(a.createdAt) >= start,
      );
    }

    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      filteredAttempts = filteredAttempts.filter(
        (a) => new Date(a.createdAt) <= end,
      );
    }

    // Batch-fetch all unique topic titles instead of N+1 queries
    const uniqueTopicIds = [
      ...new Set(filteredAttempts.map((a) => a.topicId).filter(Boolean)),
    ] as string[];
    const topicTitleMap = new Map<string, string>();
    for (const tid of uniqueTopicIds) {
      const topic = await storage.getTopic(tid);
      if (topic) topicTitleMap.set(tid, topic.title);
    }

    const attemptsWithDetails = filteredAttempts.map((a) => ({
      id: a.id,
      date: a.createdAt.toISOString(),
      score: a.score,
      totalQuestions: a.totalQuestions,
      correctCount: a.correctCount,
      wrongCount: a.wrongCount,
      timeTaken: a.timeTaken,
      mode: a.mode,
      topicId: a.topicId,
      topicTitle: a.topicId ? topicTitleMap.get(a.topicId) : undefined,
    }));

    res.json(attemptsWithDetails);
  } catch (error) {
    console.error("Get attempts error:", error);
    res.status(500).json({ message: "Failed to get attempts" });
  }
});

// Single Attempt Detail
router.get("/:attemptId", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { attemptId } = req.params as { attemptId: string };
    const attempt = await storage.getQuizAttempt(attemptId);

    if (!attempt || attempt.userId !== req.userId) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    let topicTitle = undefined;
    if (attempt.topicId) {
      const topic = await storage.getTopic(attempt.topicId);
      topicTitle = topic?.title;
    }

    const answersData = attempt.answers as Record<
      string,
      {
        selected?: string;
        correct?: string;
        selectedText?: string;
        correctText?: string;
        isCorrect?: boolean;
      }
    >;
    const questionIds = Object.keys(answersData);

    // Batch-fetch all MCQs in one query
    const allMcqs = await storage.getMCQsByIds(questionIds);
    const mcqMap = new Map(allMcqs.map((m) => [m.id, m]));

    const questionsWithDetails = questionIds.map((qId) => {
      const mcq = mcqMap.get(qId);
      const answerInfo = answersData[qId] || {};
      const options = normalizeOptions(mcq?.options);
      const selectedAnswer = resolveAnswerLabel(
        String(answerInfo.selected || answerInfo.selectedText || ""),
        mcq?.options,
      );
      const correctAnswer = resolveAnswerLabel(
        String(answerInfo.correct || answerInfo.correctText || ""),
        mcq?.options,
      );

      return {
        id: qId,
        question: mcq?.question || "Question not found",
        options,
        selectedAnswer,
        correctAnswer,
        isCorrect: Boolean(answerInfo.isCorrect),
        explanation: mcq?.explanation || "",
      };
    });

    res.json({
      id: attempt.id,
      date: attempt.createdAt.toISOString(),
      score: attempt.score,
      totalQuestions: attempt.totalQuestions,
      correctCount: attempt.correctCount,
      wrongCount: attempt.wrongCount,
      timeTaken: attempt.timeTaken,
      mode: attempt.mode,
      topicId: attempt.topicId,
      topicTitle,
      questions: questionsWithDetails,
    });
  } catch (error) {
    console.error("Get attempt detail error:", error);
    res.status(500).json({ message: "Failed to get attempt detail" });
  }
});

export default router;
