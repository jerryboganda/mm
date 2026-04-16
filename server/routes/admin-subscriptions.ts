/**
 * Admin Subscription Management API Routes
 *
 * Covers packages, prices, features, add-ons, coupons,
 * subscriber management, analytics, and audit logging.
 */
import { Router, Response } from "express";
import { authMiddleware, requireRole, type AuthRequest } from "../middleware";
import { subscriptionService } from "../services/subscription-service";
import { couponService } from "../services/coupon-service";
import {
  createPackageSchema,
  updatePackageSchema,
  createPackagePriceSchema,
  createPackageFeatureSchema,
  createAddOnSchema,
  updateAddOnSchema,
  createCouponSchema,
  updateCouponSchema,
  bulkCouponGenerationSchema,
  addOns,
  subscriptions,
  subscriptionAuditLogs,
  users,
} from "../../shared/schema";
import { db } from "../db";
import { eq, and, desc, sql, count, or } from "drizzle-orm";

const router = Router();
const getParamValue = (param: string | string[]) =>
  Array.isArray(param) ? param[0] : param;

router.use(authMiddleware, requireRole("admin"));

// ══════════════════════════════════════════════════════════════════
// ══  PACKAGE MANAGEMENT                                        ══
// ══════════════════════════════════════════════════════════════════

// GET / — List all packages (query: ?status=active|inactive|archived)
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query as { status?: string };
    const packages = await subscriptionService.getPackages(
      status ? { status } : undefined,
    );
    res.json(packages);
  } catch (error) {
    console.error("Error listing packages:", error);
    res.status(500).json({ message: "Error listing packages" });
  }
});

// GET /comparison — Package comparison matrix
// NOTE: Must be before /:id to avoid matching "comparison" as an id param
router.get("/comparison", async (_req: AuthRequest, res: Response) => {
  try {
    const comparison = await subscriptionService.getPackageComparison();
    res.json(comparison);
  } catch (error) {
    console.error("Error fetching package comparison:", error);
    res.status(500).json({ message: "Error fetching package comparison" });
  }
});

// POST / — Create package
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createPackageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const pkg = await subscriptionService.createPackage(parsed.data as any);
    res.status(201).json(pkg);
  } catch (error) {
    console.error("Error creating package:", error);
    res.status(500).json({ message: "Error creating package" });
  }
});

// PUT /:id — Update package
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const parsed = updatePackageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const pkg = await subscriptionService.updatePackage(
      getParamValue(req.params.id),
      parsed.data as any,
    );
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    res.json(pkg);
  } catch (error) {
    console.error("Error updating package:", error);
    res.status(500).json({ message: "Error updating package" });
  }
});

// DELETE /:id — Soft-delete (archive) package
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const pkg = await subscriptionService.deletePackage(
      getParamValue(req.params.id),
    );
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    res.json({ message: "Package archived", package: pkg });
  } catch (error) {
    console.error("Error archiving package:", error);
    res.status(500).json({ message: "Error archiving package" });
  }
});

// ══════════════════════════════════════════════════════════════════
// ══  PRICE MANAGEMENT                                          ══
// ══════════════════════════════════════════════════════════════════

// POST /:packageId/prices — Add price to package
router.post("/:packageId/prices", async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createPackagePriceSchema.safeParse({
      ...req.body,
      packageId: getParamValue(req.params.packageId),
    });
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const price = await subscriptionService.createPrice(parsed.data as any);
    res.status(201).json(price);
  } catch (error) {
    console.error("Error creating price:", error);
    res.status(500).json({ message: "Error creating price" });
  }
});

// PUT /prices/:id — Update price
router.put("/prices/:id", async (req: AuthRequest, res: Response) => {
  try {
    const price = await subscriptionService.updatePrice(
      getParamValue(req.params.id),
      req.body,
    );
    if (!price) return res.status(404).json({ message: "Price not found" });
    res.json(price);
  } catch (error) {
    console.error("Error updating price:", error);
    res.status(500).json({ message: "Error updating price" });
  }
});

