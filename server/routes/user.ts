import { Router } from "express";
import { storage } from "../storage";
import { AuthRequest, authMiddleware } from "../middleware";

const router = Router();

router.patch("/profile", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ message: "Name is required" });
    }

    const updatedUser = await storage.updateUserProfile(req.userId!, {
      name: name.trim(),
    });
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      subscriptionStatus: updatedUser.subscriptionStatus,
      subscriptionPlan: updatedUser.subscriptionPlan,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

router.post(
  "/support/report-issue",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { type, description, email } = req.body;

      if (!type || !description) {
        return res
          .status(400)
          .json({ message: "Issue type and description are required" });
      }

      // Log the issue for now - in production, you'd save to database or send to support system
      console.log(`[SUPPORT] Issue reported by ${email}:`);
      console.log(`  Type: ${type}`);
      console.log(`  Description: ${description}`);

      // Optionally send email to support
      if (process.env.RESEND_API_KEY) {
        try {
          const { Resend } = await import("resend");
          const resendClient = new Resend(process.env.RESEND_API_KEY);

          await resendClient.emails.send({
            from: "Maternal Mind <noreply@maternalmind.app>",
            to: ["support@maternalmind.app"],
            subject: `[${type.toUpperCase()}] New Issue Report`,
            html: `
            <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <h1 style="color: #11a4d4;">Issue Report</h1>
              <p><strong>Type:</strong> ${type}</p>
              <p><strong>User:</strong> ${email}</p>
              <p><strong>Description:</strong></p>
              <p style="background: #f5f5f5; padding: 15px; border-radius: 8px;">${description}</p>
            </div>
          `,
          });
        } catch (emailError) {
          console.error("Failed to send support email:", emailError);
        }
      }

      res.json({ message: "Issue reported successfully" });
    } catch (error) {
      console.error("Report issue error:", error);
      res.status(500).json({ message: "Failed to report issue" });
    }
  },
);

router.get(
  "/recent-activity",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const recentActivities = await storage.getRecentActivity(
        req.userId!,
        limit,
      );

      // Enrich with topic/chapter/book details
      const activitiesWithDetails = await Promise.all(
        recentActivities.map(async (activity) => {
          const topic = await storage.getTopic(activity.topicId);
          if (!topic) return null;

          const chapter = await storage.getChapter(topic.chapterId);
          if (!chapter) return null;

          const book = await storage.getBook(chapter.bookId);
          if (!book) return null;

          return {
            id: activity.id,
            topicId: topic.id,
            topicTitle: topic.title,
            chapterTitle: chapter.title,
            bookTitle: book.title,
            viewedAt: activity.viewedAt.toISOString(),
          };
        }),
      );

      res.json(activitiesWithDetails.filter(Boolean));
    } catch (error) {
      console.error("Get recent activity error:", error);
      res.status(500).json({ message: "Failed to get recent activity" });
    }
  },
);

router.get("/bookmarks", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userBookmarks = await storage.getBookmarks(req.userId!);

    const bookmarksWithDetails = await Promise.all(
      userBookmarks.map(async (bookmark) => {
        const topic = await storage.getTopic(bookmark.topicId);
        if (!topic) return null;

        const chapter = await storage.getChapter(topic.chapterId);
        if (!chapter) return null;

        const book = await storage.getBook(chapter.bookId);
        if (!book) return null;

        return {
          id: bookmark.id,
          topicId: topic.id,
          topicTitle: topic.title,
          chapterTitle: chapter.title,
          bookTitle: book.title,
          createdAt: bookmark.createdAt.toISOString(),
        };
      }),
    );

    res.json(bookmarksWithDetails.filter(Boolean));
  } catch (error) {
    console.error("Get bookmarks error:", error);
    res.status(500).json({ message: "Failed to get bookmarks" });
  }
});

export default router;
