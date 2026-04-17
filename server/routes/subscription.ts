import { Router } from "express";
import { authMiddleware, type AuthRequest } from "../middleware";
import { subscriptionService } from "../services/subscription-service";
import { couponService } from "../services/coupon-service";
import { validateCouponSchema } from "../../shared/schema";
import { logger } from "../lib/logger";

const router = Router();

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
 * Body: { code, packageId? }
 * Returns: { valid, discountAmount, discountedPrice, error }
 */
router.post(
  "/validate-coupon",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const parsed = validateCouponSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          valid: false,
          error: parsed.error.errors[0]?.message || "Invalid request body",
        });
      }

      const { code, packageId, addOnId } = parsed.data;
      const result = await couponService.validateCoupon(
        code,
        req.userId!,
        packageId,
        addOnId,
      );

      res.json({
        valid: result.valid,
        discountAmount: result.discountAmount ?? null,
        discountedPrice: result.discountedPrice ?? null,
        trialDaysExtension: result.trialDaysExtension ?? null,
        error: result.error ?? null,
      });
    } catch (error) {
      logger.error("POST /validate-coupon error", { error: String(error) });
      res.status(500).json({
        valid: false,
        error: "Failed to validate coupon",
      });
    }
  },
);

/**
 * POST /subscribe
 * Create a new subscription.
 * For RevenueCat, the actual payment happens client-side; this records
 * the subscription server-side.
 * Body: { packageId, priceId, couponCode?, paymentGateway? }
 */
router.post("/subscribe", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { packageId, priceId, couponCode, paymentGateway } = req.body;

    if (!packageId || !priceId) {
      return res
        .status(400)
        .json({ message: "packageId and priceId are required" });
    }

    const userId = req.userId!;

    // Check if user already has an active subscription
    const existing =
      await subscriptionService.getUserActiveSubscription(userId);
    if (existing) {
      return res.status(409).json({
        message:
          "You already have an active subscription. Please cancel or upgrade instead.",
      });
    }

    // Validate and apply coupon if provided
    let couponId: string | undefined;
    let discountAmount: string | undefined;

    if (couponCode) {
      const couponResult = await couponService.validateCoupon(
        couponCode,
        userId,
        packageId,
      );

      if (!couponResult.valid) {
        return res.status(400).json({
          message: couponResult.error || "Invalid coupon code",
        });
      }

      couponId = couponResult.coupon?.id;
      discountAmount =
        couponResult.discountAmount != null
          ? String(couponResult.discountAmount)
          : undefined;
    }

    const subscription = await subscriptionService.createSubscription(
      userId,
      packageId,
      priceId,
      {
        couponId,
        discountAmount,
        paymentGateway: paymentGateway || "revenuecat",
        performedBy: userId,
        source: "api",
      },
    );

    // Redeem coupon after successful subscription creation
    if (couponId && discountAmount) {
      await couponService.redeemCoupon(
        couponId,
        userId,
        subscription.id,
        parseFloat(discountAmount),
      );
    }

    res.status(201).json({ subscription });
  } catch (error: unknown) {
    logger.error("POST /subscribe error", { error: String(error) });
    const message =
      error instanceof Error ? error.message : "Failed to create subscription";
    const status = message.includes("not found")
      ? 404
      : message.includes("limit")
        ? 409
        : 500;
    res.status(status).json({ message });
  }
});

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
 * POST /upgrade
 * Upgrade to a different package.
 * Body: { packageId, priceId }
 */
router.post("/upgrade", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { packageId, priceId } = req.body;

    if (!packageId || !priceId) {
      return res
        .status(400)
        .json({ message: "packageId and priceId are required" });
    }

    const userId = req.userId!;

    const subscription =
      await subscriptionService.getUserActiveSubscription(userId);
    if (!subscription) {
      return res.status(404).json({ message: "No active subscription found" });
    }

    const result = await subscriptionService.upgradeSubscription(
      subscription.id,
      packageId,
      priceId,
    );

    res.json({
      subscription: result.subscription,
      prorationAmount: result.prorationAmount,
    });
  } catch (error: unknown) {
    logger.error("POST /upgrade error", { error: String(error) });
    const message =
      error instanceof Error ? error.message : "Failed to upgrade subscription";
    const status = message.includes("not found") ? 404 : 500;
    res.status(status).json({ message });
  }
});

/**
 * POST /downgrade
 * Downgrade to a different package (takes effect at period end).
 * Body: { packageId, priceId }
 */
router.post("/downgrade", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { packageId, priceId } = req.body;

    if (!packageId || !priceId) {
      return res
        .status(400)
        .json({ message: "packageId and priceId are required" });
    }

    const userId = req.userId!;

    const subscription =
      await subscriptionService.getUserActiveSubscription(userId);
    if (!subscription) {
      return res.status(404).json({ message: "No active subscription found" });
    }

    const updated = await subscriptionService.downgradeSubscription(
      subscription.id,
      packageId,
      priceId,
    );

    res.json({
      subscription: updated,
      message:
        "Downgrade scheduled. Changes will take effect at the end of your current billing period.",
    });
  } catch (error: unknown) {
    logger.error("POST /downgrade error", { error: String(error) });
    const message =
      error instanceof Error
        ? error.message
        : "Failed to downgrade subscription";
    const status = message.includes("not found") ? 404 : 500;
    res.status(status).json({ message });
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

/**
 * POST /reactivate
 * Reactivate an expired or canceled subscription.
 */
router.post("/reactivate", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    // Find the most recent expired or canceled subscription
    const allSubs = await subscriptionService.getUserSubscriptions(userId);
    const reactivatable = allSubs.find(
      (s) => s.status === "expired" || s.status === "canceled",
    );

    if (!reactivatable) {
      return res.status(404).json({
        message: "No expired or canceled subscription found to reactivate",
      });
    }

    const updated = await subscriptionService.reactivateSubscription(
      reactivatable.id,
    );

    res.json({ subscription: updated });
  } catch (error: unknown) {
    logger.error("POST /reactivate error", { error: String(error) });
    const message =
      error instanceof Error
        ? error.message
        : "Failed to reactivate subscription";
    res.status(500).json({ message });
  }
});

export default router;
