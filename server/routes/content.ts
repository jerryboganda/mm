import { Router } from "express";
import { storage } from "../storage";
import { AuthRequest, authMiddleware } from "../middleware";
import { logger } from "../lib/logger";
import { effectiveSubscriptionStatus } from "../lib/subscription-status";

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
      userProgressData
        .filter((p) => p.isCompleted && !p.subtopicId)
        .map((p) => p.topicId),
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

    // Total topics per book from all topics (handles direct book topics and chapter topics)
    const totalTopicsByBook = new Map<string, number>();
    for (const { bookId } of allTopicsByBook) {
      totalTopicsByBook.set(bookId, (totalTopicsByBook.get(bookId) || 0) + 1);
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
      const totalTopics = totalTopicsByBook.get(book.id) || stats.topicCount || 0;
      const completedTopics = completedByBook.get(book.id) || 0;

      return {
        id: book.id,
        title: book.title,
        description: book.description,
        imageUrl: book.imageUrl,
        chaptersCount: stats.count,
        topicsCount: totalTopics,
        progress:
          totalTopics > 0
            ? Math.round((completedTopics / totalTopics) * 100)
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
        if (!topic.chapterId) continue;
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
  "/books/:bookId/topics",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { bookId } = req.params as { bookId: string };
      const [topicsData, userProgressData, userBookmarks] = await Promise.all([
        storage.getTopicsByBook(bookId),
        storage.getUserProgress(req.userId!),
        storage.getBookmarks(req.userId!),
      ]);

      const topicsWithStatus = await Promise.all(
        topicsData.map(async (topic) => {
          const agg = await storage.getTopicAggregatedProgress(
            req.userId!,
            topic.id,
          );
          const isDirectlyCompleted = userProgressData.some(
            (p) => p.topicId === topic.id && p.isCompleted && !p.subtopicId,
          );
          const isBookmarked = userBookmarks.some(
            (b) => b.topicId === topic.id,
          );

          return {
            id: topic.id,
            bookId: topic.bookId || bookId,
            chapterId: topic.chapterId,
            title: topic.title,
            description: topic.description,
            order: topic.order,
            isPaid: topic.isPaid,
            isPublished: topic.isPublished,
            subtopicsCount: agg.totalSubtopics,
            completedSubtopicsCount: agg.completedSubtopics,
            progress: agg.progress,
            isCompleted:
              agg.totalSubtopics > 0
                ? agg.isCompleted
                : isDirectlyCompleted,
            isBookmarked,
          };
        }),
      );

      res.json(topicsWithStatus);
    } catch (error) {
      logger.error("Get book topics error", { error: String(error) });
      res.status(500).json({ message: "Failed to get topics for book" });
    }
  },
);

router.get(
  "/topics/:topicId/subtopics",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { topicId } = req.params as { topicId: string };
      const topic = await storage.getTopic(topicId);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }

      const [subtopicsList, aggProgress] = await Promise.all([
        storage.getSubtopicsByTopic(topicId, req.userId!),
        storage.getTopicAggregatedProgress(req.userId!, topicId),
      ]);

      res.json({
        topic: {
          id: topic.id,
          title: topic.title,
          description: topic.description,
          bookId: topic.bookId,
          chapterId: topic.chapterId,
          isPaid: topic.isPaid,
          progress: aggProgress.progress,
          completedCount: aggProgress.completedSubtopics,
          totalCount: aggProgress.totalSubtopics,
          isCompleted: aggProgress.isCompleted,
        },
        subtopics: subtopicsList.map((s) => ({
          id: s.id,
          topicId: s.topicId,
          title: s.title,
          description: s.description,
          order: s.order,
          isPublished: s.isPublished,
          isPaid: s.isPaid || topic.isPaid,
          estimatedMinutes: s.estimatedMinutes ?? 3,
          isCompleted: s.isCompleted,
          isBookmarked: s.isBookmarked,
        })),
      });
    } catch (error) {
      logger.error("Get subtopics error", { error: String(error) });
      res.status(500).json({ message: "Failed to get subtopics" });
    }
  },
);

