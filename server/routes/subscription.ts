import { Router } from "express";
import multer from "multer";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middleware";
import { subscriptionService } from "../services/subscription-service";
import { couponService } from "../services/coupon-service";
import { z } from "zod";
import {
  validateCouponSchema,
  submitPaymentProofSchema,
  manualPaymentProofs,
  subscriptionPackages,
  users,
} from "../../shared/schema";
import { db } from "../db";
import { getPaymentInstructions } from "../services/payment-settings";
import { sendProofReceivedEmail } from "../services/subscription-emails";
import { logger } from "../lib/logger";
import { uploadToMinIO } from "../lib/s3";

const router = Router();

// ── Payment-proof image upload (multer → local disk) ──────────────
const proofUploadDir = path.resolve(
  process.cwd(),
  "uploads",
  "payment-proofs",
);
const allowedProofTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const proofExtensionByMime: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

fs.mkdirSync(proofUploadDir, { recursive: true });

const proofUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, proofUploadDir),
    filename: (_req, file, cb) => {
      const ext =
        proofExtensionByMime[file.mimetype] ||
        path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!allowedProofTypes.has(file.mimetype)) {
      cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"));
      return;
    }
    cb(null, true);
  },
});
const uploadSingleProof = proofUpload.single("proof");

// ══════════════════════════════════════════════════════════════
// Public routes (no auth required)
// ══════════════════════════════════════════════════════════════

/**
 * GET /packages
 * List all active, user-visible packages with prices and features.
 * Used by the paywall / subscription selection screen.
 */
router.get("/packages", async (_req, res) => {
  try {
    const packages = await subscriptionService.getPackageComparison();

    // Filter to only user-visible packages and strip internal/admin fields
    const userFacing = packages
      .filter((pkg) => pkg.isVisibleToUsers)
      .map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        slug: pkg.slug,
        description: pkg.description,
        shortDescription: pkg.shortDescription,
        iconUrl: pkg.iconUrl,
        displayOrder: pkg.displayOrder,
        trialDays: pkg.trialDays,
        prices: pkg.prices.map((p) => ({
          id: p.id,
          billingCycle: p.billingCycle,
          price: p.price,
          currency: p.currency,
          originalPrice: p.originalPrice,
          revenuecatOfferingId: p.revenuecatOfferingId,
        })),
        features: pkg.features.map((f) => ({
          featureKey: f.featureKey,
          name: f.name,
          description: f.description,
          valueType: f.valueType,
          value: f.value,
          displayOrder: f.displayOrder,
        })),
      }));

    res.json({ packages: userFacing });
  } catch (error) {
    logger.error("GET /packages error", { error: String(error) });
    res.status(500).json({ message: "Failed to load packages" });
  }
});

/**
 * GET /packages/compare
 * Package comparison matrix — same data as /packages but explicitly
 * structured for a comparison table UI.
 */
router.get("/packages/compare", async (_req, res) => {
  try {
    const packages = await subscriptionService.getPackageComparison();

    // Collect all unique feature keys across packages for the matrix
    const featureKeySet = new Set<string>();
    for (const pkg of packages) {
      for (const f of pkg.features) {
        if (f.featureKey) {
          featureKeySet.add(f.featureKey);
        }
      }
    }

    const allFeatureKeys = Array.from(featureKeySet);

    const matrix = packages.map((pkg) => {
      const featureMap: Record<
        string,
        { name: string; valueType: string; value: string | null }
      > = {};

      for (const key of allFeatureKeys) {
        const feature = pkg.features.find((f) => f.featureKey === key);
        featureMap[key] = feature
          ? {
              name: feature.name,
              valueType: feature.valueType,
              value: feature.value,
            }
          : { name: key, valueType: "cross", value: null };
      }

      return {
        id: pkg.id,
        name: pkg.name,
        slug: pkg.slug,
        description: pkg.description,
        shortDescription: pkg.shortDescription,
        iconUrl: pkg.iconUrl,
        displayOrder: pkg.displayOrder,
        trialDays: pkg.trialDays,
        prices: pkg.prices.map((p) => ({
          id: p.id,
          billingCycle: p.billingCycle,
          price: p.price,
          currency: p.currency,
          originalPrice: p.originalPrice,
        })),
        features: featureMap,
      };
    });

    res.json({ packages: matrix, featureKeys: allFeatureKeys });
  } catch (error) {
    logger.error("GET /packages/compare error", { error: String(error) });
    res.status(500).json({ message: "Failed to load package comparison" });
  }
});

