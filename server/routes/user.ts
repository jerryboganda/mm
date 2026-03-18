import { Router } from "express";
import { storage } from "../storage";
import { sendEmail, supportIssueEmailHtml } from "../email";
import { AuthRequest, authMiddleware } from "../middleware";
import { getSupportContactSettings } from "../lib/support-contact";

const router = Router();

const ACCOUNT_DEACTIVATED_MESSAGE =
  "Your account has been deactivated. Please contact support to reactivate it.";
const ACCOUNT_DELETION_PENDING_MESSAGE =
  "Your account deletion request is in progress. Please contact support if you need help.";

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

      // Send email to support via Brevo SMTP
      try {
        const supportContactSettings = await getSupportContactSettings();
        await sendEmail({
          to: supportContactSettings.supportEmail,
          subject: `[${type.toUpperCase()}] New Issue Report`,
          html: supportIssueEmailHtml(type, email, description),
        });
      } catch (emailError) {
        console.error("Failed to send support email:", emailError);
      }

      res.json({ message: "Issue reported successfully" });
    } catch (error) {
      console.error("Report issue error:", error);
      res.status(500).json({ message: "Failed to report issue" });
    }
  },
);

router.post("/deactivate", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await storage.getUser(req.userId!);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isActive) {
      return res.status(400).json({
        code: "ACCOUNT_DEACTIVATED",
        message: ACCOUNT_DEACTIVATED_MESSAGE,
      });
    }

    if (
      user.deletionStatus === "requested" ||
      user.deletionStatus === "processing"
    ) {
      return res.status(400).json({
        code: "ACCOUNT_DELETION_PENDING",
        message: ACCOUNT_DELETION_PENDING_MESSAGE,
      });
    }

    const reason =
      typeof req.body?.reason === "string" ? req.body.reason.trim() : undefined;

    const updatedUser = await storage.deactivateUser(req.userId!, reason);
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      success: true,
      message: "Your account has been deactivated successfully.",
      user: {
        id: updatedUser.id,
        isActive: updatedUser.isActive,
        deactivatedAt: updatedUser.deactivatedAt,
        deactivationReason: updatedUser.deactivationReason,
      },
    });
  } catch (error) {
    console.error("Deactivate account error:", error);
    res.status(500).json({ message: "Failed to deactivate account" });
  }
});

router.post(
  "/request-account-deletion",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.isActive) {
        return res.status(400).json({
          code: "ACCOUNT_DEACTIVATED",
          message:
            "Deactivated accounts must contact support for deletion assistance.",
        });
      }

      if (
        user.deletionStatus === "requested" ||
        user.deletionStatus === "processing" ||
        user.deletionStatus === "completed"
      ) {
        return res.status(400).json({
          code: "ACCOUNT_DELETION_PENDING",
          message: "An account deletion request has already been submitted.",
        });
      }

      const note =
        typeof req.body?.note === "string" ? req.body.note.trim() : undefined;

      const updatedUser = await storage.requestAccountDeletion(
        req.userId!,
        note,
      );
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        success: true,
        message:
          "Your account deletion request has been received. We may contact you to confirm your identity.",
        user: {
          id: updatedUser.id,
          isActive: updatedUser.isActive,
          deletionRequestedAt: updatedUser.deletionRequestedAt,
          deletionStatus: updatedUser.deletionStatus,
        },
      });
    } catch (error) {
      console.error("Request account deletion error:", error);
      res.status(500).json({ message: "Failed to request account deletion" });
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
    const bookmarksWithDetails = await storage.getBookmarksWithDetails(
      req.userId!,
    );

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

// ── Subscription sync (client reports purchase to server) ─────
router.post(
  "/subscription/sync",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { subscriptionStatus, subscriptionPlan, expiresAt } = req.body;

      if (!subscriptionStatus) {
        return res
          .status(400)
          .json({ message: "subscriptionStatus is required" });
      }

      const data: {
        subscriptionStatus: string;
        subscriptionPlan?: string;
        subscriptionExpiresAt?: Date | null;
      } = {
        subscriptionStatus,
      };
      if (subscriptionPlan) data.subscriptionPlan = subscriptionPlan;
      if (expiresAt) data.subscriptionExpiresAt = new Date(expiresAt);

      const user = await storage.updateSubscription(req.userId!, data);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        subscriptionStatus: user.subscriptionStatus,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
      });
    } catch (error) {
      console.error("Subscription sync error:", error);
      res.status(500).json({ message: "Failed to sync subscription" });
    }
  },
);

// ── Get subscription status ──────────────────────────────────
router.get(
  "/subscription/status",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });

      res.json({
        subscriptionStatus: user.subscriptionStatus,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
      });
    } catch (error) {
      console.error("Get subscription status error:", error);
      res.status(500).json({ message: "Failed to get subscription status" });
    }
  },
);

export default router;