// DELETE /prices/:id — Delete price
router.delete("/prices/:id", async (req: AuthRequest, res: Response) => {
  try {
    await subscriptionService.deletePrice(getParamValue(req.params.id));
    res.json({ message: "Price deleted" });
  } catch (error) {
    console.error("Error deleting price:", error);
    res.status(500).json({ message: "Error deleting price" });
  }
});

// ══════════════════════════════════════════════════════════════════
// ══  FEATURE MANAGEMENT                                        ══
// ══════════════════════════════════════════════════════════════════

// POST /:packageId/features — Add feature to package
router.post("/:packageId/features", async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createPackageFeatureSchema.safeParse({
      ...req.body,
      packageId: getParamValue(req.params.packageId),
    });
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const feature = await subscriptionService.createFeature(parsed.data as any);
    res.status(201).json(feature);
  } catch (error) {
    console.error("Error creating feature:", error);
    res.status(500).json({ message: "Error creating feature" });
  }
});

// PUT /features/:id — Update feature
router.put("/features/:id", async (req: AuthRequest, res: Response) => {
  try {
    const feature = await subscriptionService.updateFeature(
      getParamValue(req.params.id),
      req.body,
    );
    if (!feature) return res.status(404).json({ message: "Feature not found" });
    res.json(feature);
  } catch (error) {
    console.error("Error updating feature:", error);
    res.status(500).json({ message: "Error updating feature" });
  }
});

// DELETE /features/:id — Delete feature
router.delete("/features/:id", async (req: AuthRequest, res: Response) => {
  try {
    await subscriptionService.deleteFeature(getParamValue(req.params.id));
    res.json({ message: "Feature deleted" });
  } catch (error) {
    console.error("Error deleting feature:", error);
    res.status(500).json({ message: "Error deleting feature" });
  }
});

// ══════════════════════════════════════════════════════════════════
// ══  ADD-ON MANAGEMENT                                         ══
// ══════════════════════════════════════════════════════════════════

// GET /add-ons — List all add-ons
router.get("/add-ons", async (_req: AuthRequest, res: Response) => {
  try {
    const allAddOns = await db
      .select()
      .from(addOns)
      .orderBy(addOns.displayOrder);
    res.json(allAddOns);
  } catch (error) {
    console.error("Error listing add-ons:", error);
    res.status(500).json({ message: "Error listing add-ons" });
  }
});

// GET /add-ons/:id — Get single add-on
router.get("/add-ons/:id", async (req: AuthRequest, res: Response) => {
  try {
    const [addOn] = await db
      .select()
      .from(addOns)
      .where(eq(addOns.id, getParamValue(req.params.id)));
    if (!addOn) return res.status(404).json({ message: "Add-on not found" });
    res.json(addOn);
  } catch (error) {
    console.error("Error fetching add-on:", error);
    res.status(500).json({ message: "Error fetching add-on" });
  }
});

// POST /add-ons — Create add-on
router.post("/add-ons", async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createAddOnSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const [addOn] = await db
      .insert(addOns)
      .values(parsed.data as any)
      .returning();
    res.status(201).json(addOn);
  } catch (error) {
    console.error("Error creating add-on:", error);
    res.status(500).json({ message: "Error creating add-on" });
  }
});

// PUT /add-ons/:id — Update add-on
router.put("/add-ons/:id", async (req: AuthRequest, res: Response) => {
  try {
    const parsed = updateAddOnSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const [addOn] = await db
      .update(addOns)
      .set({ ...(parsed.data as any), updatedAt: new Date() })
      .where(eq(addOns.id, getParamValue(req.params.id)))
      .returning();
    if (!addOn) return res.status(404).json({ message: "Add-on not found" });
    res.json(addOn);
  } catch (error) {
    console.error("Error updating add-on:", error);
    res.status(500).json({ message: "Error updating add-on" });
  }
});

