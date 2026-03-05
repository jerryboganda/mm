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
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Get user detail
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const userId = getParamValue(req.params.id);
    const user = await adminGetUserDetail(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
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
    } = req.body;
    const data: any = {};
    if (role !== undefined) data.role = role;
    if (name !== undefined) data.name = name;
    if (isEmailVerified !== undefined) data.isEmailVerified = isEmailVerified;
    if (subscriptionStatus !== undefined)
      data.subscriptionStatus = subscriptionStatus;
    if (subscriptionPlan !== undefined)
      data.subscriptionPlan = subscriptionPlan;
    if (subscriptionExpiresAt !== undefined) {
      data.subscriptionExpiresAt = subscriptionExpiresAt
        ? new Date(subscriptionExpiresAt)
        : null;
    }

    const user = await adminUpdateUser(userId, data);
    if (!user) return res.status(404).json({ message: "User not found" });
    await createAuditLog({
      adminUserId: req.userId!,
      action: "update",
      entityType: "user",
      entityId: userId,
      details: data,
    });
    res.json({ ...user, password: undefined });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
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
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
