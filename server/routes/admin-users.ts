/**
 * Admin User Management API Routes
 */
import { Router } from "express";
import { AuthRequest, authMiddleware, requireRole } from "../middleware";
import {
  adminGetUsers,
  adminGetUserDetail,
  adminUpdateUser,
  adminDeleteUser,
  createAuditLog,
} from "../admin-storage";
import {
  enforceDeviceLimit,
  getEffectiveDeviceLimit,
} from "../lib/device-sessions";
import { normalizeSubscriptionPlan } from "../../shared/pricing-contracts";

const router = Router();
const getParamValue = (param: string | string[]) =>
  Array.isArray(param) ? param[0] : param;

router.use(authMiddleware, requireRole("admin"));

// List / search users
router.get("/", async (req: AuthRequest, res) => {
  try {
    const { search, role, page, pageSize } = req.query as any;
    const result = await adminGetUsers({
      search,
      role,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
    res.json(result);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// Get user detail
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const userId = getParamValue(req.params.id);
    const user = await adminGetUserDetail(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// Update user (role, subscription, name)
router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const userId = getParamValue(req.params.id);
    const {
      role,
      subscriptionStatus,
      subscriptionPlan,
      subscriptionExpiresAt,
      name,
      isEmailVerified,
      deviceLimitOverrideEnabled,
      deviceLimitMax,
    } = req.body;
    const data: Partial<{
      role: string;
      subscriptionStatus: string;
      subscriptionPlan: string | null;
      subscriptionExpiresAt: Date | null;
      name: string;
      isEmailVerified: boolean;
      deviceLimitOverrideEnabled: boolean;
      deviceLimitMax: number | null;
    }> = {};
    if (role !== undefined) data.role = role;
    if (name !== undefined) data.name = name;
    if (isEmailVerified !== undefined) data.isEmailVerified = isEmailVerified;
    if (subscriptionStatus !== undefined)
      data.subscriptionStatus = subscriptionStatus;
    if (subscriptionPlan !== undefined)
      data.subscriptionPlan = subscriptionPlan
        ? normalizeSubscriptionPlan(subscriptionPlan) || subscriptionPlan
        : null;
    if (subscriptionExpiresAt !== undefined) {
      data.subscriptionExpiresAt = subscriptionExpiresAt
        ? new Date(subscriptionExpiresAt)
        : null;
    }
    if (deviceLimitOverrideEnabled !== undefined) {
      data.deviceLimitOverrideEnabled = Boolean(deviceLimitOverrideEnabled);
    }
    if (deviceLimitMax !== undefined) {
      const parsedLimit = Number(deviceLimitMax);
      if (
        deviceLimitMax !== null &&
        (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 20)
      ) {
        return res
          .status(400)
          .json({ message: "Device limit must be between 1 and 20." });
      }
      data.deviceLimitMax = deviceLimitMax === null ? null : parsedLimit;
    }

    const user = await adminUpdateUser(userId, data);
    if (!user) return res.status(404).json({ message: "User not found" });
    await enforceDeviceLimit(user.id, await getEffectiveDeviceLimit(user));
    await createAuditLog({
      adminUserId: req.userId!,
      action: "update",
      entityType: "user",
      entityId: userId,
      details: data,
    });
    res.json({ ...user, password: undefined });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

// Delete user
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const userId = getParamValue(req.params.id);
    // Prevent self-deletion
    if (userId === req.userId) {
      return res
        .status(400)
        .json({ message: "Cannot delete your own account" });
    }
    await adminDeleteUser(userId);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "delete",
      entityType: "user",
      entityId: userId,
    });
    res.json({ message: "User deleted" });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ message: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