// DELETE /add-ons/:id — Soft-delete add-on
router.delete("/add-ons/:id", async (req: AuthRequest, res: Response) => {
  try {
    const [addOn] = await db
      .update(addOns)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(addOns.id, getParamValue(req.params.id)))
      .returning();
    if (!addOn) return res.status(404).json({ message: "Add-on not found" });
    res.json({ message: "Add-on deactivated", addOn });
  } catch (error) {
    console.error("Error deactivating add-on:", error);
    res.status(500).json({ message: "Error deactivating add-on" });
  }
});

// ══════════════════════════════════════════════════════════════════
// ══  COUPON MANAGEMENT                                         ══
// ══════════════════════════════════════════════════════════════════

// POST /coupons/bulk-generate — Bulk generate coupons
// NOTE: Must be before /coupons/:id to avoid matching "bulk-generate" as an id
router.post(
  "/coupons/bulk-generate",
  async (req: AuthRequest, res: Response) => {
    try {
      const parsed = bulkCouponGenerationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        });
      }
      const result = await couponService.generateBulkCoupons(
        parsed.data as any,
      );
      res.status(201).json(result);
    } catch (error) {
      console.error("Error bulk generating coupons:", error);
      res.status(500).json({ message: "Error bulk generating coupons" });
    }
  },
);

// GET /coupons/campaign/:campaignId/analytics — Campaign analytics
router.get(
  "/coupons/campaign/:campaignId/analytics",
  async (req: AuthRequest, res: Response) => {
    try {
      const analytics = await couponService.getCampaignAnalytics(
        getParamValue(req.params.campaignId),
      );
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching campaign analytics:", error);
      res.status(500).json({ message: "Error fetching campaign analytics" });
    }
  },
);

// GET /coupons — List coupons (query: ?search=&campaign=&active=&type=)
router.get("/coupons", async (req: AuthRequest, res: Response) => {
  try {
    const { search, campaign, active, type } = req.query as {
      search?: string;
      campaign?: string;
      active?: string;
      type?: string;
    };
    const result = await couponService.getCoupons({
      search,
      campaignId: campaign,
      isActive:
        active !== undefined ? active === "true" || active === "1" : undefined,
      discountType: type,
    });
    res.json(result);
  } catch (error) {
    console.error("Error listing coupons:", error);
    res.status(500).json({ message: "Error listing coupons" });
  }
});

// GET /coupons/:id/analytics — Get coupon analytics
router.get(
  "/coupons/:id/analytics",
  async (req: AuthRequest, res: Response) => {
    try {
      const analytics = await couponService.getCouponAnalytics(
        getParamValue(req.params.id),
      );
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching coupon analytics:", error);
      res.status(500).json({ message: "Error fetching coupon analytics" });
    }
  },
);

// GET /coupons/:id — Get single coupon with usage stats
router.get("/coupons/:id", async (req: AuthRequest, res: Response) => {
  try {
    const coupon = await couponService.getCoupon(getParamValue(req.params.id));
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });
    res.json(coupon);
  } catch (error) {
    console.error("Error fetching coupon:", error);
    res.status(500).json({ message: "Error fetching coupon" });
  }
});

// POST /coupons — Create coupon
router.post("/coupons", async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createCouponSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const coupon = await couponService.createCoupon(parsed.data as any);
    res.status(201).json(coupon);
  } catch (error) {
    console.error("Error creating coupon:", error);
    res.status(500).json({ message: "Error creating coupon" });
  }
});

// PUT /coupons/:id — Update coupon
router.put("/coupons/:id", async (req: AuthRequest, res: Response) => {
  try {
    const parsed = updateCouponSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const coupon = await couponService.updateCoupon(
      getParamValue(req.params.id),
      parsed.data as any,
    );
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });
    res.json(coupon);
  } catch (error) {
    console.error("Error updating coupon:", error);
    res.status(500).json({ message: "Error updating coupon" });
  }
});

// DELETE /coupons/:id — Soft-delete coupon
router.delete("/coupons/:id", async (req: AuthRequest, res: Response) => {
  try {
    const coupon = await couponService.deleteCoupon(
      getParamValue(req.params.id),
    );
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });
    res.json({ message: "Coupon deactivated", coupon });
  } catch (error) {
    console.error("Error deactivating coupon:", error);
    res.status(500).json({ message: "Error deactivating coupon" });
  }
});

