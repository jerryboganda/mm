/**
 * Admin Manual Payments API Routes
 *
 * Lets admins review user-submitted payment proofs and approve/reject them,
 * directly grant/extend subscriptions, and manage the payment instructions
 * shown to users. All routes require an authenticated admin.
 *
 * Mounted at /api/admin/manual-payments.
 */
import { Router, Response } from "express";
import crypto from "crypto";
import { authMiddleware, requireRole, type AuthRequest } from "../middleware";
import { subscriptionService } from "../services/subscription-service";
import {
  manualPaymentProofs,
  subscriptionPackages,
  users,
  announcements,
  coupons,
  couponUsage,
  reviewPaymentProofSchema,
  manualGrantSchema,
  paymentInstructionsSchema,
} from "../../shared/schema";
import { db } from "../db";
import { eq, desc, count, sql } from "drizzle-orm";
import {
  getPaymentInstructions,
  setPaymentInstructions,
} from "../services/payment-settings";
import {
  sendSubscriptionApprovedEmail,
  sendSubscriptionRejectedEmail,
} from "../services/subscription-emails";
import { logger } from "../lib/logger";

const router = Router();
const getParamValue = (param: string | string[]) =>
  Array.isArray(param) ? param[0] : param;

function formatDate(
  value: Date | string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

router.use(authMiddleware, requireRole("admin"));

// ══════════════════════════════════════════════════════════════════
// ══  PAYMENT INSTRUCTIONS                                      ══
// ══════════════════════════════════════════════════════════════════

// GET /instructions — fetch the configured payment instructions
router.get("/instructions", async (_req: AuthRequest, res: Response) => {
  try {
    const instructions = await getPaymentInstructions();
    res.json(instructions);
  } catch (error) {
    logger.error("admin manual-payments GET /instructions error", {
      error: String(error),
    });
    res.status(500).json({ message: "Failed to load payment instructions" });
  }
});

// PUT /instructions — update payment instructions
router.put("/instructions", async (req: AuthRequest, res: Response) => {
  try {
    const parsed = paymentInstructionsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.format(),
      });
    }

    const updated = await setPaymentInstructions(parsed.data);
    res.json(updated);
  } catch (error) {
    logger.error("admin manual-payments PUT /instructions error", {
      error: String(error),
    });
    res.status(500).json({ message: "Failed to update payment instructions" });
  }
});

// ══════════════════════════════════════════════════════════════════
// ══  MANUAL SUBSCRIPTION GRANT                                 ══
// ══════════════════════════════════════════════════════════════════

// POST /grant — directly give/extend a subscription to a user
router.post("/grant", async (req: AuthRequest, res: Response) => {
  try {
    const parsed = manualGrantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.format(),
      });
    }

    const { userId: bodyUserId, email, packageId, priceId } = parsed.data;

    const [user] = bodyUserId
      ? await db.select().from(users).where(eq(users.id, bodyUserId))
      : await db.select().from(users).where(eq(users.email, email!));
    if (!user) return res.status(404).json({ message: "User not found" });
    const userId = user.id;

    // Verify package exists
    const [pkg] = await db
      .select()
      .from(subscriptionPackages)
      .where(eq(subscriptionPackages.id, packageId));
    if (!pkg) return res.status(404).json({ message: "Package not found" });

    // If an existing subscription is active, extend it or reactivate
    const existing = await subscriptionService.getUserActiveSubscription(userId);

    let subscription;
    if (existing && existing.packageId === packageId) {
      subscription = await subscriptionService.renewSubscription(existing.id);
    } else {
      subscription = await subscriptionService.createSubscription(
        userId,
        packageId,
        priceId,
        {
          paymentGateway: "manual",
          performedBy: req.userId!,
          source: "admin",
        },
      );
    }

    if (user.email) {
      void sendSubscriptionApprovedEmail(
        user.email,
        user.name || "there",
        pkg.name,
        formatDate(subscription.currentPeriodEnd),
      );
    }

    // In-app notification for the user
    try {
      await db.insert(announcements).values({
        id: crypto.randomUUID(),
        title: "Subscription Verified ✅",
        message: `Your subscription for ${pkg.name} is now active! All premium OB-GYN modules, MCQs, and notes are fully unlocked.`,
        type: "update",
        userId,
        isActive: true,
      });
    } catch (notifErr) {
      logger.error("Failed to insert grant in-app notification", {
        error: String(notifErr),
      });
    }

    res.status(201).json({ subscription });
  } catch (error) {
    logger.error("admin manual-payments POST /grant error", {
      error: String(error),
    });
    const message =
      error instanceof Error ? error.message : "Failed to grant subscription";
    res.status(500).json({ message });
  }
});