/**
 * GET /payment-instructions
 * Admin-configured manual payment details (bank + mobile wallets +
 * instructions) shown on the purchase screen.
 */
router.get("/payment-instructions", async (_req, res) => {
  try {
    const instructions = await getPaymentInstructions();
    res.json({ instructions });
  } catch (error) {
    logger.error("GET /payment-instructions error", { error: String(error) });
    res.status(500).json({ message: "Failed to load payment instructions" });
  }
});

// ══════════════════════════════════════════════════════════════
// Authenticated routes
// ══════════════════════════════════════════════════════════════

/**
 * GET /my-subscription
 * Get the current user's active subscription with package details,
 * next billing date, and active add-ons.
 */
router.get(
  "/my-subscription",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const subscription =
        await subscriptionService.getUserActiveSubscription(userId);

      if (!subscription) {
        return res.json({ subscription: null });
      }

      // Enrich with package details and features
      const pkg = await subscriptionService.getPackage(subscription.packageId);

      res.json({
        subscription: {
          id: subscription.id,
          status: subscription.status,
          packageId: subscription.packageId,
          packageName: pkg?.name ?? null,
          packageSlug: pkg?.slug ?? null,
          billingCycle: subscription.billingCycle,
          priceAtPurchase: subscription.priceAtPurchase,
          currency: subscription.currency,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          nextBillingDate: subscription.currentPeriodEnd,
          trialStartAt: subscription.trialStartAt,
          trialEndAt: subscription.trialEndAt,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          canceledAt: subscription.canceledAt,
          pausedAt: subscription.pausedAt,
          paymentGateway: subscription.paymentGateway,
          features:
            pkg?.features.map((f) => ({
              featureKey: f.featureKey,
              name: f.name,
              valueType: f.valueType,
              value: f.value,
            })) ?? [],
        },
      });
    } catch (error) {
      logger.error("GET /my-subscription error", { error: String(error) });
      res.status(500).json({ message: "Failed to load subscription" });
    }
  },
);

/**
 * GET /invoices
 * Get the current user's invoice history.
 */
router.get("/invoices", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const invoices = await subscriptionService.getUserInvoices(req.userId!);
    res.json({ invoices });
  } catch (error) {
    logger.error("GET /invoices error", { error: String(error) });
    res.status(500).json({ message: "Failed to load invoices" });
  }
});

/**
 * GET /invoices/:id
 * Get a specific invoice with line items.
 * Ensures the invoice belongs to the requesting user.
 */
router.get("/invoices/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const invoiceId = req.params.id as string;
    const invoice = await subscriptionService.getInvoice(invoiceId);

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Ensure the invoice belongs to the requesting user
    if (invoice.userId !== req.userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json({ invoice });
  } catch (error) {
    logger.error("GET /invoices/:id error", { error: String(error) });
    res.status(500).json({ message: "Failed to load invoice" });
  }
});

/**
 * POST /validate-coupon
 * Validate a coupon code for the current user.
 * Body: { code: string, packageId: string, priceId?: string }
 */
router.post(
  "/validate-coupon",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { code, packageId, priceId } = req.body || {};
      if (!code || typeof code !== "string" || !code.trim()) {
        return res.status(400).json({
          valid: false,
          message: "Coupon code is required",
        });
      }
      if (!packageId || typeof packageId !== "string") {
        return res.status(400).json({
          valid: false,
          message: "Package ID is required",
        });
      }

      const result = await couponService.validateCouponDetailed({
        code: code.trim(),
        userId: req.userId!,
        packageId,
        priceId: typeof priceId === "string" ? priceId : undefined,
      });

      if (!result.valid) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error) {
      logger.error("POST /validate-coupon error", { error: String(error) });
      res.status(500).json({
        valid: false,
        message: "Failed to validate coupon",
      });
    }
  },
);

/**
 * POST /redeem-free-coupon
 * Instantly redeem a 100% free access coupon.
 * Body: { code: string, packageId: string, priceId?: string }
 */
