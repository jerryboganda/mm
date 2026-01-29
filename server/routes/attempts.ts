import { Router } from "express";
import { storage } from "../storage";
import { AuthRequest, authMiddleware } from "../middleware";

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

    const attemptsWithDetails = await Promise.all(
      filteredAttempts.map(async (a) => {
        let topicTitle = undefined;
        if (a.topicId) {
          const topic = await storage.getTopic(a.topicId);
          topicTitle = topic?.title;
        }
        return {
          id: a.id,
          date: a.createdAt.toISOString(),
          score: a.score,
          totalQuestions: a.totalQuestions,
          correctCount: a.correctCount,
          wrongCount: a.wrongCount,
          timeTaken: a.timeTaken,
          mode: a.mode,
          topicId: a.topicId,
          topicTitle,
        };
      }),
    );

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
      { selected: string; correct: string; isCorrect: boolean }
    >;
    const questionIds = Object.keys(answersData);

    const questionsWithDetails = await Promise.all(
      questionIds.map(async (qId) => {
        const mcq = await storage.getMCQ(qId);
        const answerInfo = answersData[qId];
        return {
          id: qId,
          question: mcq?.question || "Question not found",
          options: mcq?.options || [],
          selectedAnswer: answerInfo.selected,
          correctAnswer: answerInfo.correct,
          isCorrect: answerInfo.isCorrect,
          explanation: mcq?.explanation || "",
        };
      }),
    );

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