// ══════════════════════════════════════════════════════════════════
// ══  SUBSCRIBER MANAGEMENT                                     ══
// ══════════════════════════════════════════════════════════════════

// GET /subscribers — List all subscribers (query: ?status=&package=&search=&page=&limit=)
router.get("/subscribers", async (req: AuthRequest, res: Response) => {
  try {
    const {
      status,
      package: packageId,
      search,
      page,
      limit,
    } = req.query as {
      status?: string;
      package?: string;
      search?: string;
      page?: string;
      limit?: string;
    };

    const pageNum = page ? Math.max(1, parseInt(page, 10)) : 1;
    const pageSize = limit
      ? Math.min(100, Math.max(1, parseInt(limit, 10)))
      : 25;
    const offset = (pageNum - 1) * pageSize;

    const conditions: ReturnType<typeof eq>[] = [];
    if (status) {
      conditions.push(eq(subscriptions.status, status));
    }
    if (packageId) {
      conditions.push(eq(subscriptions.packageId, packageId));
    }

    // When search is provided, join users and filter by name/email
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    if (search) {
      const term = `%${search}%`;
      const searchCondition = or(
        sql`${users.name} ILIKE ${term}`,
        sql`${users.email} ILIKE ${term}`,
      );
      const fullWhere = where ? and(where, searchCondition) : searchCondition;

      const [totalRow] = await db
        .select({ total: count() })
        .from(subscriptions)
        .innerJoin(users, eq(subscriptions.userId, users.id))
        .where(fullWhere);

      const rows = await db
        .select({
          subscription: subscriptions,
          userName: users.name,
          userEmail: users.email,
        })
        .from(subscriptions)
        .innerJoin(users, eq(subscriptions.userId, users.id))
        .where(fullWhere)
        .orderBy(desc(subscriptions.createdAt))
        .limit(pageSize)
        .offset(offset);

      res.json({
        data: rows.map((r) => ({
          ...r.subscription,
          userName: r.userName,
          userEmail: r.userEmail,
        })),
        total: totalRow?.total ?? 0,
        page: pageNum,
        pageSize,
      });
    } else {
      const [totalRow] = await db
        .select({ total: count() })
        .from(subscriptions)
        .where(where);

      const rows = await db
        .select({
          subscription: subscriptions,
          userName: users.name,
          userEmail: users.email,
        })
        .from(subscriptions)
        .innerJoin(users, eq(subscriptions.userId, users.id))
        .where(where)
        .orderBy(desc(subscriptions.createdAt))
        .limit(pageSize)
        .offset(offset);

      res.json({
        data: rows.map((r) => ({
          ...r.subscription,
          userName: r.userName,
          userEmail: r.userEmail,
        })),
        total: totalRow?.total ?? 0,
        page: pageNum,
        pageSize,
      });
    }
  } catch (error) {
    console.error("Error listing subscribers:", error);
    res.status(500).json({ message: "Error listing subscribers" });
  }
});

// GET /subscribers/:userId — Get user's subscription details and history
router.get("/subscribers/:userId", async (req: AuthRequest, res: Response) => {
  try {
    const userId = getParamValue(req.params.userId);

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        subscriptionStatus: users.subscriptionStatus,
        subscriptionPlan: users.subscriptionPlan,
        subscriptionExpiresAt: users.subscriptionExpiresAt,
      })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) return res.status(404).json({ message: "User not found" });

    const userSubscriptions =
      await subscriptionService.getUserSubscriptions(userId);
    const activeSubscription =
      await subscriptionService.getUserActiveSubscription(userId);
    const auditLog = await subscriptionService.getUserAuditLog(userId);

    res.json({
      user,
      activeSubscription: activeSubscription || null,
      subscriptions: userSubscriptions,
      auditLog,
    });
  } catch (error) {
    console.error("Error fetching subscriber details:", error);
    res.status(500).json({ message: "Error fetching subscriber details" });
  }
});

