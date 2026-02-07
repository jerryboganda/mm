import { Router } from "express";
import { storage } from "../storage";
import { AuthRequest, authMiddleware } from "../middleware";

const router = Router();

router.get("/stats", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const stats = await storage.getQuizStats(req.userId!);
    res.json(stats);
  } catch (error) {
    console.error("Get quiz stats error:", error);
    res.status(500).json({ message: "Failed to get quiz stats" });
  }
});

router.get("/topics", authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Single JOIN query replaces triple-nested N+1 loop
    const quizTopics = await storage.getQuizTopicsWithCounts();
    res.json(quizTopics);
  } catch (error) {
    console.error("Get quiz topics error:", error);
    res.status(500).json({ message: "Failed to get quiz topics" });
  }
});

router.get("/start/:mode", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { mode } = req.params;
    const topicId = req.query.topicId as string | undefined;
    const questionCount = Math.min(
      Math.max(parseInt(req.query.count as string) || 10, 1),
      50, // cap at 50
    );
    let questions: any[] = [];

    if (mode === "topic" && topicId) {
      questions = await storage.getMCQsByTopic(topicId);
    } else if (mode === "wrong") {
      questions = await storage.getWrongQuestions(req.userId!);
    } else {
      questions = await storage.getMCQs(questionCount);
    }

    const shuffledQuestions = questions
      .sort(() => Math.random() - 0.5)
      .slice(0, questionCount)
      .map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options as { label: string; text: string }[],
        difficulty: q.difficulty,
      }));

    res.json({
      quizId: `quiz-${Date.now()}`,
      questions: shuffledQuestions,
      questionCount,
      timeLimit: questionCount, // 1 minute per question
    });
  } catch (error) {
    console.error("Start quiz error:", error);
    res.status(500).json({ message: "Failed to start quiz" });
  }
});

router.post("/submit", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { quizId, answers, mode, topicId } = req.body;

    if (!answers || typeof answers !== "object" || Object.keys(answers).length === 0) {
      return res.status(400).json({ message: "Answers object is required" });
    }
    if (!mode || typeof mode !== "string") {
      return res.status(400).json({ message: "Quiz mode is required" });
    }

    const answerEntries = Object.entries(answers as Record<string, string>);

    // Batch-fetch all MCQs in one query instead of N individual fetches
    const mcqIds = answerEntries.map(([mcqId]) => mcqId);
    const allMcqs = await storage.getMCQsByIds(mcqIds);
    const mcqMap = new Map(allMcqs.map((m) => [m.id, m]));

    let correctCount = 0;
    const detailedAnswers: Record<string, any> = {};

    for (const [mcqId, selectedAnswer] of answerEntries) {
      const mcq = mcqMap.get(mcqId);
      if (mcq) {
        const isCorrect = selectedAnswer === mcq.correctAnswer;
        if (isCorrect) correctCount++;
        detailedAnswers[mcqId] = {
          selected: selectedAnswer,
          correct: mcq.correctAnswer,
          isCorrect,
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

    res.json({ id: attempt.id });
  } catch (error) {
    console.error("Submit quiz error:", error);
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

      const questions = mcqIds.map((mcqId) => {
        const mcq = mcqMap.get(mcqId);
        const answer = answers[mcqId];
        return {
          id: mcqId,
          question: mcq?.question || "Question not found",
          selectedAnswer: answer.selected,
          correctAnswer: answer.correct,
          isCorrect: answer.isCorrect,
          explanation: answer.explanation || mcq?.explanation || "",
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
      console.error("Get quiz results error:", error);
      res.status(500).json({ message: "Failed to get quiz results" });
    }
  },
);

export default router;
