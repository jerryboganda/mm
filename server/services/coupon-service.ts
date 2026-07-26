/**
 * Coupon / Discount Engine Service
 *
 * Handles CRUD, bulk generation, real-time validation, atomic redemption,
 * stacking rules, and analytics for the coupon system.
 */

import crypto from "crypto";
import {
  coupons,
  couponUsage,
  subscriptionPackages,
  addOns,
  packagePrices,
  type Coupon,
  type CouponUsage,
} from "../../shared/schema";
import { db } from "../db";
import {
  eq,
  and,
  desc,
  sql,
  count,
  gt,
  lte,
  gte,
  inArray,
  or,
  isNull,
} from "drizzle-orm";

// ── Types ─────────────────────────────────────────────────────

interface CouponFilters {
  isActive?: boolean;
  campaignId?: string;
  search?: string;
  discountType?: string;
  limit?: number;
  offset?: number;
}

interface CreateCouponData {
  code: string;
  description?: string | null;
  campaignId?: string | null;
  discountType: string;
  discountValue: string;
  minPurchaseAmount?: string | null;
  maxDiscountAmount?: string | null;
  applicablePackageIds?: string[] | null;
  applicableAddOnIds?: string[] | null;
  maxTotalUses?: number | null;
  maxUsesPerUser?: number;
  validFrom?: Date | string | null;
  validUntil?: Date | string | null;
  isStackable?: boolean;
  referralUserId?: string | null;
  isActive?: boolean;
  metadata?: Record<string, unknown> | null;
}

interface UpdateCouponData {
  code?: string;
  description?: string | null;
  campaignId?: string | null;
  discountType?: string;
  discountValue?: string;
  minPurchaseAmount?: string | null;
  maxDiscountAmount?: string | null;
  applicablePackageIds?: string[] | null;
  applicableAddOnIds?: string[] | null;
  maxTotalUses?: number | null;
  maxUsesPerUser?: number;
  validFrom?: Date | string | null;
  validUntil?: Date | string | null;
  isStackable?: boolean;
  referralUserId?: string | null;
  isActive?: boolean;
  metadata?: Record<string, unknown> | null;
}

interface BulkCouponConfig {
  prefix: string;
  count: number;
  campaignId: string;
  discountType: string;
  discountValue: string;
  minPurchaseAmount?: string | null;
  maxDiscountAmount?: string | null;
  applicablePackageIds?: string[] | null;
  applicableAddOnIds?: string[] | null;
  maxTotalUses?: number | null;
  maxUsesPerUser?: number;
  validFrom?: Date | string | null;
  validUntil?: Date | string | null;
  isStackable?: boolean;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface ValidationResult {
  valid: boolean;
  coupon?: Coupon;
  error?: string;
  discountAmount?: number;
  discountedPrice?: number;
  /** For trial_extension type, the number of extra trial days */
  trialDaysExtension?: number;
}

interface CouponAnalyticsResult {
  couponId: string;
  code: string;
  totalRedemptions: number;
  totalDiscountGiven: number;
  uniqueUsers: number;
}

interface CampaignAnalyticsResult {
  campaignId: string;
  totalCoupons: number;
  activeCoupons: number;
  totalRedemptions: number;
  totalDiscountGiven: number;
  uniqueUsers: number;
  topPerformers: CouponAnalyticsResult[];
}

interface StackedDiscountResult {
  totalDiscount: number;
  finalPrice: number;
  breakdown: Array<{
    couponId: string;
    code: string;
    discountType: string;
    discountApplied: number;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────

const ALPHANUMERIC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omit ambiguous 0/O, 1/I

function generateCode(prefix: string, length = 8): string {
  const bytes = crypto.randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHANUMERIC[bytes[i] % ALPHANUMERIC.length];
  }
  return `${prefix.toUpperCase()}-${code}`;
}

/** Safe numeric parsing — returns 0 for null/undefined */
function num(value: string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Round to 2 decimal places to avoid floating-point drift */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Service ───────────────────────────────────────────────────

class CouponService {
  // ─── CRUD ─────────────────────────────────────────────────

  /**
   * List coupons with optional filters, ordered newest first.
   */
  async getCoupons(filters: CouponFilters = {}): Promise<{
    data: Coupon[];
    total: number;
  }> {
    const conditions: ReturnType<typeof eq>[] = [];

    if (filters.isActive !== undefined) {
      conditions.push(eq(coupons.isActive, filters.isActive));
    }
    if (filters.campaignId) {
      conditions.push(eq(coupons.campaignId, filters.campaignId));
    }
    if (filters.discountType) {
      conditions.push(eq(coupons.discountType, filters.discountType));
    }
    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          sql`${coupons.code} ILIKE ${term}`,
          sql`${coupons.description} ILIKE ${term}`,
        )!,
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await db
      .select({ total: count() })
      .from(coupons)
      .where(where);

    const data = await db
      .select()
      .from(coupons)
      .where(where)
      .orderBy(desc(coupons.createdAt))
      .limit(filters.limit ?? 50)
      .offset(filters.offset ?? 0);

    return { data, total: totalRow?.total ?? 0 };
  }

  /**
   * Get a single coupon by ID, enriched with usage stats.
   */
  async getCoupon(
    id: string,
  ): Promise<
    | (Coupon & { usageStats: { totalUses: number; uniqueUsers: number } })
    | undefined
  > {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.id, id));
    if (!coupon) return undefined;

