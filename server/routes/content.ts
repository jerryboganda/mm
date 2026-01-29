import { Router } from "express";
import { storage } from "../storage";
import { AuthRequest, authMiddleware } from "../middleware";

const router = Router();

router.get("/books", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const booksData = await storage.getBooks();
    const userProgressData = await storage.getUserProgress(req.userId!);

    const booksWithProgress = await Promise.all(
      booksData.map(async (book) => {
        const chaptersData = await storage.getChaptersByBook(book.id);
        let totalTopics = 0;
        let completedTopics = 0;

        for (const chapter of chaptersData) {
          const topicsData = await storage.getTopicsByChapter(chapter.id);
          totalTopics += topicsData.length;
          completedTopics += topicsData.filter((t) =>
            userProgressData.some((p) => p.topicId === t.id && p.isCompleted),
          ).length;
        }

        return {
          id: book.id,
          title: book.title,
          description: book.description,
          imageUrl: book.imageUrl,
          chaptersCount: chaptersData.length,
          progress:
            totalTopics > 0
              ? Math.round((completedTopics / totalTopics) * 100)
              : 0,
        };
      }),
    );

    res.json(booksWithProgress);
  } catch (error) {
    console.error("Get books error:", error);
    res.status(500).json({ message: "Failed to get books" });
  }
});

router.get(
  "/books/:bookId/chapters",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { bookId } = req.params as { bookId: string };
      const chaptersData = await storage.getChaptersByBook(bookId);
      const userProgressData = await storage.getUserProgress(req.userId!);

      const chaptersWithProgress = await Promise.all(
        chaptersData.map(async (chapter) => {
          const topicsData = await storage.getTopicsByChapter(chapter.id);
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
        }),
      );

      res.json(chaptersWithProgress);
    } catch (error) {
      console.error("Get chapters error:", error);
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
      console.error("Get topics error:", error);
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
      console.error("Get topic error:", error);
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
      console.error("Mark complete error:", error);
      res.status(500).json({ message: "Failed to mark topic complete" });
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
      console.error("Toggle bookmark error:", error);
      res.status(500).json({ message: "Failed to toggle bookmark" });
    }
  },
);

router.get("/search", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const query = ((req.query.query as string) || "").toLowerCase().trim();
    const filter = (req.query.filter as string) || "all";

    if (query.length < 2) {
      return res.json([]);
    }

    const results: {
      id: string;
      type: "book" | "chapter" | "topic";
      title: string;
      subtitle: string;
      bookId?: string;
      bookTitle?: string;
      chapterId?: string;
      chapterTitle?: string;
    }[] = [];

    const booksData = await storage.getBooks();

    for (const book of booksData) {
      // Search books
      if (filter === "all" || filter === "books") {
        if (
          book.title.toLowerCase().includes(query) ||
          (book.description && book.description.toLowerCase().includes(query))
        ) {
          results.push({
            id: book.id,
            type: "book",
            title: book.title,
            subtitle: book.description || "Book",
          });
        }
      }

      const chaptersData = await storage.getChaptersByBook(book.id);

      for (const chapter of chaptersData) {
        // Search chapters
        if (filter === "all" || filter === "chapters") {
          if (
            chapter.title.toLowerCase().includes(query) ||
            (chapter.description &&
              chapter.description.toLowerCase().includes(query))
          ) {
            results.push({
              id: chapter.id,
              type: "chapter",
              title: chapter.title,
              subtitle: book.title,
              bookId: book.id,
              bookTitle: book.title,
            });
          }
        }

        // Search topics
        if (filter === "all" || filter === "topics") {
          const topicsData = await storage.getTopicsByChapter(chapter.id);
          for (const topic of topicsData) {
            if (
              topic.title.toLowerCase().includes(query) ||
              (topic.description &&
                topic.description.toLowerCase().includes(query))
            ) {
              results.push({
                id: topic.id,
                type: "topic",
                title: topic.title,
                subtitle: `${book.title} > ${chapter.title}`,
                bookId: book.id,
                bookTitle: book.title,
                chapterId: chapter.id,
                chapterTitle: chapter.title,
              });
            }
          }
        }
      }
    }

    // Limit results
    res.json(results.slice(0, 50));
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Search failed" });
  }
});

export default router;