router.post(
  "/redeem-free-coupon",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { code, packageId, priceId } = req.body || {};
      if (!code || typeof code !== "string" || !code.trim()) {
        return res.status(400).json({
          success: false,
          message: "Coupon code is required",
        });
      }
      if (!packageId || typeof packageId !== "string") {
        return res.status(400).json({
          success: false,
          message: "Package ID is required",
        });
      }

      const result = await couponService.redeemFreeCoupon({
        code: code.trim(),
        userId: req.userId!,
        packageId,
        priceId: typeof priceId === "string" ? priceId : undefined,
      });

      res.json(result);
    } catch (error: any) {
      logger.error("POST /redeem-free-coupon error", { error: String(error) });
      res.status(400).json({
        success: false,
        message: error?.message || "Failed to redeem free coupon",
      });
    }
  },
);

// NOTE: Self-service provisioning endpoints (/subscribe, /upgrade, /downgrade,
// /reactivate) were intentionally removed. Subscriptions are now provisioned
// exclusively by an admin approving an uploaded payment proof (or via an admin
// manual grant). Allowing a user to create/extend their own subscription would
// bypass the manual-payment paywall.

/**
 * POST /cancel
 * Cancel the current subscription.
 * Body: { immediate?, reason? }
 */
router.post("/cancel", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { immediate, reason } = req.body;
    const userId = req.userId!;

    const subscription =
      await subscriptionService.getUserActiveSubscription(userId);
    if (!subscription) {
      return res.status(404).json({ message: "No active subscription found" });
    }

    const updated = await subscriptionService.cancelSubscription(
      subscription.id,
      immediate === true,
      reason,
    );

    res.json({
      subscription: updated,
      message: immediate
        ? "Subscription canceled immediately"
        : "Subscription will be canceled at the end of the current billing period",
    });
  } catch (error) {
    logger.error("POST /cancel error", { error: String(error) });
    res.status(500).json({ message: "Failed to cancel subscription" });
  }
});

/**
 * POST /pause
 * Pause the current subscription.
 */
router.post("/pause", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const subscription =
      await subscriptionService.getUserActiveSubscription(userId);
    if (!subscription) {
      return res.status(404).json({ message: "No active subscription found" });
    }

    if (subscription.status !== "active") {
      return res.status(400).json({
        message: `Cannot pause subscription with status: ${subscription.status}`,
      });
    }

    const updated = await subscriptionService.pauseSubscription(
      subscription.id,
    );

    res.json({ subscription: updated });
  } catch (error) {
    logger.error("POST /pause error", { error: String(error) });
    res.status(500).json({ message: "Failed to pause subscription" });
  }
});

/**
 * POST /resume
 * Resume a paused subscription.
 */
router.post("/resume", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    // Look for paused subscription (getUserActiveSubscription only returns
    // trialing/active/past_due, so we need to query directly)
    const allSubs = await subscriptionService.getUserSubscriptions(userId);
    const pausedSub = allSubs.find((s) => s.status === "paused");

    if (!pausedSub) {
      return res.status(404).json({ message: "No paused subscription found" });
    }

    const updated = await subscriptionService.resumeSubscription(pausedSub.id);

    res.json({ subscription: updated });
  } catch (error: unknown) {
    logger.error("POST /resume error", { error: String(error) });
    const message =
      error instanceof Error ? error.message : "Failed to resume subscription";
    res.status(500).json({ message });
  }
});

/**
 * GET /history
 * Full subscription history for the current user.
 */
router.get("/history", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const subscriptions = await subscriptionService.getUserSubscriptions(
      req.userId!,
    );

    res.json({ subscriptions });
  } catch (error) {
    logger.error("GET /history error", { error: String(error) });
    res.status(500).json({ message: "Failed to load subscription history" });
  }
});

// ══════════════════════════════════════════════════════════════
// Manual payment-proof flow
// ══════════════════════════════════════════════════════════════

/**
 * POST /proof & POST /upload-proof
 * Submit a payment-proof image for a package. Multipart form-data:
 * field `proof` (image) + packageId, priceId, amountClaimed?,
 * paymentMethod?, senderReference?, userNote?, couponCode?, couponId?.
 * Creates a `pending` manual_payment_proofs row for admin review.
 */
const uploadProofBodySchema = submitPaymentProofSchema.extend({
  couponCode: z.string().optional(),
  couponId: z.string().optional(),
});