    const [stats] = await db
      .select({
        totalUses: count(),
        uniqueUsers: sql<number>`count(distinct ${couponUsage.userId})`,
      })
      .from(couponUsage)
      .where(eq(couponUsage.couponId, id));

    return {
      ...coupon,
      usageStats: {
        totalUses: stats?.totalUses ?? 0,
        uniqueUsers: Number(stats?.uniqueUsers ?? 0),
      },
    };
  }

  /**
   * Lookup a coupon by its unique code (case-insensitive).
   */
  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [coupon] = await db
      .select()
      .from(coupons)
      .where(sql`UPPER(${coupons.code}) = UPPER(${code})`);
    return coupon ?? undefined;
  }

  /**
   * Create a new coupon. Returns the inserted row.
   */
  async createCoupon(data: CreateCouponData): Promise<Coupon> {
    const [coupon] = await db
      .insert(coupons)
      .values({
        code: data.code.toUpperCase().trim(),
        description: data.description ?? null,
        campaignId: data.campaignId ?? null,
        discountType: data.discountType,
        discountValue: data.discountValue,
        minPurchaseAmount: data.minPurchaseAmount ?? null,
        maxDiscountAmount: data.maxDiscountAmount ?? null,
        applicablePackageIds: data.applicablePackageIds ?? null,
        applicableAddOnIds: data.applicableAddOnIds ?? null,
        maxTotalUses: data.maxTotalUses ?? null,
        maxUsesPerUser: data.maxUsesPerUser ?? 1,
        validFrom: data.validFrom ? new Date(data.validFrom as string) : null,
        validUntil: data.validUntil
          ? new Date(data.validUntil as string)
          : null,
        isStackable: data.isStackable ?? false,
        referralUserId: data.referralUserId ?? null,
        isActive: data.isActive ?? true,
        metadata: data.metadata ?? null,
      })
      ;
    return coupon;
  }

  /**
   * Update an existing coupon. Returns the updated row or undefined.
   */
  async updateCoupon(
    id: string,
    data: UpdateCouponData,
  ): Promise<Coupon | undefined> {
    // Build only the fields that are explicitly provided
    const values: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.code !== undefined) values.code = data.code.toUpperCase().trim();
    if (data.description !== undefined) values.description = data.description;
    if (data.campaignId !== undefined) values.campaignId = data.campaignId;
    if (data.discountType !== undefined)
      values.discountType = data.discountType;
    if (data.discountValue !== undefined)
      values.discountValue = data.discountValue;
    if (data.minPurchaseAmount !== undefined)
      values.minPurchaseAmount = data.minPurchaseAmount;
    if (data.maxDiscountAmount !== undefined)
      values.maxDiscountAmount = data.maxDiscountAmount;
    if (data.applicablePackageIds !== undefined)
      values.applicablePackageIds = data.applicablePackageIds;
    if (data.applicableAddOnIds !== undefined)
      values.applicableAddOnIds = data.applicableAddOnIds;
    if (data.maxTotalUses !== undefined)
      values.maxTotalUses = data.maxTotalUses;
    if (data.maxUsesPerUser !== undefined)
      values.maxUsesPerUser = data.maxUsesPerUser;
    if (data.validFrom !== undefined)
      values.validFrom = data.validFrom
        ? new Date(data.validFrom as string)
        : null;
    if (data.validUntil !== undefined)
      values.validUntil = data.validUntil
        ? new Date(data.validUntil as string)
        : null;
    if (data.isStackable !== undefined) values.isStackable = data.isStackable;
    if (data.referralUserId !== undefined)
      values.referralUserId = data.referralUserId;
    if (data.isActive !== undefined) values.isActive = data.isActive;
    if (data.metadata !== undefined) values.metadata = data.metadata;

    const [updated] = await db
      .update(coupons)
      .set(values)
      .where(eq(coupons.id, id))
      ;

    return updated ?? undefined;
  }

  /**
   * Soft-delete a coupon by marking isActive = false.
   */
  async deleteCoupon(id: string): Promise<Coupon | undefined> {
    const [updated] = await db
      .update(coupons)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(coupons.id, id))
      ;
    return updated ?? undefined;
  }

  // ─── Bulk Generation ──────────────────────────────────────

  /**
   * Generate N unique coupon codes under a single campaignId.
   * Inserts in batches of 100 for performance.
   * Returns the campaignId, count generated, and a sample of codes.
   */
  async generateBulkCoupons(config: BulkCouponConfig): Promise<{
    campaignId: string;
    codesGenerated: number;
    sampleCodes: string[];
  }> {
    const {
      prefix,
      count: total,
      campaignId,
      discountType,
      discountValue,
      minPurchaseAmount,
      maxDiscountAmount,
      applicablePackageIds,
      applicableAddOnIds,
      maxTotalUses,
      maxUsesPerUser,
      validFrom,
      validUntil,
      isStackable,
      description,
      metadata,
    } = config;

    if (total <= 0 || total > 100_000) {
      throw new Error("Bulk generation count must be between 1 and 100,000");
    }

    // Generate unique codes — use a Set to prevent duplicates within batch
    const codes = new Set<string>();
    let attempts = 0;
    const maxAttempts = total * 3; // safety valve
    while (codes.size < total && attempts < maxAttempts) {
      codes.add(generateCode(prefix));
      attempts++;
    }
    if (codes.size < total) {
      throw new Error(
        `Could not generate ${total} unique codes after ${maxAttempts} attempts`,
      );
    }

    const allCodes = Array.from(codes);
    const BATCH_SIZE = 100;

    for (let i = 0; i < allCodes.length; i += BATCH_SIZE) {
      const batch = allCodes.slice(i, i + BATCH_SIZE);
      const rows = batch.map((code) => ({
        code,
        description: description ?? null,
        campaignId,
        discountType,
        discountValue,
        minPurchaseAmount: minPurchaseAmount ?? null,
        maxDiscountAmount: maxDiscountAmount ?? null,
        applicablePackageIds: applicablePackageIds ?? null,
        applicableAddOnIds: applicableAddOnIds ?? null,
        maxTotalUses: maxTotalUses ?? null,
        maxUsesPerUser: maxUsesPerUser ?? 1,
        validFrom: validFrom ? new Date(validFrom as string) : null,
        validUntil: validUntil ? new Date(validUntil as string) : null,
        isStackable: isStackable ?? false,
        isActive: true,
        metadata: metadata ?? null,
      }));

      await db.insert(coupons).values(rows);
    }

    return {
      campaignId,
      codesGenerated: allCodes.length,
      sampleCodes: allCodes.slice(0, Math.min(10, allCodes.length)),
    };
  }

  // ─── Validation Engine ────────────────────────────────────

  /**
   * Real-time validation of a coupon code for a specific user and
   * optionally a specific package / add-on.
   *
   * Returns validity status and, when valid, the calculated discount.
   */
  async validateCoupon(
    code: string,
    userId: string,
    packageId?: string,
    addOnId?: string,
  ): Promise<ValidationResult> {
    // 1. Lookup coupon (case-insensitive)
    const coupon = await this.getCouponByCode(code);
    if (!coupon) {
      return { valid: false, error: "Coupon code not found" };
    }

    // 2. Active check
    if (!coupon.isActive) {
      return { valid: false, error: "This coupon is no longer active" };
    }

    // 3. Date range check
    const now = new Date();
    if (coupon.validFrom && now < new Date(coupon.validFrom)) {
      return { valid: false, error: "This coupon is not yet valid" };
    }
    if (coupon.validUntil && now > new Date(coupon.validUntil)) {
      return { valid: false, error: "This coupon has expired" };
    }

    // 4. Total usage limit
    if (
      coupon.maxTotalUses !== null &&
      coupon.currentUseCount >= coupon.maxTotalUses
    ) {
      return {
        valid: false,
        error: "This coupon has reached its maximum number of uses",
      };
    }

    // 5. Per-user usage limit
    const [userUsage] = await db
      .select({ uses: count() })
      .from(couponUsage)
      .where(
        and(
          eq(couponUsage.couponId, coupon.id),
          eq(couponUsage.userId, userId),
        ),
      );

    if ((userUsage?.uses ?? 0) >= coupon.maxUsesPerUser) {
      return {
        valid: false,
        error: "You have already used this coupon the maximum number of times",
      };
    }

    // 6. Package compatibility
    if (packageId && coupon.applicablePackageIds) {
      const allowedPkgs = coupon.applicablePackageIds as string[];
      if (Array.isArray(allowedPkgs) && !allowedPkgs.includes(packageId)) {
        return {
          valid: false,
          error: "This coupon is not valid for the selected package",
        };
      }
    }

    // 7. Add-on compatibility
    if (addOnId && coupon.applicableAddOnIds) {
      const allowedAddOns = coupon.applicableAddOnIds as string[];
      if (Array.isArray(allowedAddOns) && !allowedAddOns.includes(addOnId)) {
        return {
          valid: false,
          error: "This coupon is not valid for the selected add-on",
        };
      }
    }

    // 8. Determine the base price for discount calculation
    let basePrice = 0;

    if (packageId) {
      // Find the cheapest active price for the package (as the "standard" price)
      const [priceRow] = await db
        .select({ price: packagePrices.price })
        .from(packagePrices)
        .where(
          and(
            eq(packagePrices.packageId, packageId),
            eq(packagePrices.isActive, true),
          ),
        )
        .orderBy(packagePrices.price)
        .limit(1);

      if (priceRow) basePrice = num(priceRow.price);
    }

    if (addOnId) {
      const [addon] = await db
        .select({ price: addOns.price })
        .from(addOns)
        .where(eq(addOns.id, addOnId));

      if (addon) basePrice += num(addon.price);
    }

    // 9. Minimum purchase check
    if (coupon.minPurchaseAmount && basePrice < num(coupon.minPurchaseAmount)) {
      return {
        valid: false,
        error: `Minimum purchase amount of ${coupon.minPurchaseAmount} is required`,
      };
    }

    // 10. Calculate discount
    const discountValue = num(coupon.discountValue);

    if (coupon.discountType === "trial_extension") {
      // Trial extension doesn't reduce price — it adds days
      return {
        valid: true,
        coupon,
        discountAmount: 0,
        discountedPrice: basePrice,
        trialDaysExtension: Math.floor(discountValue),
      };
    }

    let discountAmount: number;

    if (coupon.discountType === "percentage") {
      discountAmount = round2((basePrice * discountValue) / 100);
      // Apply max discount cap
      if (coupon.maxDiscountAmount) {
        const cap = num(coupon.maxDiscountAmount);
        if (discountAmount > cap) discountAmount = cap;
      }
    } else if (coupon.discountType === "fixed_amount") {
      discountAmount = discountValue;
    } else {
      return {
        valid: false,
        error: `Unknown discount type: ${coupon.discountType}`,
      };
    }

    // Never let discount exceed the price
    discountAmount = round2(Math.min(discountAmount, basePrice));
    const discountedPrice = round2(Math.max(basePrice - discountAmount, 0));

    return {
      valid: true,
      coupon,
      discountAmount,
      discountedPrice,
    };
  }

  // ─── Redemption ───────────────────────────────────────────

  /**
   * Record coupon usage and atomically increment currentUseCount.
   *
   * Idempotent — will not double-count for the same (couponId, userId, subscriptionId).
   * Returns the couponUsage record on success, or null if already redeemed
   * for this subscription.
   */
  async redeemCoupon(
    couponId: string,
    userId: string,
    subscriptionId: string,
    amount: number,
  ): Promise<CouponUsage | null> {
    // Idempotency check: already redeemed for this subscription?
    const [existing] = await db
      .select({ id: couponUsage.id })
      .from(couponUsage)
      .where(
        and(
          eq(couponUsage.couponId, couponId),
          eq(couponUsage.userId, userId),
          eq(couponUsage.subscriptionId, subscriptionId),
        ),
      );

    if (existing) {
      return null; // already redeemed
    }

    // Atomically increment currentUseCount and verify the coupon is still
    // redeemable in a single UPDATE ... WHERE to prevent race conditions.
    // The WHERE clause ensures we only increment if the coupon hasn't
    // exceeded its total use limit.
    const [updated] = await db
      .update(coupons)
      .set({
        currentUseCount: sql`${coupons.currentUseCount} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(coupons.id, couponId),
          eq(coupons.isActive, true),
          or(
            isNull(coupons.maxTotalUses),
            sql`${coupons.currentUseCount} < ${coupons.maxTotalUses}`,
          ),
        ),
      )
      .returning({ id: coupons.id });

    if (!updated) {
      throw new Error(
        "Coupon redemption failed: coupon is inactive or has reached its usage limit",
      );
    }

    // Record the usage
    const [usage] = await db
      .insert(couponUsage)
      .values({
        couponId,
        userId,
        subscriptionId,
        discountApplied: String(round2(amount)),
      })
      ;

    return usage;
  }

  // ─── Analytics ────────────────────────────────────────────

  /**
   * Get analytics for a single coupon or all coupons.
   * When couponId is omitted, returns top performers across the board.
   */
  async getCouponAnalytics(
    couponId?: string,
  ): Promise<CouponAnalyticsResult[]> {
    const conditions = couponId
      ? eq(couponUsage.couponId, couponId)
      : undefined;

    const rows = await db
      .select({
        couponId: couponUsage.couponId,
        code: coupons.code,
        totalRedemptions: count(),
        totalDiscountGiven: sql<number>`coalesce(sum(${couponUsage.discountApplied}::numeric), 0)`,
        uniqueUsers: sql<number>`count(distinct ${couponUsage.userId})`,
      })
      .from(couponUsage)
      .innerJoin(coupons, eq(coupons.id, couponUsage.couponId))
      .where(conditions)
      .groupBy(couponUsage.couponId, coupons.code)
      .orderBy(desc(count()))
      .limit(100);

    return rows.map((r) => ({
      couponId: r.couponId,
      code: r.code,
      totalRedemptions: r.totalRedemptions,
      totalDiscountGiven: Number(r.totalDiscountGiven),
      uniqueUsers: Number(r.uniqueUsers),
    }));
  }

  /**
   * Aggregate analytics for all coupons in a campaign.
   */
  async getCampaignAnalytics(
    campaignId: string,
  ): Promise<CampaignAnalyticsResult> {
    // Count total and active coupons in campaign
    const [couponCounts] = await db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${coupons.isActive} = true)`,
      })
      .from(coupons)
      .where(eq(coupons.campaignId, campaignId));

    // Aggregate usage across all campaign coupons
    const [usageAgg] = await db
      .select({
        totalRedemptions: count(),
        totalDiscountGiven: sql<number>`coalesce(sum(${couponUsage.discountApplied}::numeric), 0)`,
        uniqueUsers: sql<number>`count(distinct ${couponUsage.userId})`,
      })
      .from(couponUsage)
      .innerJoin(coupons, eq(coupons.id, couponUsage.couponId))
      .where(eq(coupons.campaignId, campaignId));

    // Top 10 performers in the campaign
    const topPerformers = await db
      .select({
        couponId: couponUsage.couponId,
        code: coupons.code,
        totalRedemptions: count(),
        totalDiscountGiven: sql<number>`coalesce(sum(${couponUsage.discountApplied}::numeric), 0)`,
        uniqueUsers: sql<number>`count(distinct ${couponUsage.userId})`,
      })
      .from(couponUsage)
      .innerJoin(coupons, eq(coupons.id, couponUsage.couponId))
      .where(eq(coupons.campaignId, campaignId))
      .groupBy(couponUsage.couponId, coupons.code)
      .orderBy(desc(count()))
      .limit(10);

    return {
      campaignId,
      totalCoupons: couponCounts?.total ?? 0,
      activeCoupons: Number(couponCounts?.active ?? 0),
      totalRedemptions: usageAgg?.totalRedemptions ?? 0,
      totalDiscountGiven: Number(usageAgg?.totalDiscountGiven ?? 0),
      uniqueUsers: Number(usageAgg?.uniqueUsers ?? 0),
      topPerformers: topPerformers.map((r) => ({
        couponId: r.couponId,
        code: r.code,
        totalRedemptions: r.totalRedemptions,
        totalDiscountGiven: Number(r.totalDiscountGiven),
        uniqueUsers: Number(r.uniqueUsers),
      })),
    };
  }

  /**
   * Get all coupons a specific user has redeemed.
   */
  async getCouponUsageByUser(
    userId: string,
  ): Promise<(CouponUsage & { coupon: Coupon })[]> {
    const rows = await db
      .select({
        usage: couponUsage,
        coupon: coupons,
      })
      .from(couponUsage)
      .innerJoin(coupons, eq(coupons.id, couponUsage.couponId))
      .where(eq(couponUsage.userId, userId))
      .orderBy(desc(couponUsage.usedAt));

    return rows.map((r) => ({
      ...r.usage,
      coupon: r.coupon,
    }));
  }

  // ─── Stacking Rules ───────────────────────────────────────

  /**
   * Check whether two coupons can be stacked (combined).
   * Both must have isStackable = true.
   */
  async canStackWith(
    couponId: string,
    otherCouponId: string,
  ): Promise<{ canStack: boolean; reason?: string }> {
    if (couponId === otherCouponId) {
      return { canStack: false, reason: "Cannot stack a coupon with itself" };
    }

    const results = await db
      .select({
        id: coupons.id,
        code: coupons.code,
        isStackable: coupons.isStackable,
        isActive: coupons.isActive,
        discountType: coupons.discountType,
      })
      .from(coupons)
      .where(inArray(coupons.id, [couponId, otherCouponId]));

    if (results.length < 2) {
      return { canStack: false, reason: "One or both coupons not found" };
    }

    const couponA = results.find((c) => c.id === couponId)!;
    const couponB = results.find((c) => c.id === otherCouponId)!;

    if (!couponA.isActive || !couponB.isActive) {
      return { canStack: false, reason: "One or both coupons are inactive" };
    }

    if (!couponA.isStackable) {
      return {
        canStack: false,
        reason: `Coupon ${couponA.code} is not stackable`,
      };
    }

    if (!couponB.isStackable) {
      return {
        canStack: false,
        reason: `Coupon ${couponB.code} is not stackable`,
      };
    }

    // Business rule: disallow stacking two percentage coupons to prevent
    // over-discounting beyond 100%
    if (
      couponA.discountType === "percentage" &&
      couponB.discountType === "percentage"
    ) {
      return {
        canStack: false,
        reason: "Cannot stack two percentage-based coupons",
      };
    }

    return { canStack: true };
  }

  /**
   * Calculate the combined discount when stacking multiple coupons.
   *
   * Application order:
   * 1. Percentage discounts first (applied to original base price, capped)
   * 2. Fixed amount discounts second (subtracted from remaining price)
   * 3. Trial extensions collected and reported but do not affect price
   *
   * Total discount is capped at the base price (final price >= 0).
   */
  async calculateStackedDiscount(
    couponIds: string[],
    basePrice: number,
  ): Promise<StackedDiscountResult> {
    if (couponIds.length === 0) {
      return { totalDiscount: 0, finalPrice: basePrice, breakdown: [] };
    }

    // Deduplicate
    const uniqueIds = [...new Set(couponIds)];

    // Verify all are stackable (or only one coupon)
    if (uniqueIds.length > 1) {
      for (let i = 0; i < uniqueIds.length; i++) {
        for (let j = i + 1; j < uniqueIds.length; j++) {
          const result = await this.canStackWith(uniqueIds[i], uniqueIds[j]);
          if (!result.canStack) {
            throw new Error(`Cannot stack coupons: ${result.reason}`);
          }
        }
      }
    }

    // Fetch all coupons
    const couponRows = await db
      .select()
      .from(coupons)
      .where(inArray(coupons.id, uniqueIds));

    if (couponRows.length !== uniqueIds.length) {
      throw new Error("One or more coupons not found");
    }

    // Separate by type for ordered application
    const percentageCoupons = couponRows.filter(
      (c) => c.discountType === "percentage",
    );
    const fixedCoupons = couponRows.filter(
      (c) => c.discountType === "fixed_amount",
    );
    const trialCoupons = couponRows.filter(
      (c) => c.discountType === "trial_extension",
    );

    const breakdown: StackedDiscountResult["breakdown"] = [];
    let runningPrice = basePrice;

    // 1. Apply percentage discounts to the original base price
    for (const c of percentageCoupons) {
      let discountApplied = round2((basePrice * num(c.discountValue)) / 100);
      if (c.maxDiscountAmount) {
        discountApplied = Math.min(discountApplied, num(c.maxDiscountAmount));
      }
      discountApplied = round2(Math.min(discountApplied, runningPrice));
      runningPrice = round2(runningPrice - discountApplied);

      breakdown.push({
        couponId: c.id,
        code: c.code,
        discountType: c.discountType,
        discountApplied,
      });
    }

    // 2. Apply fixed amount discounts
    for (const c of fixedCoupons) {
      let discountApplied = round2(
        Math.min(num(c.discountValue), runningPrice),
      );
      runningPrice = round2(runningPrice - discountApplied);

      breakdown.push({
        couponId: c.id,
        code: c.code,
        discountType: c.discountType,
        discountApplied,
      });
    }

    // 3. Trial extensions — 0 monetary discount, but recorded
    for (const c of trialCoupons) {
      breakdown.push({
        couponId: c.id,
        code: c.code,
        discountType: c.discountType,
        discountApplied: 0,
      });
    }

    const totalDiscount = round2(basePrice - runningPrice);
    const finalPrice = round2(Math.max(runningPrice, 0));

    return { totalDiscount, finalPrice, breakdown };
  }
}

export const couponService = new CouponService();
