import { Router } from "express";
import { storage } from "../storage";
import { AuthRequest, authMiddleware } from "../middleware";

const router = Router();

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const stats = await storage.getQuizStats(req.userId!);
    const attempts = await storage.getQuizAttempts(req.userId!);
    const userProgressData = await storage.getUserProgress(req.userId!);

    const booksData = await storage.getBooks();
    let totalTopics = 0;
    let topicsCompleted = 0;
    const topicProgressMap: Map<
      string,
      { title: string; accuracy: number; attempts: number }
    > = new Map();

    for (const book of booksData) {
      const chaptersData = await storage.getChaptersByBook(book.id);
      for (const chapter of chaptersData) {
        const topicsData = await storage.getTopicsByChapter(chapter.id);
        totalTopics += topicsData.length;

        for (const topic of topicsData) {
          if (
            userProgressData.some(
              (p) => p.topicId === topic.id && p.isCompleted,
            )
          ) {
            topicsCompleted++;
          }

          const topicAttempts = attempts.filter((a) => a.topicId === topic.id);
          if (topicAttempts.length > 0) {
            const avgScore = Math.round(
              topicAttempts.reduce((sum, a) => sum + a.score, 0) /
                topicAttempts.length,
            );
            topicProgressMap.set(topic.id, {
              title: topic.title,
              accuracy: avgScore,
              attempts: topicAttempts.length,
            });
          }
        }
      }
    }

    const topicProgress = Array.from(topicProgressMap.entries()).map(
      ([id, data]) => ({
        id,
        ...data,
      }),
    );

    const recentAttempts = attempts.slice(0, 10).map((a) => ({
      id: a.id,
      date: a.createdAt.toISOString(),
      score: a.score,
      mode: a.mode,
      topicTitle: undefined,
    }));

    res.json({
      totalAttempts: stats.totalAttempts,
      averageAccuracy: stats.averageScore,
      topicsCompleted,
      totalTopics,
      topicProgress,
      recentAttempts,
    });
  } catch (error) {
    console.error("Get progress error:", error);
    res.status(500).json({ message: "Failed to get progress" });
  }
});

router.get("/topic/:topicId", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { topicId } = req.params as { topicId: string };
    const topic = await storage.getTopic(topicId);

    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    const chapter = await storage.getChapter(topic.chapterId);
    const attempts = await storage.getQuizAttempts(req.userId!);
    const topicAttempts = attempts.filter((a) => a.topicId === topicId);

    const accuracyTrend = topicAttempts.map((a) => ({
      date: a.createdAt.toISOString(),
      score: a.score,
    }));

    const avgScore =
      topicAttempts.length > 0
        ? Math.round(
            topicAttempts.reduce((sum, a) => sum + a.score, 0) /
              topicAttempts.length,
          )
        : 0;

    const bestScore =
      topicAttempts.length > 0
        ? Math.max(...topicAttempts.map((a) => a.score))
        : 0;

    const lastAttempt =
      topicAttempts.length > 0
        ? topicAttempts[0].createdAt.toISOString()
        : null;

    const recentAttempts = topicAttempts.slice(0, 10).map((a) => ({
      id: a.id,
      date: a.createdAt.toISOString(),
      score: a.score,
      correctCount: a.correctCount,
      wrongCount: a.wrongCount,
      totalQuestions: a.totalQuestions,
    }));

    res.json({
      topicId,
      topicTitle: topic.title,
      chapterTitle: chapter?.title || "",
      totalAttempts: topicAttempts.length,
      averageScore: avgScore,
      bestScore,
      lastAttempt,
      accuracyTrend,
      recentAttempts,
    });
  } catch (error) {
    console.error("Get topic progress error:", error);
    res.status(500).json({ message: "Failed to get topic progress" });
  }
});

export default router;
