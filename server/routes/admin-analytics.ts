/**
 * Admin Analytics API Routes
 */
import { Router } from "express";
import { AuthRequest, authMiddleware, requireRole } from "../middleware";
import {
  adminGetDashboardStats,
  adminGetUserGrowth,
  adminGetQuizAnalytics,
  adminGetContentStats,
  getAuditLogs,
} from "../admin-storage";

const router = Router();

router.use(authMiddleware, requireRole("admin"));

// Dashboard summary stats
router.get("/dashboard", async (_req: AuthRequest, res) => {
  try {
    const stats = await adminGetDashboardStats();
    res.json(stats);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// User growth over time
router.get("/user-growth", async (req: AuthRequest, res) => {
  try {
    const days = parseInt((req.query.days as string) || "30");
    const data = await adminGetUserGrowth(days);
    res.json(data);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// Quiz analytics
router.get("/quiz", async (_req: AuthRequest, res) => {
  try {
    const data = await adminGetQuizAnalytics();
    res.json(data);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// Content stats per book
router.get("/content", async (_req: AuthRequest, res) => {
  try {
    const data = await adminGetContentStats();
    res.json(data);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// Audit logs
router.get("/audit-logs", async (req: AuthRequest, res) => {
  try {
    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "100");
    const data = await getAuditLogs(limit, page);
    res.json(data);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
