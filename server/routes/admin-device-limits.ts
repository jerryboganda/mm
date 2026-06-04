import { Router } from "express";
import { z } from "zod";
import { AuthRequest, authMiddleware, requireRole } from "../middleware";
import { storage } from "../storage";
import {
  clampDeviceLimit,
  enforceGlobalDeviceLimits,
  getDeviceLimitSettings,
  listUserSessions,
  revokeSession,
  revokeUserSessions,
  setDeviceLimitSettings,
} from "../lib/device-sessions";
import { createAuditLog } from "../admin-storage";

const router = Router();
const getParamValue = (param: string | string[]) =>
  Array.isArray(param) ? param[0] : param;

router.use(authMiddleware, requireRole("admin"));

router.get("/settings", async (_req: AuthRequest, res) => {
  const settings = await getDeviceLimitSettings();
  res.json(settings);
});

router.put("/settings", async (req: AuthRequest, res) => {
  const schema = z.object({
    enabled: z.boolean(),
    defaultMax: z.number().int().min(1).max(20),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid device limit settings" });
  }

  const settings = await setDeviceLimitSettings({
    enabled: parsed.data.enabled,
    defaultMax: clampDeviceLimit(parsed.data.defaultMax),
  });
  await enforceGlobalDeviceLimits();

  await createAuditLog({
    adminUserId: req.userId!,
    action: "update",
    entityType: "device_limit_settings",
    details: settings,
  });

  res.json(settings);
});

router.get("/users/:userId/sessions", async (req: AuthRequest, res) => {
  const userId = getParamValue(req.params.userId);
  const user = await storage.getUser(userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  const sessions = await listUserSessions(user.id);
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      deviceLimitOverrideEnabled: user.deviceLimitOverrideEnabled,
      deviceLimitMax: user.deviceLimitMax,
    },
    sessions: sessions.map((session) => ({
      id: session.id,
      deviceId: session.deviceId,
      deviceLabel: session.deviceLabel,
      platform: session.platform,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
    })),
  });
});

router.delete("/sessions/:sessionId", async (req: AuthRequest, res) => {
  const sessionId = getParamValue(req.params.sessionId);
  await revokeSession(sessionId, "admin_revoked", req.userId);
  await createAuditLog({
    adminUserId: req.userId!,
    action: "revoke",
    entityType: "user_session",
    entityId: sessionId,
  });
  res.json({ message: "Session revoked" });
});

router.delete("/users/:userId/sessions", async (req: AuthRequest, res) => {
  const userId = getParamValue(req.params.userId);
  const user = await storage.getUser(userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  await revokeUserSessions(user.id, "admin_revoked_all", req.userId);
  await createAuditLog({
    adminUserId: req.userId!,
    action: "revoke_all",
    entityType: "user_session",
    entityId: user.id,
    details: { email: user.email },
  });
  res.json({ message: "All sessions revoked" });
});

export default router;
