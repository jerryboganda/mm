import { Router } from "express";
import { storage } from "../storage";
import { sendEmail, supportIssueEmailHtml } from "../email";
import { AuthRequest, authMiddleware } from "../middleware";
import { getSupportContactSettings } from "../lib/support-contact";
import { subscriptionService } from "../services/subscription-service";
import { sanitizeString } from "../lib/api-response";
import { logger } from "../lib/logger";

const router = Router();

const ACCOUNT_DEACTIVATED_MESSAGE =
  "Your account has been deactivated. Please contact support to reactivate it.";
const ACCOUNT_DELETION_PENDING_MESSAGE =
  "Your account deletion request is in progress. Please contact support if you need help.";

router.patch(["/", "/profile"], authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, avatarUrl } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ message: "Name is required" });
    }

    const sanitizedName = sanitizeString(name);
    let sanitizedAvatarUrl: string | null | undefined;

    if (avatarUrl !== undefined) {
      if (avatarUrl !== null && typeof avatarUrl !== "string") {
        return res.status(400).json({ message: "Invalid profile photo" });
      }

      if (typeof avatarUrl === "string") {
        const trimmedAvatarUrl = avatarUrl.trim();
        const isDataImage = /^data:image\/(png|jpe?g|webp);base64,/i.test(
          trimmedAvatarUrl,
        );
        if (!isDataImage || trimmedAvatarUrl.length > 1_500_000) {
          return res.status(400).json({
            message:
              "Profile photo must be a PNG, JPG, or WebP image under 1.5 MB.",
          });
        }
        sanitizedAvatarUrl = trimmedAvatarUrl;
      } else {
        sanitizedAvatarUrl = null;
      }
    }

    const updatedUser = await storage.updateUserProfile(req.userId!, {
      name: sanitizedName,
      avatarUrl: sanitizedAvatarUrl,
    });
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      avatarUrl: updatedUser.avatarUrl,
      role: updatedUser.role,
      subscriptionStatus: updatedUser.subscriptionStatus,
      subscriptionPlan: updatedUser.subscriptionPlan,
    });
  } catch (error) {
    logger.error("Update profile error", {
      error: error instanceof Error ? error.message : String(error),
    });
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

      // Sanitize user-supplied strings before use
      const sanitizedType = sanitizeString(type);
      const sanitizedDescription = sanitizeString(description);
      const sanitizedEmail = email ? sanitizeString(email) : email;

      // Log the issue (structured, no PII leaks in production)
      if (process.env.NODE_ENV !== "production") {
        logger.debug("Support issue reported", {
          email: sanitizedEmail,
          type: sanitizedType,
        });
      }

      // Send email to support via Brevo SMTP
      try {
        const supportContactSettings = await getSupportContactSettings();
        await sendEmail({
          to: supportContactSettings.supportEmail,
          subject: `[${sanitizedType.toUpperCase()}] New Issue Report`,
          html: supportIssueEmailHtml(
            sanitizedType,
            sanitizedEmail,
            sanitizedDescription,
          ),
        });
      } catch (emailError) {
        logger.error("Failed to send support email", {
          error:
            emailError instanceof Error
              ? emailError.message
              : String(emailError),
        });
      }

      res.json({ message: "Issue reported successfully" });
    } catch (error) {
      logger.error("Report issue error", {
        error: error instanceof Error ? error.message : String(error),
      });
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
      typeof req.body?.reason === "string"
        ? sanitizeString(req.body.reason)
        : undefined;

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
    logger.error("Deactivate account error", {
      error: error instanceof Error ? error.message : String(error),
    });
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
        typeof req.body?.note === "string"
          ? sanitizeString(req.body.note)
          : undefined;

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
      logger.error("Request account deletion error", {
        error: error instanceof Error ? error.message : String(error),
      });
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
      logger.error("Get recent activity error", {
        error: error instanceof Error ? error.message : String(error),
      });
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
    logger.error("Get bookmarks error", {
      error: error instanceof Error ? error.message : String(error),
    });
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

      // Get previous status for audit logging
      const existingUser = await storage.getUser(req.userId!);
      const previousStatus = existingUser?.subscriptionStatus || "none";

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

      // Log to subscription audit trail
      if (previousStatus !== subscriptionStatus) {
        try {
          await subscriptionService.logSubscriptionEvent({
            userId: req.userId!,
            action:
              subscriptionStatus === "active"
                ? "activated"
                : subscriptionStatus,
            previousStatus,
            newStatus: subscriptionStatus,
            source: "client_sync",
            details: {
              subscriptionPlan,
              expiresAt,
            },
          });
        } catch (auditErr) {
          logger.error("Subscription audit log error", {
            error:
              auditErr instanceof Error ? auditErr.message : String(auditErr),
          });
        }
      }

      res.json({
        subscriptionStatus: user.subscriptionStatus,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
      });
    } catch (error) {
      logger.error("Subscription sync error", {
        error: error instanceof Error ? error.message : String(error),
      });
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
      logger.error("Get subscription status error", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ message: "Failed to get subscription status" });
    }
  },
);

export default router;
