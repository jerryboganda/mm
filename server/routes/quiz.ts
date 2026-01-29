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
    const booksData = await storage.getBooks();
    const quizTopics: {
      id: string;
      title: string;
      chapterTitle: string;
      questionCount: number;
    }[] = [];

    for (const book of booksData) {
      const chaptersData = await storage.getChaptersByBook(book.id);
      for (const chapter of chaptersData) {
        const topicsData = await storage.getTopicsByChapter(chapter.id);
        for (const topic of topicsData) {
          const mcqsData = await storage.getMCQsByTopic(topic.id);
          if (mcqsData.length > 0) {
            quizTopics.push({
              id: topic.id,
              title: topic.title,
              chapterTitle: chapter.title,
              questionCount: mcqsData.length,
            });
          }
        }
      }
    }

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
    let questions: any[] = [];

    if (mode === "topic" && topicId) {
      questions = await storage.getMCQsByTopic(topicId);
    } else if (mode === "wrong") {
      questions = await storage.getWrongQuestions(req.userId!);
    } else {
      questions = await storage.getMCQs(10);
    }

    const shuffledQuestions = questions
      .sort(() => Math.random() - 0.5)
      .slice(0, 10)
      .map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options as { label: string; text: string }[],
        difficulty: q.difficulty,
      }));

    res.json({
      quizId: `quiz-${Date.now()}`,
      questions: shuffledQuestions,
      timeLimit: 10,
    });
  } catch (error) {
    console.error("Start quiz error:", error);
    res.status(500).json({ message: "Failed to start quiz" });
  }
});

router.post("/submit", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { quizId, answers, mode, topicId } = req.body;
    const answerEntries = Object.entries(answers as Record<string, string>);

    let correctCount = 0;
    const detailedAnswers: Record<string, any> = {};

    for (const [mcqId, selectedAnswer] of answerEntries) {
      const mcq = await storage.getMCQ(mcqId);
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
      const questions = await Promise.all(
        Object.entries(answers).map(async ([mcqId, answer]) => {
          const mcq = await storage.getMCQ(mcqId);
          return {
            id: mcqId,
            question: mcq?.question || "Question not found",
            selectedAnswer: answer.selected,
            correctAnswer: answer.correct,
            isCorrect: answer.isCorrect,
            explanation: answer.explanation || mcq?.explanation || "",
          };
        }),
      );

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
