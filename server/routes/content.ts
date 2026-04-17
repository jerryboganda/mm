import { Router } from "express";
import { storage } from "../storage";
import { AuthRequest, authMiddleware } from "../middleware";
import { logger } from "../lib/logger";

const router = Router();

router.get("/books", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const [booksData, allChapters, userProgressData, allTopicsByBook] =
      await Promise.all([
        storage.getBooks(),
        storage.getAllChaptersGroupedByBook(),
        storage.getUserProgress(req.userId!),
        storage.getAllTopicIdsGroupedByBook(),
      ]);

    const completedTopicIds = new Set(
      userProgressData.filter((p) => p.isCompleted).map((p) => p.topicId),
    );

    // Group chapter data by book
    const chaptersByBook = new Map<
      string,
      { count: number; topicCount: number }
    >();
    for (const ch of allChapters) {
      const existing = chaptersByBook.get(ch.bookId) || {
        count: 0,
        topicCount: 0,
      };
      existing.count++;
      existing.topicCount += ch.topicCount;
      chaptersByBook.set(ch.bookId, existing);
    }

    // Count completed topics per book from the batch query (no N+1)
    const completedByBook = new Map<string, number>();
    for (const { bookId, topicId } of allTopicsByBook) {
      if (completedTopicIds.has(topicId)) {
        completedByBook.set(bookId, (completedByBook.get(bookId) || 0) + 1);
      }
    }

    const booksWithProgress = booksData.map((book) => {
      const stats = chaptersByBook.get(book.id) || {
        count: 0,
        topicCount: 0,
      };
      const completedTopics = completedByBook.get(book.id) || 0;

      return {
        id: book.id,
        title: book.title,
        description: book.description,
        imageUrl: book.imageUrl,
        chaptersCount: stats.count,
        progress:
          stats.topicCount > 0
            ? Math.round((completedTopics / stats.topicCount) * 100)
            : 0,
      };
    });

    res.json(booksWithProgress);
  } catch (error) {
    logger.error("Get books error", { error: String(error) });
    res.status(500).json({ message: "Failed to get books" });
  }
});

router.get(
  "/books/:bookId/chapters",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { bookId } = req.params as { bookId: string };
      const [chaptersData, userProgressData, allBookTopics] = await Promise.all(
        [
          storage.getChaptersByBook(bookId),
          storage.getUserProgress(req.userId!),
          storage.getTopicsByBook(bookId),
        ],
      );

      // Group topics by chapter in JS instead of N+1 queries
      const topicsByChapter = new Map<string, typeof allBookTopics>();
      for (const topic of allBookTopics) {
        const list = topicsByChapter.get(topic.chapterId) || [];
        list.push(topic);
        topicsByChapter.set(topic.chapterId, list);
      }

      const chaptersWithProgress = chaptersData.map((chapter) => {
        const topicsData = topicsByChapter.get(chapter.id) || [];
        const completedTopics = topicsData.filter((t) =>
          userProgressData.some((p) => p.topicId === t.id && p.isCompleted),
        ).length;

        return {
          id: chapter.id,
          title: chapter.title,
          description: chapter.description,
          topicsCount: topicsData.length,
          progress:
            topicsData.length > 0
              ? Math.round((completedTopics / topicsData.length) * 100)
              : 0,
          order: chapter.order,
        };
      });

      res.json(chaptersWithProgress);
    } catch (error) {
      logger.error("Get chapters error", { error: String(error) });
      res.status(500).json({ message: "Failed to get chapters" });
    }
  },
);

router.get(
  "/chapters/:chapterId/topics",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { chapterId } = req.params as { chapterId: string };
      const topicsData = await storage.getTopicsByChapter(chapterId);
      const userProgressData = await storage.getUserProgress(req.userId!);
      const userBookmarks = await storage.getBookmarks(req.userId!);

      const topicsWithStatus = topicsData.map((topic) => ({
        id: topic.id,
        title: topic.title,
        description: topic.description,
        order: topic.order,
        isCompleted: userProgressData.some(
          (p) => p.topicId === topic.id && p.isCompleted,
        ),
        isBookmarked: userBookmarks.some((b) => b.topicId === topic.id),
      }));

      res.json(topicsWithStatus);
    } catch (error) {
      logger.error("Get topics error", { error: String(error) });
      res.status(500).json({ message: "Failed to get topics" });
    }
  },
);