router.get(
  "/subtopics/:subtopicId",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { subtopicId } = req.params as { subtopicId: string };
      const subtopic = await storage.getSubtopic(subtopicId);
      if (!subtopic) {
        return res.status(404).json({ message: "Subtopic not found" });
      }

      const topic = await storage.getTopic(subtopic.topicId);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }

      const user = await storage.getUser(req.userId!);
      const subscriptionStatus = effectiveSubscriptionStatus(
        user?.subscriptionStatus,
        user?.subscriptionExpiresAt,
      );

      const isSubtopicPaid = subtopic.isPaid || topic.isPaid;
      if (isSubtopicPaid && subscriptionStatus !== "active") {
        return res.status(403).json({
          code: "SUBSCRIPTION_REQUIRED",
          message: "This material requires an active Premium subscription.",
          subtopicId: subtopic.id,
          subtopicTitle: subtopic.title,
          topicId: topic.id,
          topicTitle: topic.title,
        });
      }

      // Record topic view
      await storage.recordTopicView(req.userId!, topic.id);

      const [blocks, progress, isBookmarked, allSubtopics] = await Promise.all([
        storage.getContentBlocksBySubtopic(subtopicId),
        storage.getSubtopicProgress(req.userId!, subtopicId),
        storage.isSubtopicBookmarked(req.userId!, subtopicId),
        storage.getSubtopicsByTopic(topic.id, req.userId!),
      ]);

      const currentIndex = allSubtopics.findIndex((s) => s.id === subtopicId);
      const previousSubtopicId =
        currentIndex > 0 ? allSubtopics[currentIndex - 1].id : undefined;
      const nextSubtopicId =
        currentIndex < allSubtopics.length - 1
          ? allSubtopics[currentIndex + 1].id
          : undefined;

      res.json({
        id: subtopic.id,
        topicId: subtopic.topicId,
        topicTitle: topic.title,
        bookId: topic.bookId,
        title: subtopic.title,
        description: subtopic.description,
        order: subtopic.order,
        estimatedMinutes: subtopic.estimatedMinutes ?? 3,
        author: topic.author || null,
        source: topic.source || null,
        references: topic.references || null,
        updatedAt: subtopic.updatedAt?.toISOString() || null,
        isCompleted: progress?.isCompleted || false,
        isBookmarked,
        isPaid: isSubtopicPaid,
        blocks: blocks.map((b) => ({
          id: b.id,
          type: b.type,
          content: b.content,
          order: b.order,
        })),
        previousSubtopicId,
        nextSubtopicId,
        allSubtopics: allSubtopics.map((s) => ({
          id: s.id,
          title: s.title,
          order: s.order,
          isCompleted: s.isCompleted,
        })),
      });
    } catch (error) {
      logger.error("Get subtopic error", { error: String(error) });
      res.status(500).json({ message: "Failed to get subtopic" });
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
        isPaid: topic.isPaid,
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

      const user = await storage.getUser(req.userId!);
      const subscriptionStatus = effectiveSubscriptionStatus(
        user?.subscriptionStatus,
        user?.subscriptionExpiresAt,
      );

      if (topic.isPaid && subscriptionStatus !== "active") {
        return res.status(403).json({
          code: "SUBSCRIPTION_REQUIRED",
          message: "This material requires an active Premium subscription.",
          topicId: topic.id,
          topicTitle: topic.title,
        });
      }

      // Record this topic view for recent activity tracking
      await storage.recordTopicView(req.userId!, topicId);

      const [blocks, progress, isBookmarked, subtopicsList] = await Promise.all([
        storage.getContentBlocksByTopic(topicId),
        storage.getTopicProgress(req.userId!, topicId),
        storage.isBookmarked(req.userId!, topicId),
        storage.getSubtopicsByTopic(topicId, req.userId!),
      ]);

      const allTopics = topic.bookId
        ? await storage.getTopicsByBook(topic.bookId)
        : topic.chapterId
          ? await storage.getTopicsByChapter(topic.chapterId)
          : [];
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
        isPaid: topic.isPaid,
        blocks: blocks.map((b) => ({
          id: b.id,
          type: b.type,
          content: b.content,
          order: b.order,
        })),
        previousTopicId,
        nextTopicId,
        allSubtopics: subtopicsList.map((s) => ({
          id: s.id,
          title: s.title,
          order: s.order,
          isCompleted: s.isCompleted,
        })),
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

router.post(
  "/subtopics/:subtopicId/complete",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { subtopicId } = req.params as { subtopicId: string };
      await storage.markSubtopicComplete(req.userId!, subtopicId);
      res.json({ success: true });
    } catch (error) {
      logger.error("Mark subtopic complete error", { error: String(error) });
      res.status(500).json({ message: "Failed to mark subtopic complete" });
    }
  },
);

router.post(
  "/subtopics/:subtopicId/uncomplete",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { subtopicId } = req.params as { subtopicId: string };
      await storage.markSubtopicUncomplete(req.userId!, subtopicId);
      res.json({ success: true });
    } catch (error) {
      logger.error("Mark subtopic uncomplete error", { error: String(error) });
      res.status(500).json({ message: "Failed to mark subtopic uncomplete" });
    }
  },
);

router.post(
  "/subtopics/:subtopicId/bookmark",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { subtopicId } = req.params as { subtopicId: string };
      const isBookmarked = await storage.toggleSubtopicBookmark(
        req.userId!,
        subtopicId,
      );
      res.json({ isBookmarked });
    } catch (error) {
      logger.error("Toggle subtopic bookmark error", { error: String(error) });
      res.status(500).json({ message: "Failed to toggle subtopic bookmark" });
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
router.get("/announcements", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const announcements = await storage.getAnnouncements(req.userId);
    res.json(announcements);
  } catch (error) {
    logger.error("Get announcements error", { error: String(error) });
    res.status(500).json({ message: "Failed to get announcements" });
  }
});

export default router;
