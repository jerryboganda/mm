import { Router } from "express";
import { storage } from "../storage";
import { AuthRequest, authMiddleware } from "../middleware";

/** Calculate study streak: consecutive days (from today backwards) that had quiz activity or topic views */
function calculateStudyStreak(
  attempts: { createdAt: Date }[],
  recentActivity: { viewedAt: Date }[],
): number {
  // Collect all unique activity dates (YYYY-MM-DD)
  const activeDays = new Set<string>();
  for (const a of attempts) {
    activeDays.add(new Date(a.createdAt).toISOString().slice(0, 10));
  }
  for (const r of recentActivity) {
    activeDays.add(new Date(r.viewedAt).toISOString().slice(0, 10));
  }

  if (activeDays.size === 0) return 0;

  let streak = 0;
  const now = new Date();
  // Start from today and go backwards
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (activeDays.has(key)) {
      streak++;
    } else {
      // Allow a grace period: if today has no activity yet, check if yesterday did
      if (i === 0) continue;
      break;
    }
  }
  return streak;
}

const router = Router();

router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Fetch all needed data in parallel
    const [stats, attempts, userProgressData, allChapters, recentActivity] =
      await Promise.all([
        storage.getQuizStats(req.userId!),
        storage.getQuizAttempts(req.userId!),
        storage.getUserProgress(req.userId!),
        storage.getAllChaptersGroupedByBook(),
        storage.getRecentActivity(req.userId!, 365),
      ]);

    // Total topics from chapter LEFT JOIN counts
    const totalTopics = allChapters.reduce(
      (sum, ch) => sum + Number(ch.topicCount),
      0,
    );
    const completedTopicIds = new Set(
      userProgressData.filter((p) => p.isCompleted).map((p) => p.topicId),
    );
    const topicsCompleted = completedTopicIds.size;

    // Build topic progress from attempts (group by topicId in JS — attempts already fetched)
    const topicProgressMap = new Map<
      string,
      { title: string; accuracy: number; attempts: number }
    >();

    const attemptsByTopic = new Map<string, typeof attempts>();
    for (const a of attempts) {
      if (!a.topicId) continue;
      const list = attemptsByTopic.get(a.topicId) || [];
      list.push(a);
      attemptsByTopic.set(a.topicId, list);
    }

    // We need topic titles for topics that have attempts — batch fetch
    const topicIdsWithAttempts = [...attemptsByTopic.keys()];
    if (topicIdsWithAttempts.length > 0) {
      for (const [topicId, topicAttempts] of attemptsByTopic) {
        const avgScore = Math.round(
          topicAttempts.reduce((sum, a) => sum + a.score, 0) /
            topicAttempts.length,
        );
        // Use topicId as fallback title; actual title added below
        topicProgressMap.set(topicId, {
          title: topicId,
          accuracy: avgScore,
          attempts: topicAttempts.length,
        });
      }

      // Enrich with topic titles
      for (const topicId of topicIdsWithAttempts) {
        const topic = await storage.getTopic(topicId);
        if (topic) {
          const entry = topicProgressMap.get(topicId)!;
          entry.title = topic.title;
        }
      }
    }

    const topicProgress = Array.from(topicProgressMap.entries()).map(
      ([id, data]) => ({ id, ...data }),
    );

    const recentAttempts = attempts.slice(0, 10).map((a) => ({
      id: a.id,
      date: a.createdAt.toISOString(),
      score: a.score,
      mode: a.mode,
      topicTitle: undefined,
    }));

    // Calculate study streak from quiz attempts + topic views
    const studyStreak = calculateStudyStreak(attempts, recentActivity as any);

    res.json({
      totalAttempts: stats.totalAttempts,
      averageAccuracy: stats.averageScore,
      averageScore: stats.averageScore,
      quizzesCompleted: stats.totalAttempts,
      studyStreak,
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