// ══════════════════════════════════════════════════════════════════
// ══  PROOF REVIEW                                              ══
// ══════════════════════════════════════════════════════════════════

// GET / — list payment proofs (query: ?status=pending|approved|rejected&page=&limit=)
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query as { status?: string };
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt((req.query.limit as string) || "20", 10)),
    );
    const offset = (page - 1) * limit;

    const whereClause =
      status && status !== "all"
        ? eq(manualPaymentProofs.status, status)
        : undefined;

    const rows = await db
      .select({
        id: manualPaymentProofs.id,
        userId: manualPaymentProofs.userId,
        userName: users.name,
        userEmail: users.email,
        packageId: manualPaymentProofs.packageId,
        packageName: subscriptionPackages.name,
        priceId: manualPaymentProofs.priceId,
        status: manualPaymentProofs.status,
        amountClaimed: manualPaymentProofs.amountClaimed,
        currency: manualPaymentProofs.currency,
        paymentMethod: manualPaymentProofs.paymentMethod,
        senderReference: manualPaymentProofs.senderReference,
        userNote: manualPaymentProofs.userNote,
        proofImageUrl: manualPaymentProofs.proofImageUrl,
        rejectionReason: manualPaymentProofs.rejectionReason,
        reviewedAt: manualPaymentProofs.reviewedAt,
        createdAt: manualPaymentProofs.createdAt,
      })
      .from(manualPaymentProofs)
      .leftJoin(users, eq(manualPaymentProofs.userId, users.id))
      .leftJoin(
        subscriptionPackages,
        eq(manualPaymentProofs.packageId, subscriptionPackages.id),
      )
      .where(whereClause)
      .orderBy(desc(manualPaymentProofs.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: count() })
      .from(manualPaymentProofs)
      .where(whereClause);

    res.json({ proofs: rows, total: Number(total), page, limit });
  } catch (error) {
    logger.error("admin manual-payments GET / error", { error: String(error) });
    res.status(500).json({ message: "Failed to load payment proofs" });
  }
});

// GET /:id — single proof
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = getParamValue(req.params.id);
    const [row] = await db
      .select({
        id: manualPaymentProofs.id,
        userId: manualPaymentProofs.userId,
        userName: users.name,
        userEmail: users.email,
        packageId: manualPaymentProofs.packageId,
        packageName: subscriptionPackages.name,
        priceId: manualPaymentProofs.priceId,
        status: manualPaymentProofs.status,
        amountClaimed: manualPaymentProofs.amountClaimed,
        currency: manualPaymentProofs.currency,
        paymentMethod: manualPaymentProofs.paymentMethod,
        senderReference: manualPaymentProofs.senderReference,
        userNote: manualPaymentProofs.userNote,
        proofImageUrl: manualPaymentProofs.proofImageUrl,
        rejectionReason: manualPaymentProofs.rejectionReason,
        reviewedAt: manualPaymentProofs.reviewedAt,
        createdAt: manualPaymentProofs.createdAt,
      })
      .from(manualPaymentProofs)
      .leftJoin(users, eq(manualPaymentProofs.userId, users.id))
      .leftJoin(
        subscriptionPackages,
        eq(manualPaymentProofs.packageId, subscriptionPackages.id),
      )
      .where(eq(manualPaymentProofs.id, id));

    if (!row) return res.status(404).json({ message: "Proof not found" });
    res.json({ proof: row });
  } catch (error) {
    logger.error("admin manual-payments GET /:id error", {
      error: String(error),
    });
    res.status(500).json({ message: "Failed to load proof" });
  }
});