// POST /subscribers/:userId/assign — Manually assign subscription to user
router.post(
  "/subscribers/:userId/assign",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = getParamValue(req.params.userId);
      const { packageId, priceId, couponId } = req.body;

      if (!packageId || !priceId) {
        return res
          .status(400)
          .json({ message: "packageId and priceId are required" });
      }

      const subscription = await subscriptionService.createSubscription(
        userId,
        packageId,
        priceId,
        {
          couponId,
          performedBy: req.userId,
          source: "admin_panel",
          paymentGateway: "manual",
        },
      );

      await subscriptionService.logSubscriptionEvent({
        subscriptionId: subscription.id,
        userId,
        performedBy: req.userId,
        action: "admin_override",
        newStatus: subscription.status,
        details: { note: "Manually assigned by admin", packageId, priceId },
        source: "admin_panel",
      });

      res.status(201).json(subscription);
    } catch (error) {
      console.error("Error assigning subscription:", error);
      res.status(500).json({ message: "Error assigning subscription" });
    }
  },
);

// PUT /subscribers/:userId/extend — Extend subscription period
router.put(
  "/subscribers/:userId/extend",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = getParamValue(req.params.userId);
      const { days, reason } = req.body;

      if (!days || typeof days !== "number" || days <= 0) {
        return res
          .status(400)
          .json({ message: "days must be a positive number" });
      }

      const activeSub =
        await subscriptionService.getUserActiveSubscription(userId);
      if (!activeSub) {
        return res
          .status(404)
          .json({ message: "No active subscription found for this user" });
      }

      const currentEnd = activeSub.currentPeriodEnd || new Date();
      const newEnd = new Date(currentEnd);
      newEnd.setDate(newEnd.getDate() + days);

      const [updated] = await db
        .update(subscriptions)
        .set({
          currentPeriodEnd: newEnd,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, activeSub.id))
        .returning();

      await subscriptionService.logSubscriptionEvent({
        subscriptionId: activeSub.id,
        userId,
        performedBy: req.userId,
        action: "admin_override",
        previousStatus: activeSub.status,
        newStatus: activeSub.status,
        details: {
          note: "Subscription period extended by admin",
          daysExtended: days,
          reason: reason || null,
          previousEnd: currentEnd.toISOString(),
          newEnd: newEnd.toISOString(),
        },
        source: "admin_panel",
      });

      res.json(updated);
    } catch (error) {
      console.error("Error extending subscription:", error);
      res.status(500).json({ message: "Error extending subscription" });
    }
  },
);

// PUT /subscribers/:userId/cancel — Admin-cancel a subscription
router.put(
  "/subscribers/:userId/cancel",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = getParamValue(req.params.userId);
      const { immediate, reason } = req.body;

      const activeSub =
        await subscriptionService.getUserActiveSubscription(userId);
      if (!activeSub) {
        return res
          .status(404)
          .json({ message: "No active subscription found for this user" });
      }

      const canceledSub = await subscriptionService.cancelSubscription(
        activeSub.id,
        immediate ?? true,
        reason,
      );

      await subscriptionService.logSubscriptionEvent({
        subscriptionId: activeSub.id,
        userId,
        performedBy: req.userId,
        action: "admin_override",
        previousStatus: activeSub.status,
        newStatus: canceledSub.status,
        details: {
          note: "Subscription canceled by admin",
          immediate: immediate ?? true,
          reason: reason || null,
        },
        source: "admin_panel",
      });

      res.json(canceledSub);
    } catch (error) {
      console.error("Error canceling subscription:", error);
      res.status(500).json({ message: "Error canceling subscription" });
    }
  },
);

