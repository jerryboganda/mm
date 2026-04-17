import { Router } from "express";
import { storage } from "../storage";
import { AuthRequest, authMiddleware, requireRole } from "../middleware";
import { z } from "zod";
import { sanitizeString } from "../lib/api-response";
import { logger } from "../lib/logger";

const router = Router();

const reportSchema = z.object({
  contentType: z.enum(["topic", "mcq", "content_block"]),
  contentId: z.string().min(1),
  reportType: z.enum([
    "factual_error",
    "typo",
    "outdated",
    "unclear",
    "error",
    "other",
  ]),
  description: z.string().min(3, "Description must be at least 3 characters"),
});

// Submit a content error report
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const data = reportSchema.parse(req.body);

    // Sanitize user-supplied description before storing
    data.description = sanitizeString(data.description);

    const report = await storage.createContentReport({
      userId: req.userId!,
      ...data,
    });

    res.json({
      id: report.id,
      message: "Report submitted. Thank you for helping improve our content!",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    logger.error("Create report error", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ message: "Failed to submit report" });
  }
});

// Get reports (admin only)
router.get(
  "/",
  authMiddleware,
  requireRole("admin", "editor"),
  async (req: AuthRequest, res) => {
    try {
      const status = req.query.status as string | undefined;
      const reports = await storage.getContentReports(status);
      res.json(reports);
    } catch (error) {
      logger.error("Get reports error", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ message: "Failed to get reports" });
    }
  },
);

// Update report status (admin only)
router.patch(
  "/:reportId",
  authMiddleware,
  requireRole("admin", "editor"),
  async (req: AuthRequest, res) => {
    try {
      const reportId = req.params.reportId as string;
      const { status } = req.body;

      if (!["reviewed", "resolved", "dismissed"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const updated = await storage.updateContentReportStatus(
        reportId,
        status,
        req.userId!,
      );

      if (!updated) {
        return res.status(404).json({ message: "Report not found" });
      }

      res.json(updated);
    } catch (error) {
      logger.error("Update report error", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ message: "Failed to update report" });
    }
  },
);

export default router;
