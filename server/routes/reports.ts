import { Router } from "express";
import { storage } from "../storage";
import { AuthRequest, authMiddleware, requireRole } from "../middleware";
import { z } from "zod";

const router = Router();

const reportSchema = z.object({
  contentType: z.enum(["topic", "mcq", "content_block"]),
  contentId: z.string().min(1),
  reportType: z.enum(["error", "outdated", "unclear", "other"]),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

// Submit a content error report
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const data = reportSchema.parse(req.body);

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
    console.error("Create report error:", error);
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
      console.error("Get reports error:", error);
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
      console.error("Update report error:", error);
      res.status(500).json({ message: "Failed to update report" });
    }
  },
);

export default router;
