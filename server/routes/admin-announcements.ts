/**
 * Admin Announcements API Routes
 */
import { Router } from "express";
import { AuthRequest, authMiddleware, requireRole } from "../middleware";
import {
  adminGetAnnouncements,
  adminCreateAnnouncement,
  adminUpdateAnnouncement,
  adminDeleteAnnouncement,
  createAuditLog,
} from "../admin-storage";

const router = Router();
const getParamValue = (param: string | string[]) =>
  Array.isArray(param) ? param[0] : param;

router.use(authMiddleware, requireRole("admin"));

router.get("/", async (_req: AuthRequest, res) => {
  try {
    const data = await adminGetAnnouncements();
    res.json(data);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const { title, message, type, isActive, expiresAt } = req.body;
    if (!title || !message) {
      return res
        .status(400)
        .json({ message: "Title and message are required" });
    }
    const ann = await adminCreateAnnouncement({
      title,
      message,
      type: type || "info",
      isActive: isActive !== false,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      createdBy: req.userId,
    });
    await createAuditLog({
      adminUserId: req.userId!,
      action: "create",
      entityType: "announcement",
      entityId: ann.id,
      details: { title },
    });
    res.status(201).json(ann);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const announcementId = getParamValue(req.params.id);
    const ann = await adminUpdateAnnouncement(announcementId, req.body);
    if (!ann)
      return res.status(404).json({ message: "Announcement not found" });
    await createAuditLog({
      adminUserId: req.userId!,
      action: "update",
      entityType: "announcement",
      entityId: ann.id,
    });
    res.json(ann);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const announcementId = getParamValue(req.params.id);
    await adminDeleteAnnouncement(announcementId);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "delete",
      entityType: "announcement",
      entityId: announcementId,
    });
    res.json({ message: "Announcement deleted" });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
