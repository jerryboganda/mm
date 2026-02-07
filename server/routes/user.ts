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

      // Log the issue (structured, no PII leaks in production)
      if (process.env.NODE_ENV !== "production") {
        console.log(`[SUPPORT] Issue reported by ${email}: ${type}`);
      }

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
      // Single JOIN query instead of N+1 individual lookups
      const activitiesWithDetails = await storage.getRecentActivityWithDetails(
        req.userId!,
        limit,
      );

      res.json(
        activitiesWithDetails.map((a) => ({
          id: a.id,
          topicId: a.topicId,
          topicTitle: a.topicTitle,
          chapterTitle: a.chapterTitle,
          bookTitle: a.bookTitle,
          viewedAt: a.viewedAt.toISOString(),
        })),
      );
    } catch (error) {
      console.error("Get recent activity error:", error);
      res.status(500).json({ message: "Failed to get recent activity" });
    }
  },
);

router.get("/bookmarks", authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Single JOIN query instead of N+1 individual lookups
    const bookmarksWithDetails = await storage.getBookmarksWithDetails(req.userId!);

    res.json(
      bookmarksWithDetails.map((b) => ({
        id: b.id,
        topicId: b.topicId,
        topicTitle: b.topicTitle,
        chapterTitle: b.chapterTitle,
        bookTitle: b.bookTitle,
        createdAt: b.createdAt.toISOString(),
      })),
    );
  } catch (error) {
    console.error("Get bookmarks error:", error);
    res.status(500).json({ message: "Failed to get bookmarks" });
  }
});

export default router;