router.post(
  ["/proof", "/upload-proof"],
  authMiddleware,
  (req, res, next) => {
    uploadSingleProof(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const message =
          err.code === "LIMIT_FILE_SIZE"
            ? "Image must be 10 MB or smaller"
            : err.message;
        return res.status(400).json({ message });
      }
      return res.status(400).json({
        message: err instanceof Error ? err.message : "Proof upload failed",
      });
    });
  },
  async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;

      if (!req.file) {
        return res.status(400).json({ message: "Proof image is required" });
      }

      const parsed = uploadProofBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message:
            parsed.error.errors[0]?.message || "Invalid request body",
        });
      }
      const {
        packageId,
        priceId,
        amountClaimed,
        paymentMethod,
        senderReference,
        userNote,
        couponCode,
        couponId,
      } = parsed.data;

      // Block if the user already has an active subscription
      const existingSub =
        await subscriptionService.getUserActiveSubscription(userId);
      if (existingSub) {
        return res.status(409).json({
          message: "You already have an active subscription.",
        });
      }

      // Block if the user already has a pending proof under review
      const [pending] = await db
        .select()
        .from(manualPaymentProofs)
        .where(
          and(
            eq(manualPaymentProofs.userId, userId),
            eq(manualPaymentProofs.status, "pending"),
          ),
        );
      if (pending) {
        return res.status(409).json({
          message:
            "You already have a payment proof awaiting review. Please wait for it to be processed.",
        });
      }

      // Validate the package exists
      const [pkg] = await db
        .select()
        .from(subscriptionPackages)
        .where(eq(subscriptionPackages.id, packageId));
      if (!pkg) {
        return res.status(404).json({ message: "Package not found" });
      }

      await uploadToMinIO(
        `uploads/payment-proofs/${req.file.filename}`,
        req.file.path,
        req.file.mimetype,
      );

      let finalUserNote = userNote ?? null;
      const appliedCoupon = couponCode || couponId;
      if (appliedCoupon) {
        finalUserNote = finalUserNote
          ? `${finalUserNote} (Coupon applied: ${appliedCoupon})`
          : `Coupon applied: ${appliedCoupon}`;
      }

      const proofObj = {
        id: crypto.randomUUID(),
        userId,
        packageId,
        priceId,
        status: "pending",
        amountClaimed: amountClaimed ?? null,
        currency: null,
        paymentMethod: paymentMethod ?? null,
        senderReference: senderReference ?? null,
        userNote: finalUserNote,
        proofImageUrl: `/uploads/payment-proofs/${req.file.filename}`,
        proofFilename: req.file.filename,
      };

      await db.insert(manualPaymentProofs).values(proofObj);

      // Notify the user their proof was received (best-effort)
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));
      if (user?.email) {
        void sendProofReceivedEmail(user.email, user.name || "there", pkg.name);
      }

      res.status(201).json({ proof: proofObj });
    } catch (error) {
      logger.error("POST /proof error", { error: String(error) });
      res.status(500).json({ message: "Failed to submit payment proof" });
    }
  },
);

/**
 * GET /my-proofs
 * The current user's payment-proof submissions (most recent first), so the
 * mobile pending screen can reflect approval/rejection.
 */
router.get("/my-proofs", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const proofs = await db
      .select({
        id: manualPaymentProofs.id,
        packageId: manualPaymentProofs.packageId,
        priceId: manualPaymentProofs.priceId,
        status: manualPaymentProofs.status,
        amountClaimed: manualPaymentProofs.amountClaimed,
        paymentMethod: manualPaymentProofs.paymentMethod,
        rejectionReason: manualPaymentProofs.rejectionReason,
        proofImageUrl: manualPaymentProofs.proofImageUrl,
        createdAt: manualPaymentProofs.createdAt,
        reviewedAt: manualPaymentProofs.reviewedAt,
        packageName: subscriptionPackages.name,
      })
      .from(manualPaymentProofs)
      .leftJoin(
        subscriptionPackages,
        eq(manualPaymentProofs.packageId, subscriptionPackages.id),
      )
      .where(eq(manualPaymentProofs.userId, req.userId!))
      .orderBy(desc(manualPaymentProofs.createdAt));

    res.json({ proofs });
  } catch (error) {
    logger.error("GET /my-proofs error", { error: String(error) });
    res.status(500).json({ message: "Failed to load proofs" });
  }
});

export default router;