// POST /:id/approve — verify the payment and provision the subscription
router.post("/:id/approve", async (req: AuthRequest, res: Response) => {
  try {
    const id = getParamValue(req.params.id);

    const [proof] = await db
      .select()
      .from(manualPaymentProofs)
      .where(eq(manualPaymentProofs.id, id));
    if (!proof) return res.status(404).json({ message: "Proof not found" });
    if (proof.status !== "pending") {
      return res
        .status(409)
        .json({ message: `Proof has already been ${proof.status}` });
    }
    if (!proof.priceId) {
      return res
        .status(400)
        .json({ message: "Proof has no price to subscribe to" });
    }

    // Guard against double-provisioning
    const existing = await subscriptionService.getUserActiveSubscription(
      proof.userId,
    );
    if (existing) {
      return res.status(409).json({
        message: "User already has an active subscription.",
      });
    }

    // Check if this is a promo / coupon code submission
    const isCouponMethod =
      proof.paymentMethod === "Promo / Coupon Code" ||
      (proof.userNote && proof.userNote.toLowerCase().includes("promo/coupon"));

    let couponRecord: any = null;
    if (isCouponMethod && proof.senderReference) {
      const cleanRef = proof.senderReference.toUpperCase().trim();
      const [foundCoupon] = await db
        .select()
        .from(coupons)
        .where(eq(coupons.code, cleanRef));
      if (foundCoupon) {
        couponRecord = foundCoupon;
      }
    }

    const subscription = await subscriptionService.createSubscription(
      proof.userId,
      proof.packageId,
      proof.priceId,
      {
        couponId: couponRecord?.id || undefined,
        discountAmount: couponRecord
          ? String(couponRecord.discountValue || "0")
          : undefined,
        paymentGateway: isCouponMethod ? "coupon" : "manual",
        performedBy: req.userId!,
        source: "admin",
        durationDaysOverride: couponRecord?.durationDaysOverride || undefined,
      },
    );

    // Record coupon usage if coupon matched
    if (couponRecord) {
      try {
        await db.insert(couponUsage).values({
          id: crypto.randomUUID(),
          couponId: couponRecord.id,
          userId: proof.userId,
          subscriptionId: subscription.id,
          discountApplied: String(couponRecord.discountValue || "0"),
        });
        await db
          .update(coupons)
          .set({
            currentUseCount: sql`${coupons.currentUseCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(coupons.id, couponRecord.id));
      } catch (couponErr) {
        logger.error("Failed to record coupon usage during approval", {
          error: String(couponErr),
        });
      }
    }

    await db
      .update(manualPaymentProofs)
      .set({
        status: "approved",
        reviewedBy: req.userId!,
        reviewedAt: new Date(),
        createdSubscriptionId: subscription.id,
        updatedAt: new Date(),
      })
      .where(eq(manualPaymentProofs.id, id));

    const [updated] = await db
      .select()
      .from(manualPaymentProofs)
      .where(eq(manualPaymentProofs.id, id));

    // Notify the user (best-effort)
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, proof.userId));
    const [pkg] = await db
      .select()
      .from(subscriptionPackages)
      .where(eq(subscriptionPackages.id, proof.packageId));
    if (user?.email) {
      void sendSubscriptionApprovedEmail(
        user.email,
        user.name || "there",
        pkg?.name || "your plan",
        formatDate(subscription.currentPeriodEnd),
      );
    }

    // In-app notification for the user
    try {
      await db.insert(announcements).values({
        id: crypto.randomUUID(),
        title: "Subscription Verified ✅",
        message: `Your payment for ${pkg?.name || "your plan"} has been approved! All premium OB-GYN modules, MCQs, and notes are now fully unlocked.`,
        type: "update",
        userId: proof.userId,
        isActive: true,
      });
    } catch (notifErr) {
      logger.error("Failed to insert approval in-app notification", {
        error: String(notifErr),
      });
    }

    res.json({ proof: updated, subscription });
  } catch (error) {
    logger.error("admin manual-payments POST /:id/approve error", {
      error: String(error),
    });
    const message =
      error instanceof Error ? error.message : "Failed to approve proof";
    res.status(500).json({ message });
  }
});

// POST /:id/reject — decline the payment proof
router.post("/:id/reject", async (req: AuthRequest, res: Response) => {
  try {
    const id = getParamValue(req.params.id);
    const parsed = reviewPaymentProofSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Validation failed" });
    }

    const [proof] = await db
      .select()
      .from(manualPaymentProofs)
      .where(eq(manualPaymentProofs.id, id));
    if (!proof) return res.status(404).json({ message: "Proof not found" });
    if (proof.status !== "pending") {
      return res
        .status(409)
        .json({ message: `Proof has already been ${proof.status}` });
    }

    await db
      .update(manualPaymentProofs)
      .set({
        status: "rejected",
        rejectionReason: parsed.data.rejectionReason ?? null,
        reviewedBy: req.userId!,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(manualPaymentProofs.id, id));

    const [updated] = await db
      .select()
      .from(manualPaymentProofs)
      .where(eq(manualPaymentProofs.id, id));

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, proof.userId));
    const [pkg] = await db
      .select()
      .from(subscriptionPackages)
      .where(eq(subscriptionPackages.id, proof.packageId));
    if (user?.email) {
      void sendSubscriptionRejectedEmail(
        user.email,
        user.name || "there",
        pkg?.name || "your plan",
        parsed.data.rejectionReason,
      );
    }

    res.json({ proof: updated });
  } catch (error) {
    logger.error("admin manual-payments POST /:id/reject error", {
      error: String(error),
    });
    res.status(500).json({ message: "Failed to reject proof" });
  }
});

export default router;