// PUT /subscribers/:userId/change-plan — Change user's plan
router.put(
  "/subscribers/:userId/change-plan",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = getParamValue(req.params.userId);
      const { newPackageId, newPriceId, direction } = req.body;

      if (!newPackageId || !newPriceId) {
        return res
          .status(400)
          .json({ message: "newPackageId and newPriceId are required" });
      }

      const activeSub =
        await subscriptionService.getUserActiveSubscription(userId);
      if (!activeSub) {
        return res
          .status(404)
          .json({ message: "No active subscription found for this user" });
      }

      let result;
      if (direction === "downgrade") {
        const subscription = await subscriptionService.downgradeSubscription(
          activeSub.id,
          newPackageId,
          newPriceId,
        );
        result = { subscription, prorationAmount: 0 };
      } else {
        // Default to upgrade
        result = await subscriptionService.upgradeSubscription(
          activeSub.id,
          newPackageId,
          newPriceId,
        );
      }

      await subscriptionService.logSubscriptionEvent({
        subscriptionId: activeSub.id,
        userId,
        performedBy: req.userId,
        action: "admin_override",
        previousStatus: activeSub.status,
        newStatus: result.subscription.status,
        details: {
          note: `Plan changed by admin (${direction || "upgrade"})`,
          previousPackageId: activeSub.packageId,
          newPackageId,
          newPriceId,
          prorationAmount: result.prorationAmount,
        },
        source: "admin_panel",
      });

      res.json(result);
    } catch (error) {
      console.error("Error changing subscription plan:", error);
      res.status(500).json({ message: "Error changing subscription plan" });
    }
  },
);

// ══════════════════════════════════════════════════════════════════
// ══  ANALYTICS                                                 ══
// ══════════════════════════════════════════════════════════════════

// GET /analytics/overview — Subscription stats (active, MRR, churn, etc.)
// Also aliased as /analytics/kpis for admin frontend compatibility
router.get("/analytics/overview", async (_req: AuthRequest, res: Response) => {
  try {
    const stats = await subscriptionService.getSubscriptionStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching subscription overview:", error);
    res.status(500).json({ message: "Error fetching subscription overview" });
  }
});
router.get("/analytics/kpis", async (_req: AuthRequest, res: Response) => {
  try {
    const stats = await subscriptionService.getSubscriptionStats();
    // Map to frontend expected shape
    res.json({
      activeSubscribers: stats.totalActive ?? 0,
      mrr: stats.mrr ?? 0,
      mrrCurrency: "USD",
      churnRate: stats.churnRate ?? 0,
      newThisMonth: stats.newSubscriptionsThisMonth ?? 0,
      trialUsers: stats.totalTrialing ?? 0,
      cancelledThisMonth: stats.totalCanceled ?? 0,
    });
  } catch (error) {
    console.error("Error fetching subscription KPIs:", error);
    res.status(500).json({ message: "Error fetching subscription KPIs" });
  }
});

// GET /analytics/revenue — Revenue by package
// Also aliased as /analytics/revenue-by-package for admin frontend
router.get("/analytics/revenue", async (_req: AuthRequest, res: Response) => {
  try {
    const revenue = await subscriptionService.getRevenueByPackage();
    res.json(revenue);
  } catch (error) {
    console.error("Error fetching revenue analytics:", error);
    res.status(500).json({ message: "Error fetching revenue analytics" });
  }
});
router.get(
  "/analytics/revenue-by-package",
  async (_req: AuthRequest, res: Response) => {
    try {
      const revenue = await subscriptionService.getRevenueByPackage();
      const totalRev = revenue.reduce((s, r) => s + (r.totalRevenue ?? 0), 0);
      // Map to frontend expected shape
      res.json(
        revenue.map((r) => ({
          packageId: r.packageId,
          packageName: r.packageName,
          subscriberCount: r.activeSubscribers ?? 0,
          revenue: r.totalRevenue ?? 0,
          currency: "USD",
          percentOfTotal:
            totalRev > 0
              ? Math.round(((r.totalRevenue ?? 0) / totalRev) * 100)
              : 0,
        })),
      );
    } catch (error) {
      console.error("Error fetching revenue analytics:", error);
      res.status(500).json({ message: "Error fetching revenue analytics" });
    }
  },
);

// GET /analytics/churn — Churn analytics (query: ?period=30d|90d|1y)
router.get("/analytics/churn", async (req: AuthRequest, res: Response) => {
  try {
    const { period } = req.query as { period?: string };
    const churn = await subscriptionService.getChurnAnalytics(
      period as "7d" | "30d" | "90d" | "1y" | undefined,
    );
    res.json(churn);
  } catch (error) {
    console.error("Error fetching churn analytics:", error);
    res.status(500).json({ message: "Error fetching churn analytics" });
  }
});