router.get(
  "/topics/:topicId",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { topicId } = req.params as { topicId: string };
      const topic = await storage.getTopic(topicId);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }

      // Record this topic view for recent activity tracking
      await storage.recordTopicView(req.userId!, topicId);

      const blocks = await storage.getContentBlocksByTopic(topicId);
      const progress = await storage.getTopicProgress(req.userId!, topicId);
      const isBookmarked = await storage.isBookmarked(req.userId!, topicId);

      const allTopics = await storage.getTopicsByChapter(topic.chapterId);
      const currentIndex = allTopics.findIndex((t) => t.id === topicId);
      const previousTopicId =
        currentIndex > 0 ? allTopics[currentIndex - 1].id : undefined;
      const nextTopicId =
        currentIndex < allTopics.length - 1
          ? allTopics[currentIndex + 1].id
          : undefined;

      res.json({
        id: topic.id,
        title: topic.title,
        author: topic.author || null,
        source: topic.source || null,
        references: topic.references || null,
        updatedAt: topic.updatedAt?.toISOString() || null,
        isCompleted: progress?.isCompleted || false,
        isBookmarked,
        blocks: blocks.map((b) => ({
          id: b.id,
          type: b.type,
          content: b.content,
          order: b.order,
        })),
        previousTopicId,
        nextTopicId,
      });
    } catch (error) {
      logger.error("Get topic error", { error: String(error) });
      res.status(500).json({ message: "Failed to get topic" });
    }
  },
);

router.post(
  "/topics/:topicId/complete",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { topicId } = req.params as { topicId: string };
      await storage.markTopicComplete(req.userId!, topicId);
      res.json({ success: true });
    } catch (error) {
      logger.error("Mark complete error", { error: String(error) });
      res.status(500).json({ message: "Failed to mark topic complete" });
    }
  },
);

router.post(
  "/topics/:topicId/uncomplete",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { topicId } = req.params as { topicId: string };
      await storage.markTopicUncomplete(req.userId!, topicId);
      res.json({ success: true });
    } catch (error) {
      logger.error("Mark uncomplete error", { error: String(error) });
      res.status(500).json({ message: "Failed to mark topic uncomplete" });
    }
  },
);

router.post(
  "/topics/:topicId/bookmark",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { topicId } = req.params as { topicId: string };
      const isBookmarked = await storage.toggleBookmark(req.userId!, topicId);
      res.json({ isBookmarked });
    } catch (error) {
      logger.error("Toggle bookmark error", { error: String(error) });
      res.status(500).json({ message: "Failed to toggle bookmark" });
    }
  },
);

router.get("/search", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const query = ((req.query.query as string) || "").trim();
    const filter = (req.query.filter as string) || "all";

    if (query.length < 2) {
      return res.json([]);
    }

    // Use SQL ILIKE search instead of fetching all content and filtering in JS
    const results = await storage.searchContent(query, filter, 50);
    res.json(results);
  } catch (error) {
    logger.error("Search error", { error: String(error) });
    res.status(500).json({ message: "Search failed" });
  }
});

// Recommended topics: topics the user hasn't completed yet, from books they've been active in
router.get(
  "/recommended-topics",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 5, 20);
      const topics = await storage.getRecommendedTopics(req.userId!, limit);
      res.json(topics);
    } catch (error) {
      logger.error("Get recommended topics error", { error: String(error) });
      res.status(500).json({ message: "Failed to get recommended topics" });
    }
  },
);

// Announcements for the notification feed
router.get("/announcements", authMiddleware, async (_req: AuthRequest, res) => {
  try {
    const announcements = await storage.getAnnouncements();
    res.json(announcements);
  } catch (error) {
    logger.error("Get announcements error", { error: String(error) });
    res.status(500).json({ message: "Failed to get announcements" });
  }
});

export default router;
