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
    const user = await adminGetUserDetail(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Update user (role, subscription, name)
router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const { role, subscriptionStatus, subscriptionPlan, subscriptionExpiresAt, name, isEmailVerified, isPhoneVerified } = req.body;
    const data: any = {};
    if (role !== undefined) data.role = role;
    if (name !== undefined) data.name = name;
    if (isEmailVerified !== undefined) data.isEmailVerified = isEmailVerified;
    if (isPhoneVerified !== undefined) data.isPhoneVerified = isPhoneVerified;
    if (subscriptionStatus !== undefined) data.subscriptionStatus = subscriptionStatus;
    if (subscriptionPlan !== undefined) data.subscriptionPlan = subscriptionPlan;
    if (subscriptionExpiresAt !== undefined) {
      data.subscriptionExpiresAt = subscriptionExpiresAt ? new Date(subscriptionExpiresAt) : null;
    }

    const user = await adminUpdateUser(req.params.id, data);
    if (!user) return res.status(404).json({ message: "User not found" });
    await createAuditLog({
      adminUserId: req.userId!,
      action: "update",
      entityType: "user",
      entityId: req.params.id,
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
    // Prevent self-deletion
    if (req.params.id === req.userId) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }
    await adminDeleteUser(req.params.id);
    await createAuditLog({
      adminUserId: req.userId!,
      action: "delete",
      entityType: "user",
      entityId: req.params.id,
    });
    res.json({ message: "User deleted" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