// GET /analytics/growth — Subscriber growth (query: ?period=30d|90d|1y)
// Also aliased as /analytics/subscriber-growth for admin frontend
router.get("/analytics/growth", async (req: AuthRequest, res: Response) => {
  try {
    const { period } = req.query as { period?: string };
    const growth = await subscriptionService.getSubscriberGrowth(
      period as "7d" | "30d" | "90d" | "1y" | undefined,
    );
    res.json(growth);
  } catch (error) {
    console.error("Error fetching growth analytics:", error);
    res.status(500).json({ message: "Error fetching growth analytics" });
  }
});
router.get(
  "/analytics/subscriber-growth",
  async (req: AuthRequest, res: Response) => {
    try {
      const { period, days } = req.query as { period?: string; days?: string };
      const effectivePeriod = days
        ? (`${days}d` as "7d" | "30d" | "90d")
        : (period as "7d" | "30d" | "90d" | "1y" | undefined);
      const growth =
        await subscriptionService.getSubscriberGrowth(effectivePeriod);
      // Map to frontend expected shape: [{ date, total, new, churned }]
      let running = 0;
      res.json(
        (growth.growthByDay || []).map((d) => {
          running += d.newSubscribers ?? 0;
          return {
            date: d.date,
            total: running,
            new: d.newSubscribers ?? 0,
            churned: 0,
          };
        }),
      );
    } catch (error) {
      console.error("Error fetching subscriber growth:", error);
      res.status(500).json({ message: "Error fetching subscriber growth" });
    }
  },
);

// GET /analytics/events — Recent audit events (alias for admin dashboard)
router.get("/analytics/events", async (req: AuthRequest, res: Response) => {
  try {
    const limitParam = (req.query as { limit?: string }).limit;
    const maxRows = limitParam
      ? Math.min(500, Math.max(1, parseInt(limitParam, 10)))
      : 20;
    const logs = await db
      .select({
        id: subscriptionAuditLogs.id,
        action: subscriptionAuditLogs.action,
        userId: subscriptionAuditLogs.userId,
        userName: users.name,
        previousStatus: subscriptionAuditLogs.previousStatus,
        newStatus: subscriptionAuditLogs.newStatus,
        source: subscriptionAuditLogs.source,
        details: subscriptionAuditLogs.details,
        createdAt: subscriptionAuditLogs.createdAt,
      })
      .from(subscriptionAuditLogs)
      .leftJoin(users, eq(subscriptionAuditLogs.userId, users.id))
      .orderBy(desc(subscriptionAuditLogs.createdAt))
      .limit(maxRows);

    // Map to frontend expected shape
    res.json(
      logs.map((l) => ({
        id: l.id,
        type: l.action,
        description: `${l.action}${l.previousStatus ? ` (${l.previousStatus} → ${l.newStatus})` : ""}`,
        userId: l.userId,
        userName: l.userName || "Unknown",
        packageName: null,
        createdAt:
          l.createdAt instanceof Date ? l.createdAt.toISOString() : l.createdAt,
      })),
    );
  } catch (error) {
    console.error("Error fetching analytics events:", error);
    res.status(500).json({ message: "Error fetching analytics events" });
  }
});

// GET /analytics/coupon-overview — Coupon performance overview
router.get(
  "/analytics/coupon-overview",
  async (_req: AuthRequest, res: Response) => {
    try {
      const overview = await couponService.getCouponAnalytics();
      res.json(overview);
    } catch (error) {
      console.error("Error fetching coupon overview:", error);
      res.status(500).json({ message: "Error fetching coupon overview" });
    }
  },
);

// ══════════════════════════════════════════════════════════════════
// ══  PACKAGES (alias routes for admin frontend)                ══
// ══════════════════════════════════════════════════════════════════

// GET /packages — List all packages (alias for / root route)
router.get("/packages", async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query as { status?: string };
    const packages = await subscriptionService.getPackages(
      status ? { status } : undefined,
    );
    res.json(packages);
  } catch (error) {
    console.error("Error fetching packages:", error);
    res.status(500).json({ message: "Error fetching packages" });
  }
});

// POST /packages — Create package (alias for POST /)
router.post("/packages", async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createPackageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const pkg = await subscriptionService.createPackage({
      ...parsed.data,
      metadata: parsed.data.metadata ?? null,
    } as any);
    res.status(201).json(pkg);
  } catch (error) {
    console.error("Error creating package:", error);
    res.status(500).json({ message: "Error creating package" });
  }
});

// PUT /packages/:id — Update package (alias for PUT /:id)
router.put("/packages/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = getParamValue(req.params.id);
    const parsed = updatePackageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const pkg = await subscriptionService.updatePackage(id, parsed.data);
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    res.json(pkg);
  } catch (error) {
    console.error("Error updating package:", error);
    res.status(500).json({ message: "Error updating package" });
  }
});

// DELETE /packages/:id — Archive package (alias for DELETE /:id)
router.delete("/packages/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = getParamValue(req.params.id);
    const pkg = await subscriptionService.deletePackage(id);
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    res.json(pkg);
  } catch (error) {
    console.error("Error archiving package:", error);
    res.status(500).json({ message: "Error archiving package" });
  }
});

// POST /coupons/bulk — Bulk generate coupons (alias for /coupons/bulk-generate)
router.post("/coupons/bulk", async (req: AuthRequest, res: Response) => {
  try {
    const parsed = bulkCouponGenerationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const result = await couponService.generateBulkCoupons(parsed.data as any);
    res.status(201).json(result);
  } catch (error) {
    console.error("Error generating bulk coupons:", error);
    res.status(500).json({ message: "Error generating bulk coupons" });
  }
});

// ══════════════════════════════════════════════════════════════════
// ══  AUDIT LOG                                                 ══
// ══════════════════════════════════════════════════════════════════

// GET /audit-log — Subscription audit log (query: ?userId=&subscriptionId=&limit=)
router.get("/audit-log", async (req: AuthRequest, res: Response) => {
  try {
    const {
      userId,
      subscriptionId,
      limit: limitParam,
    } = req.query as {
      userId?: string;
      subscriptionId?: string;
      limit?: string;
    };

    const maxRows = limitParam
      ? Math.min(500, Math.max(1, parseInt(limitParam, 10)))
      : 100;

    if (subscriptionId) {
      const logs =
        await subscriptionService.getSubscriptionAuditLog(subscriptionId);
      res.json(logs.slice(0, maxRows));
      return;
    }

    if (userId) {
      const logs = await subscriptionService.getUserAuditLog(userId);
      res.json(logs.slice(0, maxRows));
      return;
    }

    // No filter — return recent audit logs
    const logs = await db
      .select()
      .from(subscriptionAuditLogs)
      .orderBy(desc(subscriptionAuditLogs.createdAt))
      .limit(maxRows);

    res.json(logs);
  } catch (error) {
    console.error("Error fetching audit log:", error);
    res.status(500).json({ message: "Error fetching audit log" });
  }
});

// ══════════════════════════════════════════════════════════════════
// ══  CATCH-ALL PARAMETRIC ROUTE (must be LAST)                 ══
// ══════════════════════════════════════════════════════════════════

// GET /:id — Get single package by ID
// This MUST be the last GET route to avoid catching /packages, /coupons,
// /add-ons, /subscribers, /audit-log, /analytics/* as :id params
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = getParamValue(req.params.id);
    // Skip if the id matches known sub-paths (safety net)
    const reserved = [
      "packages",
      "coupons",
      "add-ons",
      "subscribers",
      "audit-log",
      "analytics",
      "comparison",
    ];
    if (reserved.includes(id)) {
      return res.status(404).json({ message: "Not found" });
    }
    const pkg = await subscriptionService.getPackage(id);
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    res.json(pkg);
  } catch (error) {
    console.error("Error fetching package:", error);
    res.status(500).json({ message: "Error fetching package" });
  }
});

export default router;
