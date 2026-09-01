import crypto from "crypto";
import { logger } from "../lib/logger";
import { isSubscriptionActive } from "../lib/subscription-status";
import {
  subscriptionPackages,
  packagePrices,
  packageFeatures,
  subscriptions,
  invoices,
  invoiceLineItems,
  subscriptionAuditLogs,
  users,
  type SubscriptionPackage,
  type PackagePrice,
  type PackageFeature,
  type Subscription,
  type Invoice,
  type InvoiceLineItem,
  type SubscriptionAuditLog,
} from "../../shared/schema";
import { db, isMysql } from "../db";
import { eq, and, desc, sql, count, gt, lte, inArray, or } from "drizzle-orm";

import {
  CANONICAL_BILLING_CYCLE_DAYS,
  normalizeSubscriptionPlan,
} from "../../shared/pricing-contracts";

// ── Billing-cycle duration map (in days) ──────────────────────
const BILLING_CYCLE_DAYS: Record<string, number> = CANONICAL_BILLING_CYCLE_DAYS;

// ── Dunning retry intervals (in days after last failure) ──────
const DUNNING_RETRY_INTERVALS = [1, 3, 5, 7];
const MAX_PAYMENT_RETRIES = DUNNING_RETRY_INTERVALS.length;

/**
 * Helper: get the number of days for a billing cycle, taking custom duration
 * into account when billingCycle === "custom".
 */
function cycleDays(
  billingCycle: string,
  customDurationDays?: number | null,
): number {
  if (
    billingCycle === "custom" &&
    customDurationDays &&
    customDurationDays > 0
  ) {
    return customDurationDays;
  }
  return BILLING_CYCLE_DAYS[billingCycle] ?? 30;
}

/**
 * Helper: add days to a Date, returning a new Date.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ══════════════════════════════════════════════════════════════════
// ══  SUBSCRIPTION SERVICE                                      ══
// ══════════════════════════════════════════════════════════════════

class SubscriptionService {
  // ──────────────────────────────────────────────────────────────
  // 1. Package Management (Admin CRUD)
  // ──────────────────────────────────────────────────────────────

  async getPackages(filters?: {
    status?: string;
  }): Promise<SubscriptionPackage[]> {
    try {
      if (filters?.status) {
        return await db
          .select()
          .from(subscriptionPackages)
          .where(eq(subscriptionPackages.status, filters.status))
          .orderBy(subscriptionPackages.displayOrder);
      }
      return await db
        .select()
        .from(subscriptionPackages)
        .orderBy(subscriptionPackages.displayOrder);
    } catch (error) {
      logger.error("SubscriptionService getPackages error", {
        error: String(error),
      });
      throw error;
    }
  }

  async getPackage(id: string): Promise<
    | (SubscriptionPackage & {
        prices: PackagePrice[];
        features: PackageFeature[];
      })
    | undefined
  > {
    try {
      const [pkg] = await db
        .select()
        .from(subscriptionPackages)
        .where(eq(subscriptionPackages.id, id));
      if (!pkg) return undefined;

      const prices = await db
        .select()
        .from(packagePrices)
        .where(eq(packagePrices.packageId, id))
        .orderBy(packagePrices.billingCycle);

      const features = await db
        .select()
        .from(packageFeatures)
        .where(eq(packageFeatures.packageId, id))
        .orderBy(packageFeatures.displayOrder);

      return { ...pkg, prices, features };
    } catch (error) {
      logger.error("SubscriptionService getPackage error", {
        error: String(error),
      });
      throw error;
    }
  }

  async createPackage(
    data: Omit<
      SubscriptionPackage,
      "id" | "createdAt" | "updatedAt" | "version"
    >,
  ): Promise<SubscriptionPackage> {
    try {
      const id = crypto.randomUUID();
      const insertData = { id, ...data, version: 1 };
      if (isMysql) {
        await db.insert(subscriptionPackages).values(insertData);
        const [pkg] = await db
          .select()
          .from(subscriptionPackages)
          .where(eq(subscriptionPackages.id, id));
        return pkg!;
      }
      const [pkg] = await db
        .insert(subscriptionPackages)
        .values(insertData)
        .returning();
      return pkg;
    } catch (error) {
      logger.error("SubscriptionService createPackage error", {
        error: String(error),
      });
      throw error;
    }
  }

  async updatePackage(
    id: string,
    data: Partial<Omit<SubscriptionPackage, "id" | "createdAt">>,
  ): Promise<SubscriptionPackage | undefined> {
    try {
      // Check if pricing-related fields are changing — if so, bump version
      const [existing] = await db
        .select()
        .from(subscriptionPackages)
        .where(eq(subscriptionPackages.id, id));
      if (!existing) return undefined;

      const pricingFieldsChanged =
        data.trialDays !== undefined || data.gracePeriodDays !== undefined;

      const updateData: Record<string, unknown> = {
        ...data,
        updatedAt: new Date(),
      };

      if (pricingFieldsChanged) {
        updateData.version = existing.version + 1;
      }

      if (isMysql) {
        await db
          .update(subscriptionPackages)
          .set(updateData)
          .where(eq(subscriptionPackages.id, id));
        const [updated] = await db
          .select()
          .from(subscriptionPackages)
          .where(eq(subscriptionPackages.id, id));
        return updated || undefined;
      }

      const [updated] = await db
        .update(subscriptionPackages)
        .set(updateData)
        .where(eq(subscriptionPackages.id, id))
        .returning();
      return updated || undefined;
    } catch (error) {
      logger.error("SubscriptionService updatePackage error", {
        error: String(error),
      });
      throw error;
    }
  }

  async deletePackage(id: string): Promise<SubscriptionPackage | undefined> {
    try {
      if (isMysql) {
        await db
          .update(subscriptionPackages)
          .set({ status: "archived", updatedAt: new Date() })
          .where(eq(subscriptionPackages.id, id));
        const [updated] = await db
          .select()
          .from(subscriptionPackages)
          .where(eq(subscriptionPackages.id, id));
        return updated || undefined;
      }
      const [updated] = await db
        .update(subscriptionPackages)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(subscriptionPackages.id, id))
        .returning();
      return updated || undefined;
    } catch (error) {
      logger.error("SubscriptionService deletePackage error", {
        error: String(error),
      });
      throw error;
    }
  }

  async getPackageComparison(): Promise<
    (SubscriptionPackage & {
      prices: PackagePrice[];
      features: PackageFeature[];
    })[]
  > {
    try {
      const activePkgs = await db
        .select()
        .from(subscriptionPackages)
        .where(eq(subscriptionPackages.status, "active"))
        .orderBy(subscriptionPackages.displayOrder);

      if (activePkgs.length === 0) return [];

      const pkgIds = activePkgs.map((p: any) => p.id);

      const allPrices = await db
        .select()
        .from(packagePrices)
        .where(
          and(
            inArray(packagePrices.packageId, pkgIds),
            eq(packagePrices.isActive, true),
          ),
        );

      const allFeatures = await db
        .select()
        .from(packageFeatures)
        .where(inArray(packageFeatures.packageId, pkgIds))
        .orderBy(packageFeatures.displayOrder);

      return activePkgs.map((pkg: any) => ({
        ...pkg,
        prices: allPrices.filter((p: any) => p.packageId === pkg.id),
        features: allFeatures.filter((f: any) => f.packageId === pkg.id),
      }));
    } catch (error) {
      logger.error("SubscriptionService getPackageComparison error", {
        error: String(error),
      });
      throw error;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 2. Price Management
  // ──────────────────────────────────────────────────────────────

  async createPrice(
    data: Omit<PackagePrice, "id" | "createdAt" | "updatedAt">,
  ): Promise<PackagePrice> {
    try {
      // Set packageVersion from current package version
      const [pkg] = await db
        .select()
        .from(subscriptionPackages)
        .where(eq(subscriptionPackages.id, data.packageId));

      const id = crypto.randomUUID();
      const insertData = {
        id,
        ...data,
        packageVersion: pkg ? pkg.version : 1,
      };

      let price: PackagePrice;
      if (isMysql) {
        await db.insert(packagePrices).values(insertData);
        const [p] = await db
          .select()
          .from(packagePrices)
          .where(eq(packagePrices.id, id));
        price = p!;
      } else {
        const [p] = await db
          .insert(packagePrices)
          .values(insertData)
          .returning();
        price = p!;
      }

      // Bump package version since pricing changed
      if (pkg) {
        await db
          .update(subscriptionPackages)
          .set({ version: pkg.version + 1, updatedAt: new Date() })
          .where(eq(subscriptionPackages.id, data.packageId));
      }

      return price;
    } catch (error) {
      logger.error("SubscriptionService createPrice error", {
        error: String(error),
      });
      throw error;
    }
  }

  async updatePrice(
    id: string,
    data: Partial<Omit<PackagePrice, "id" | "createdAt">>,
  ): Promise<PackagePrice | undefined> {
    try {
      if (isMysql) {
        await db
          .update(packagePrices)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(packagePrices.id, id));
        const [updated] = await db
          .select()
          .from(packagePrices)
          .where(eq(packagePrices.id, id));
        return updated || undefined;
      }
      const [updated] = await db
        .update(packagePrices)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(packagePrices.id, id))
        .returning();
      return updated || undefined;
    } catch (error) {
      logger.error("SubscriptionService updatePrice error", {
        error: String(error),
      });
      throw error;
    }
  }

  async deletePrice(id: string): Promise<void> {
    try {
      await db.delete(packagePrices).where(eq(packagePrices.id, id));
    } catch (error) {
      logger.error("SubscriptionService deletePrice error", {
        error: String(error),
      });
      throw error;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 3. Feature Management
  // ──────────────────────────────────────────────────────────────

  async createFeature(
    data: Omit<PackageFeature, "id" | "createdAt">,
  ): Promise<PackageFeature> {
    try {
      const id = crypto.randomUUID();
      const insertData = { id, ...data };
      if (isMysql) {
        await db.insert(packageFeatures).values(insertData);
        const [feature] = await db
          .select()
          .from(packageFeatures)
          .where(eq(packageFeatures.id, id));
        return feature!;
      }
      const [feature] = await db
        .insert(packageFeatures)
        .values(insertData)
        .returning();
      return feature!;
    } catch (error) {
      logger.error("SubscriptionService createFeature error", {
        error: String(error),
      });
      throw error;
    }
  }

  async updateFeature(
    id: string,
    data: Partial<Omit<PackageFeature, "id" | "createdAt">>,
  ): Promise<PackageFeature | undefined> {
    try {
      if (isMysql) {
        await db
          .update(packageFeatures)
          .set(data)
          .where(eq(packageFeatures.id, id));
        const [updated] = await db
          .select()
          .from(packageFeatures)
          .where(eq(packageFeatures.id, id));
        return updated || undefined;
      }
      const [updated] = await db
        .update(packageFeatures)
        .set(data)
        .where(eq(packageFeatures.id, id))
        .returning();
      return updated || undefined;
    } catch (error) {
      logger.error("SubscriptionService updateFeature error", {
        error: String(error),
      });
      throw error;
    }
  }

  async deleteFeature(id: string): Promise<void> {
    try {
      await db.delete(packageFeatures).where(eq(packageFeatures.id, id));
    } catch (error) {
      logger.error("SubscriptionService deleteFeature error", {
        error: String(error),
      });
      throw error;
    }
  }

  async getFeaturesByPackage(packageId: string): Promise<PackageFeature[]> {
    try {
      return await db
        .select()
        .from(packageFeatures)
        .where(eq(packageFeatures.packageId, packageId))
        .orderBy(packageFeatures.displayOrder);
    } catch (error) {
      logger.error("SubscriptionService getFeaturesByPackage error", {
        error: String(error),
      });
      throw error;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 4. Subscription Lifecycle
  // ──────────────────────────────────────────────────────────────

  async createSubscription(
    userId: string,
    packageId: string,
    priceId: string,
    options?: {
      couponId?: string;
      discountAmount?: string;
      externalSubscriptionId?: string;
      paymentGateway?: string;
      performedBy?: string;
      source?: string;
      durationDaysOverride?: number | null;
    },
  ): Promise<Subscription> {
    try {
      // Fetch package and price details
      const [pkg] = await db
        .select()
        .from(subscriptionPackages)
        .where(eq(subscriptionPackages.id, packageId));
      if (!pkg) throw new Error(`Package ${packageId} not found`);

      const [price] = await db
        .select()
        .from(packagePrices)
        .where(eq(packagePrices.id, priceId));
      if (!price) throw new Error(`Price ${priceId} not found`);

      // Check max subscribers
      if (pkg.maxSubscribers > 0) {
        const [subCount] = await db
          .select({ total: count() })
          .from(subscriptions)
          .where(
            and(
              eq(subscriptions.packageId, packageId),
              inArray(subscriptions.status, [
                "trialing",
                "active",
                "past_due",
                "paused",
              ]),
            ),
          );
        if (Number(subCount?.total ?? 0) >= pkg.maxSubscribers) {
          throw new Error(
            `Package ${pkg.name} has reached its subscriber limit`,
          );
        }
      }

      const now = new Date();
      const hasTrial = pkg.trialDays > 0;
      const status = hasTrial ? "trialing" : "active";

      const trialStartAt = hasTrial ? now : null;
      const trialEndAt = hasTrial ? addDays(now, pkg.trialDays) : null;
      const activatedAt = hasTrial ? null : now;

      const days =
        options?.durationDaysOverride && options.durationDaysOverride > 0
          ? options.durationDaysOverride
          : cycleDays(price.billingCycle, price.customDurationDays);
      const periodStart = hasTrial ? addDays(now, pkg.trialDays) : now;
      const periodEnd = addDays(periodStart, days);

      const subId = crypto.randomUUID();
      const subValues = {
        id: subId,
        userId,
        packageId,
        priceId,
        status,
        trialStartAt,
        trialEndAt,
        activatedAt,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        billingCycle: price.billingCycle,
        priceAtPurchase: price.price,
        currency: price.currency,
        couponId: options?.couponId || null,
        discountAmount: options?.discountAmount || null,
        externalSubscriptionId: options?.externalSubscriptionId || null,
        paymentGateway: options?.paymentGateway || "revenuecat",
        packageVersionAtPurchase: pkg.version,
      };

      let sub: Subscription;
      if (isMysql) {
        await db.insert(subscriptions).values(subValues);
        const [insertedSub] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, subId));
        sub = insertedSub!;
      } else {
        const [insertedSub] = await db
          .insert(subscriptions)
          .values(subValues)
          .returning();
        sub = insertedSub!;
      }

      // Audit log
      await this.logSubscriptionEvent({
        subscriptionId: sub.id,
        userId,
        performedBy: options?.performedBy || null,
        action: "created",
        previousStatus: null,
        newStatus: status,
        details: {
          packageName: pkg.name,
          billingCycle: price.billingCycle,
          priceAtPurchase: price.price,
          hasTrial,
          trialDays: pkg.trialDays,
        },
        source: options?.source || "api",
      });

      // Sync legacy user fields
      await this.syncUserSubscriptionFields(userId);

      return sub;
    } catch (error) {
      logger.error("SubscriptionService createSubscription error", {
        error: String(error),
      });
      throw error;
    }
  }

  async activateSubscription(subscriptionId: string): Promise<Subscription> {
    try {
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
      if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);

      const previousStatus = sub.status;
      const now = new Date();

      const setData = {
        status: "active" as const,
        activatedAt: now,
        failedPaymentCount: 0,
        lastPaymentFailedAt: null,
        nextRetryAt: null,
        updatedAt: now,
      };

      let updated: Subscription;
      if (isMysql) {
        await db
          .update(subscriptions)
          .set(setData)
          .where(eq(subscriptions.id, subscriptionId));
        const [s] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, subscriptionId));
        updated = s!;
      } else {
        const [s] = await db
          .update(subscriptions)
          .set(setData)
          .where(eq(subscriptions.id, subscriptionId))
          .returning();
        updated = s!;
      }

      await this.logSubscriptionEvent({
        subscriptionId,
        userId: sub.userId,
        action: "activated",
        previousStatus,
        newStatus: "active",
        source: "system",
      });

      await this.syncUserSubscriptionFields(sub.userId);
      return updated;
    } catch (error) {
      logger.error("SubscriptionService activateSubscription error", {
        error: String(error),
      });
      throw error;
    }
  }

  async renewSubscription(subscriptionId: string): Promise<Subscription> {
    try {
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
      if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);

      // Fetch the price to get customDurationDays for custom cycles
      let customDurationDays: number | null = null;
      if (sub.priceId) {
        const [price] = await db
          .select()
          .from(packagePrices)
          .where(eq(packagePrices.id, sub.priceId));
        if (price) customDurationDays = price.customDurationDays;
      }

      const now = new Date();
      const days = cycleDays(sub.billingCycle, customDurationDays);
      const newPeriodStart = sub.currentPeriodEnd || now;
      const newPeriodEnd = addDays(newPeriodStart, days);

      const setData = {
        status: "active" as const,
        currentPeriodStart: newPeriodStart,
        currentPeriodEnd: newPeriodEnd,
        failedPaymentCount: 0,
        lastPaymentFailedAt: null,
        nextRetryAt: null,
        updatedAt: now,
      };

      let updated: Subscription;
      if (isMysql) {
        await db
          .update(subscriptions)
          .set(setData)
          .where(eq(subscriptions.id, subscriptionId));
        const [s] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, subscriptionId));
        updated = s!;
      } else {
        const [s] = await db
          .update(subscriptions)
          .set(setData)
          .where(eq(subscriptions.id, subscriptionId))
          .returning();
        updated = s!;
      }

      await this.logSubscriptionEvent({
        subscriptionId,
        userId: sub.userId,
        action: "renewed",
        previousStatus: sub.status,
        newStatus: "active",
        details: {
          newPeriodStart: newPeriodStart.toISOString(),
          newPeriodEnd: newPeriodEnd.toISOString(),
        },
        source: "system",
      });

      await this.syncUserSubscriptionFields(sub.userId);
      return updated;
    } catch (error) {
      logger.error("SubscriptionService renewSubscription error", {
        error: String(error),
      });
      throw error;
    }
  }

  async upgradeSubscription(
    subscriptionId: string,
    newPackageId: string,
    newPriceId: string,
  ): Promise<{ subscription: Subscription; prorationAmount: number }> {
    try {
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
      if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);

      const [newPkg] = await db
        .select()
        .from(subscriptionPackages)
        .where(eq(subscriptionPackages.id, newPackageId));
      if (!newPkg) throw new Error(`Package ${newPackageId} not found`);

      const [newPrice] = await db
        .select()
        .from(packagePrices)
        .where(eq(packagePrices.id, newPriceId));
      if (!newPrice) throw new Error(`Price ${newPriceId} not found`);

      // Calculate proration (credit for unused time on current plan)
      const prorationAmount = this.calculateProration(
        sub,
        parseFloat(newPrice.price),
        newPrice.billingCycle,
      );

      const now = new Date();
      const days = cycleDays(
        newPrice.billingCycle,
        newPrice.customDurationDays,
      );

      const setData = {
        packageId: newPackageId,
        priceId: newPriceId,
        status: "active" as const,
        billingCycle: newPrice.billingCycle,
        priceAtPurchase: newPrice.price,
        currency: newPrice.currency,
        currentPeriodStart: now,
        currentPeriodEnd: addDays(now, days),
        packageVersionAtPurchase: newPkg.version,
        updatedAt: now,
      };

      let updated: Subscription;
      if (isMysql) {
        await db
          .update(subscriptions)
          .set(setData)
          .where(eq(subscriptions.id, subscriptionId));
        const [s] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, subscriptionId));
        updated = s!;
      } else {
        const [s] = await db
          .update(subscriptions)
          .set(setData)
          .where(eq(subscriptions.id, subscriptionId))
          .returning();
        updated = s!;
      }

      await this.logSubscriptionEvent({
        subscriptionId,
        userId: sub.userId,
        action: "upgraded",
        previousStatus: sub.status,
        newStatus: "active",
        details: {
          previousPackageId: sub.packageId,
          newPackageId,
          previousPriceId: sub.priceId,
          newPriceId,
          prorationAmount,
        },
        source: "api",
      });

      await this.syncUserSubscriptionFields(sub.userId);
      return { subscription: updated, prorationAmount };
    } catch (error) {
      logger.error("SubscriptionService upgradeSubscription error", {
        error: String(error),
      });
      throw error;
    }
  }

  async downgradeSubscription(
    subscriptionId: string,
    newPackageId: string,
    newPriceId: string,
  ): Promise<Subscription> {
    try {
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
      if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);

      const [newPkg] = await db
        .select()
        .from(subscriptionPackages)
        .where(eq(subscriptionPackages.id, newPackageId));
      if (!newPkg) throw new Error(`Package ${newPackageId} not found`);

      const [newPrice] = await db
        .select()
        .from(packagePrices)
        .where(eq(packagePrices.id, newPriceId));
      if (!newPrice) throw new Error(`Price ${newPriceId} not found`);

      const now = new Date();

      // Downgrade takes effect at end of current period — store the intent
      // in metadata so a cron job or renewal handler can apply it
      const setData = {
        metadata: {
          ...(sub.metadata as Record<string, unknown> | null),
          pendingDowngrade: {
            newPackageId,
            newPriceId,
            newBillingCycle: newPrice.billingCycle,
            newPrice: newPrice.price,
            newCurrency: newPrice.currency,
            newPackageVersion: newPkg.version,
            scheduledAt: sub.currentPeriodEnd?.toISOString(),
          },
        },
        updatedAt: now,
      };

      let updated: Subscription;
      if (isMysql) {
        await db
          .update(subscriptions)
          .set(setData)
          .where(eq(subscriptions.id, subscriptionId));
        const [s] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, subscriptionId));
        updated = s!;
      } else {
        const [s] = await db
          .update(subscriptions)
          .set(setData)
          .where(eq(subscriptions.id, subscriptionId))
          .returning();
        updated = s!;
      }

      await this.logSubscriptionEvent({
        subscriptionId,
        userId: sub.userId,
        action: "downgraded",
        previousStatus: sub.status,
        newStatus: sub.status, // no status change yet
        details: {
          previousPackageId: sub.packageId,
          newPackageId,
          newPriceId,
          effectiveAt: sub.currentPeriodEnd?.toISOString(),
          note: "Takes effect at period end",
        },
        source: "api",
      });

      return updated;
    } catch (error) {
      logger.error("SubscriptionService downgradeSubscription error", {
        error: String(error),
      });
      throw error;
    }
  }

  async pauseSubscription(subscriptionId: string): Promise<Subscription> {
    try {
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
      if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);

      const previousStatus = sub.status;
      const now = new Date();

      const setData = {
        status: "paused" as const,
        pausedAt: now,
        updatedAt: now,
      };

      let updated: Subscription;
      if (isMysql) {
        await db
          .update(subscriptions)
          .set(setData)
          .where(eq(subscriptions.id, subscriptionId));
        const [s] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, subscriptionId));
        updated = s!;
      } else {
        const [s] = await db
          .update(subscriptions)
          .set(setData)
          .where(eq(subscriptions.id, subscriptionId))
          .returning();
        updated = s!;
      }

      await this.logSubscriptionEvent({
        subscriptionId,
        userId: sub.userId,
        action: "paused",
        previousStatus,
        newStatus: "paused",
        source: "api",
      });

      await this.syncUserSubscriptionFields(sub.userId);
      return updated;
    } catch (error) {
      logger.error("SubscriptionService pauseSubscription error", {
        error: String(error),
      });
      throw error;
    }
  }

  async resumeSubscription(subscriptionId: string): Promise<Subscription> {
    try {
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
      if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);
      if (sub.status !== "paused") {
        throw new Error(
          `Subscription ${subscriptionId} is not paused (status: ${sub.status})`,
        );
      }

      const now = new Date();

      // Calculate how many days were remaining when paused
      const pausedAt = sub.pausedAt || now;
      const periodEnd = sub.currentPeriodEnd || now;
      const remainingMs = Math.max(0, periodEnd.getTime() - pausedAt.getTime());
      const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

      const newPeriodEnd = addDays(now, remainingDays);

      const setData = {
        status: "active" as const,
        resumedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: newPeriodEnd,
        updatedAt: now,
      };

      let updated: Subscription;
      if (isMysql) {
        await db
          .update(subscriptions)
          .set(setData)
          .where(eq(subscriptions.id, subscriptionId));
        const [s] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, subscriptionId));
        updated = s!;
      } else {
        const [s] = await db
          .update(subscriptions)
          .set(setData)
          .where(eq(subscriptions.id, subscriptionId))
          .returning();
        updated = s!;
      }

      await this.logSubscriptionEvent({
        subscriptionId,
        userId: sub.userId,
        action: "resumed",
        previousStatus: "paused",
        newStatus: "active",
        details: { remainingDays, newPeriodEnd: newPeriodEnd.toISOString() },
        source: "api",
      });

      await this.syncUserSubscriptionFields(sub.userId);
      return updated;
    } catch (error) {
      logger.error("SubscriptionService resumeSubscription error", {
        error: String(error),
      });
      throw error;
    }
  }

  async cancelSubscription(
    subscriptionId: string,
    immediate?: boolean,
    reason?: string,
  ): Promise<Subscription> {
    try {
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
      if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);

      const previousStatus = sub.status;
      const now = new Date();

      if (immediate) {
        // Cancel immediately
        const setData = {
          status: "canceled" as const,
          canceledAt: now,
          cancelReason: reason || null,
          cancelAtPeriodEnd: false,
          updatedAt: now,
        };

        let updated: Subscription;
        if (isMysql) {
          await db
            .update(subscriptions)
            .set(setData)
            .where(eq(subscriptions.id, subscriptionId));
          const [s] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, subscriptionId));
          updated = s!;
        } else {
          const [s] = await db
            .update(subscriptions)
            .set(setData)
            .where(eq(subscriptions.id, subscriptionId))
            .returning();
          updated = s!;
        }

        await this.logSubscriptionEvent({
          subscriptionId,
          userId: sub.userId,
          action: "canceled",
          previousStatus,
          newStatus: "canceled",
          details: { reason, immediate: true },
          source: "api",
        });

        await this.syncUserSubscriptionFields(sub.userId);
        return updated;
      } else {
        // Cancel at period end — subscription remains active until period ends
        const setData = {
          canceledAt: now,
          cancelReason: reason || null,
          cancelAtPeriodEnd: true,
          updatedAt: now,
        };

        let updated: Subscription;
        if (isMysql) {
          await db
            .update(subscriptions)
            .set(setData)
            .where(eq(subscriptions.id, subscriptionId));
          const [s] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, subscriptionId));
          updated = s!;
        } else {
          const [s] = await db
            .update(subscriptions)
            .set(setData)
            .where(eq(subscriptions.id, subscriptionId))
            .returning();
          updated = s!;
        }

        await this.logSubscriptionEvent({
          subscriptionId,
          userId: sub.userId,
          action: "canceled",
          previousStatus,
          newStatus: sub.status, // status doesn't change yet
          details: {
            reason,
            immediate: false,
            effectiveAt: sub.currentPeriodEnd?.toISOString(),
          },
          source: "api",
        });

        // No sync here — user keeps access until period end
        return updated;
      }
    } catch (error) {
      logger.error("SubscriptionService cancelSubscription error", {
        error: String(error),
      });
      throw error;
    }
  }

  async expireSubscription(subscriptionId: string): Promise<Subscription> {
    try {
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
      if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);

      const previousStatus = sub.status;
      const now = new Date();

      // Determine grace period end from the package
      let gracePeriodEndAt: Date | null = null;
      const [pkg] = await db
        .select()
        .from(subscriptionPackages)
        .where(eq(subscriptionPackages.id, sub.packageId));
      if (pkg && pkg.gracePeriodDays > 0) {
        gracePeriodEndAt = addDays(now, pkg.gracePeriodDays);
      }

      const setData = {
        status: "expired" as const,
        expiredAt: now,
        gracePeriodEndAt,
        updatedAt: now,
      };

      let updated: Subscription;
      if (isMysql) {
        await db
          .update(subscriptions)
          .set(setData)
          .where(eq(subscriptions.id, subscriptionId));
        const [s] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, subscriptionId));
        updated = s!;
      } else {
        const [s] = await db
          .update(subscriptions)
          .set(setData)
          .where(eq(subscriptions.id, subscriptionId))
          .returning();
        updated = s!;
      }

      await this.logSubscriptionEvent({
        subscriptionId,
        userId: sub.userId,
        action: "expired",
        previousStatus,
        newStatus: "expired",
        details: { gracePeriodEndAt: gracePeriodEndAt?.toISOString() },
        source: "system",
      });

      await this.syncUserSubscriptionFields(sub.userId);
      return updated;
    } catch (error) {
      logger.error("SubscriptionService expireSubscription error", {
        error: String(error),
      });
      throw error;
    }
  }

  async reactivateSubscription(subscriptionId: string): Promise<Subscription> {
    try {
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
      if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);
      if (sub.status !== "expired" && sub.status !== "canceled") {
        throw new Error(
          `Cannot reactivate subscription with status: ${sub.status}`,
        );
      }

      const previousStatus = sub.status;
      const now = new Date();

      // Fetch the price to get customDurationDays for custom cycles
      let customDurationDays: number | null = null;
      if (sub.priceId) {
        const [price] = await db
          .select()
          .from(packagePrices)
          .where(eq(packagePrices.id, sub.priceId));
        if (price) customDurationDays = price.customDurationDays;
      }

      const days = cycleDays(sub.billingCycle, customDurationDays);

      const setData = {
        status: "active" as const,
        activatedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: addDays(now, days),
        canceledAt: null,
        cancelReason: null,
        cancelAtPeriodEnd: false,
        expiredAt: null,
        gracePeriodEndAt: null,
        pausedAt: null,
        resumedAt: null,
        failedPaymentCount: 0,
        lastPaymentFailedAt: null,
        nextRetryAt: null,
        updatedAt: now,
      };

      let updated: Subscription;
      if (isMysql) {
        await db
          .update(subscriptions)
          .set(setData)
          .where(eq(subscriptions.id, subscriptionId));
        const [s] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, subscriptionId));
        updated = s!;
      } else {
        const [s] = await db
          .update(subscriptions)
          .set(setData)
          .where(eq(subscriptions.id, subscriptionId))
          .returning();
        updated = s!;
      }

      await this.logSubscriptionEvent({
        subscriptionId,
        userId: sub.userId,
        action: "reactivated",
        previousStatus,
        newStatus: "active",
        source: "api",
      });

      await this.syncUserSubscriptionFields(sub.userId);
      return updated;
    } catch (error) {
      logger.error("SubscriptionService reactivateSubscription error", {
        error: String(error),
      });
      throw error;
    }
  }

  async getUserActiveSubscription(
    userId: string,
  ): Promise<Subscription | undefined> {
    try {
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, userId),
            inArray(subscriptions.status, ["trialing", "active", "past_due"]),
          ),
        )
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);
      if (!sub) return undefined;

      // Manual (bank transfer / JazzCash) payments have no gateway webhook,
      // and there is no periodic job that flips a lapsed subscription's
      // status to "expired". That means a row can sit here as "active"/
      // "trialing" long after its real billing period has ended. Self-heal
      // that here: if the period has genuinely lapsed, transition it for
      // real (this also syncs the denormalized users.subscriptionStatus
      // fields) and report "no active subscription" instead of treating a
      // stale row as if it still grants access or blocks a new purchase.
      if (
        (sub.status === "active" || sub.status === "trialing") &&
        !isSubscriptionActive(sub.status, sub.currentPeriodEnd)
      ) {
        await this.expireSubscription(sub.id);
        return undefined;
      }

      // A past_due subscription past its grace period no longer grants
      // access. We don't force a status transition here — dunning
      // status changes are owned by the payment-retry/reactivation flow —
      // we just stop reporting it as the user's active subscription.
      if (sub.status === "past_due") {
        const inGracePeriod =
          sub.gracePeriodEndAt != null && new Date() <= sub.gracePeriodEndAt;
        if (!inGracePeriod) return undefined;
      }

      return sub;
    } catch (error) {
      logger.error("SubscriptionService getUserActiveSubscription error", {
        error: String(error),
      });
      throw error;
    }
  }

  async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    try {
      return await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .orderBy(desc(subscriptions.createdAt));
    } catch (error) {
      logger.error("SubscriptionService getUserSubscriptions error", {
        error: String(error),
      });
      throw error;
    }
  }

  async checkSubscriptionAccess(
    userId: string,
    featureKey?: string,
  ): Promise<{
    hasAccess: boolean;
    subscription?: Subscription;
    inGracePeriod?: boolean;
  }> {
    try {
      // Find active or trialing subscription
      const activeSub = await this.getUserActiveSubscription(userId);

      if (activeSub) {
        // Check grace period for past_due
        const inGracePeriod =
          activeSub.status === "past_due" &&
          activeSub.gracePeriodEndAt != null &&
          new Date() <= activeSub.gracePeriodEndAt;

        if (activeSub.status === "past_due" && !inGracePeriod) {
          return {
            hasAccess: false,
            subscription: activeSub,
            inGracePeriod: false,
          };
        }

        // If no specific feature key requested, just check for active subscription
        if (!featureKey) {
          return {
            hasAccess: true,
            subscription: activeSub,
            inGracePeriod: activeSub.status === "past_due" && inGracePeriod,
          };
        }

        // Check if the subscription's package has the requested feature
        const [feature] = await db
          .select()
          .from(packageFeatures)
          .where(
            and(
              eq(packageFeatures.packageId, activeSub.packageId),
              eq(packageFeatures.featureKey, featureKey),
            ),
          );

        if (!feature) {
          return { hasAccess: false, subscription: activeSub };
        }

        // "cross" valueType means the feature is explicitly excluded
        if (feature.valueType === "cross") {
          return { hasAccess: false, subscription: activeSub };
        }

        return {
          hasAccess: true,
          subscription: activeSub,
          inGracePeriod: activeSub.status === "past_due" && inGracePeriod,
        };
      }

      // Check for recently expired subscriptions that might be in grace period
      const [expiredSub] = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, userId),
            eq(subscriptions.status, "expired"),
            gt(subscriptions.gracePeriodEndAt, new Date()),
          ),
        )
        .orderBy(desc(subscriptions.expiredAt))
        .limit(1);

      if (expiredSub) {
        return {
          hasAccess: true,
          subscription: expiredSub,
          inGracePeriod: true,
        };
      }

      return { hasAccess: false };
    } catch (error) {
      logger.error("SubscriptionService checkSubscriptionAccess error", {
        error: String(error),
      });
      throw error;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 5. Proration Logic
  // ──────────────────────────────────────────────────────────────

  /**
   * Calculate the proration amount for a mid-cycle plan change.
   * Returns a positive number for an amount the user owes (upgrade),
   * or a negative number for a credit (downgrade).
   */
  calculateProration(
    currentSub: Subscription,
    newPrice: number,
    newBillingCycle: string,
  ): number {
    const now = new Date();

    const periodStart = currentSub.currentPeriodStart || now;
    const periodEnd = currentSub.currentPeriodEnd || now;
    const totalPeriodMs = periodEnd.getTime() - periodStart.getTime();

    if (totalPeriodMs <= 0) return newPrice;

    const elapsedMs = now.getTime() - periodStart.getTime();
    const remainingMs = Math.max(0, totalPeriodMs - elapsedMs);
    const remainingFraction = remainingMs / totalPeriodMs;

    const currentPrice = parseFloat(currentSub.priceAtPurchase);

    // Credit for unused portion of current plan
    const credit = currentPrice * remainingFraction;

    // Charge for the new plan (full period)
    const charge = newPrice;

    // Net: positive = user owes money, negative = user gets credit
    const net = parseFloat((charge - credit).toFixed(2));
    return net;
  }

  // ──────────────────────────────────────────────────────────────
  // 6. Dunning Management
  // ──────────────────────────────────────────────────────────────

  async handlePaymentFailure(subscriptionId: string): Promise<Subscription> {
    try {
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
      if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);

      const now = new Date();
      const newFailCount = sub.failedPaymentCount + 1;
      const previousStatus = sub.status;

      // Determine next retry date or suspend
      let nextRetryAt: Date | null = null;
      let newStatus = "past_due";

      if (newFailCount <= MAX_PAYMENT_RETRIES) {
        const retryDays = DUNNING_RETRY_INTERVALS[newFailCount - 1];
        nextRetryAt = addDays(now, retryDays);
      } else {
        // Max retries exhausted — expire the subscription
        newStatus = "expired";
      }

      const updateData: Record<string, unknown> = {
        status: newStatus,
        failedPaymentCount: newFailCount,
        lastPaymentFailedAt: now,
        nextRetryAt,
        updatedAt: now,
      };

      if (newStatus === "expired") {
        updateData.expiredAt = now;

        // Check for grace period
        const [pkg] = await db
          .select()
          .from(subscriptionPackages)
          .where(eq(subscriptionPackages.id, sub.packageId));
        if (pkg && pkg.gracePeriodDays > 0) {
          updateData.gracePeriodEndAt = addDays(now, pkg.gracePeriodDays);
        }
      }

      let updated: Subscription;
      if (isMysql) {
        await db
          .update(subscriptions)
          .set(updateData)
          .where(eq(subscriptions.id, subscriptionId));
        const [s] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, subscriptionId));
        updated = s!;
      } else {
        const [s] = await db
          .update(subscriptions)
          .set(updateData)
          .where(eq(subscriptions.id, subscriptionId))
          .returning();
        updated = s!;
      }

      await this.logSubscriptionEvent({
        subscriptionId,
        userId: sub.userId,
        action: "payment_failed",
        previousStatus,
        newStatus,
        details: {
          failedPaymentCount: newFailCount,
          nextRetryAt: nextRetryAt?.toISOString() || null,
          maxRetriesExhausted: newFailCount > MAX_PAYMENT_RETRIES,
        },
        source: "webhook",
      });

      await this.syncUserSubscriptionFields(sub.userId);
      return updated;
    } catch (error) {
      logger.error("SubscriptionService handlePaymentFailure error", {
        error: String(error),
      });
      throw error;
    }
  }

  async handlePaymentSuccess(subscriptionId: string): Promise<Subscription> {
    try {
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
      if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);

      const previousStatus = sub.status;
      const now = new Date();

      const setData = {
        status: "active" as const,
        failedPaymentCount: 0,
        lastPaymentFailedAt: null,
        nextRetryAt: null,
        updatedAt: now,
      };

      let updated: Subscription;
      if (isMysql) {
        await db
          .update(subscriptions)
          .set(setData)
          .where(eq(subscriptions.id, subscriptionId));
        const [s] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, subscriptionId));
        updated = s!;
      } else {
        const [s] = await db
          .update(subscriptions)
          .set(setData)
          .where(eq(subscriptions.id, subscriptionId))
          .returning();
        updated = s!;
      }

      await this.logSubscriptionEvent({
        subscriptionId,
        userId: sub.userId,
        action: "payment_succeeded",
        previousStatus,
        newStatus: "active",
        details: { previousFailedCount: sub.failedPaymentCount },
        source: "webhook",
      });

      await this.syncUserSubscriptionFields(sub.userId);
      return updated;
    } catch (error) {
      logger.error("SubscriptionService handlePaymentSuccess error", {
        error: String(error),
      });
      throw error;
    }
  }

  async getSubscriptionsForRetry(): Promise<Subscription[]> {
    try {
      const now = new Date();
      return await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.status, "past_due"),
            lte(subscriptions.nextRetryAt, now),
            lte(subscriptions.failedPaymentCount, MAX_PAYMENT_RETRIES),
          ),
        )
        .orderBy(subscriptions.nextRetryAt);
    } catch (error) {
      logger.error("SubscriptionService getSubscriptionsForRetry error", {
        error: String(error),
      });
      throw error;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 7. Invoice Generation
  // ──────────────────────────────────────────────────────────────

  async createInvoice(
    subscriptionId: string,
    lineItems: {
      type: string;
      description: string;
      packageId?: string;
      addOnId?: string;
      quantity: number;
      unitPrice: string;
      total: string;
      periodStart?: Date;
      periodEnd?: Date;
    }[],
  ): Promise<Invoice & { lineItems: InvoiceLineItem[] }> {
    try {
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
      if (!sub) throw new Error(`Subscription ${subscriptionId} not found`);

      const invoiceNumber = await this.generateInvoiceNumber();

      // Calculate totals from line items
      const subtotal = lineItems.reduce(
        (sum, item) => sum + parseFloat(item.total),
        0,
      );

      // Apply subscription discount if available
      const discountTotal = sub.discountAmount
        ? parseFloat(sub.discountAmount)
        : 0;
      const total = Math.max(0, subtotal - discountTotal);

      return await db.transaction(async (tx: any) => {
        const invoiceId = crypto.randomUUID();
        const invoiceValues = {
          id: invoiceId,
          invoiceNumber,
          userId: sub.userId,
          subscriptionId,
          status: "open",
          subtotal: subtotal.toFixed(2),
          discountTotal: discountTotal.toFixed(2),
          taxTotal: "0.00",
          total: total.toFixed(2),
          currency: sub.currency,
          periodStart: sub.currentPeriodStart,
          periodEnd: sub.currentPeriodEnd,
          couponId: sub.couponId,
        };

        let invoice: Invoice;
        if (isMysql) {
          await tx.insert(invoices).values(invoiceValues);
          const [inv] = await tx
            .select()
            .from(invoices)
            .where(eq(invoices.id, invoiceId));
          invoice = inv!;
        } else {
          const [inv] = await tx
            .insert(invoices)
            .values(invoiceValues)
            .returning();
          invoice = inv!;
        }

        // Insert line items
        const insertedItems: InvoiceLineItem[] = [];
        for (const item of lineItems) {
          const lineItemId = crypto.randomUUID();
          const lineItemValues = {
            id: lineItemId,
            invoiceId: invoice.id,
            type: item.type,
            description: item.description,
            packageId: item.packageId || null,
            addOnId: item.addOnId || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            periodStart: item.periodStart || null,
            periodEnd: item.periodEnd || null,
          };

          let lineItem: InvoiceLineItem;
          if (isMysql) {
            await tx.insert(invoiceLineItems).values(lineItemValues);
            const [li] = await tx
              .select()
              .from(invoiceLineItems)
              .where(eq(invoiceLineItems.id, lineItemId));
            lineItem = li!;
          } else {
            const [li] = await tx
              .insert(invoiceLineItems)
              .values(lineItemValues)
              .returning();
            lineItem = li!;
          }
          insertedItems.push(lineItem);
        }

        return { ...invoice, lineItems: insertedItems };
      });
    } catch (error) {
      logger.error("SubscriptionService createInvoice error", {
        error: String(error),
      });
      throw error;
    }
  }

  async generateInvoiceNumber(): Promise<string> {
    try {
      const year = new Date().getFullYear();
      const prefix = `INV-${year}-`;

      // Get the last invoice number for this year
      const [lastInvoice] = await db
        .select({ invoiceNumber: invoices.invoiceNumber })
        .from(invoices)
        .where(sql`${invoices.invoiceNumber} LIKE ${prefix + "%"}`)
        .orderBy(desc(invoices.invoiceNumber))
        .limit(1);

      let nextSeq = 1;
      if (lastInvoice) {
        const lastSeq = parseInt(
          lastInvoice.invoiceNumber.replace(prefix, ""),
          10,
        );
        if (!isNaN(lastSeq)) {
          nextSeq = lastSeq + 1;
        }
      }

      return `${prefix}${String(nextSeq).padStart(4, "0")}`;
    } catch (error) {
      logger.error("SubscriptionService generateInvoiceNumber error", {
        error: String(error),
      });
      throw error;
    }
  }

  async getUserInvoices(userId: string): Promise<Invoice[]> {
    try {
      return await db
        .select()
        .from(invoices)
        .where(eq(invoices.userId, userId))
        .orderBy(desc(invoices.createdAt));
    } catch (error) {
      logger.error("SubscriptionService getUserInvoices error", {
        error: String(error),
      });
      throw error;
    }
  }

  async getInvoice(
    id: string,
  ): Promise<(Invoice & { lineItems: InvoiceLineItem[] }) | undefined> {
    try {
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, id));
      if (!invoice) return undefined;

      const items = await db
        .select()
        .from(invoiceLineItems)
        .where(eq(invoiceLineItems.invoiceId, id))
        .orderBy(invoiceLineItems.createdAt);

      return { ...invoice, lineItems: items };
    } catch (error) {
      logger.error("SubscriptionService getInvoice error", {
        error: String(error),
      });
      throw error;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 8. Audit Logging
  // ──────────────────────────────────────────────────────────────

  async logSubscriptionEvent(data: {
    subscriptionId?: string | null;
    userId: string;
    performedBy?: string | null;
    action: string;
    previousStatus?: string | null;
    newStatus?: string | null;
    details?: Record<string, unknown> | null;
    source?: string;
    ipAddress?: string;
  }): Promise<SubscriptionAuditLog> {
    try {
      const logId = crypto.randomUUID();
      const logValues = {
        id: logId,
        subscriptionId: data.subscriptionId || null,
        userId: data.userId,
        performedBy: data.performedBy || null,
        action: data.action,
        previousStatus: data.previousStatus || null,
        newStatus: data.newStatus || null,
        details: data.details || null,
        source: data.source || "system",
        ipAddress: data.ipAddress || null,
      };

      if (isMysql) {
        await db.insert(subscriptionAuditLogs).values(logValues);
        const [log] = await db
          .select()
          .from(subscriptionAuditLogs)
          .where(eq(subscriptionAuditLogs.id, logId));
        return log!;
      }

      const [log] = await db
        .insert(subscriptionAuditLogs)
        .values(logValues)
        .returning();
      return log!;
    } catch (error) {
      // Audit logging should not break the main operation — log and continue
      logger.error("SubscriptionService logSubscriptionEvent error", {
        error: String(error),
      });
      // Return a minimal object to satisfy the type contract
      return {
        id: "",
        subscriptionId: data.subscriptionId || null,
        userId: data.userId,
        performedBy: data.performedBy || null,
        action: data.action,
        previousStatus: data.previousStatus || null,
        newStatus: data.newStatus || null,
        details: data.details || null,
        source: data.source || "system",
        ipAddress: data.ipAddress || null,
        createdAt: new Date(),
      };
    }
  }

  async getSubscriptionAuditLog(
    subscriptionId: string,
  ): Promise<SubscriptionAuditLog[]> {
    try {
      return await db
        .select()
        .from(subscriptionAuditLogs)
        .where(eq(subscriptionAuditLogs.subscriptionId, subscriptionId))
        .orderBy(desc(subscriptionAuditLogs.createdAt));
    } catch (error) {
      logger.error("SubscriptionService getSubscriptionAuditLog error", {
        error: String(error),
      });
      throw error;
    }
  }

  async getUserAuditLog(userId: string): Promise<SubscriptionAuditLog[]> {
    try {
      return await db
        .select()
        .from(subscriptionAuditLogs)
        .where(eq(subscriptionAuditLogs.userId, userId))
        .orderBy(desc(subscriptionAuditLogs.createdAt));
    } catch (error) {
      logger.error("SubscriptionService getUserAuditLog error", {
        error: String(error),
      });
      throw error;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 9. Admin Analytics
  // ──────────────────────────────────────────────────────────────

  async getSubscriptionStats(): Promise<{
    totalActive: number;
    totalTrialing: number;
    totalPastDue: number;
    totalCanceled: number;
    totalExpired: number;
    mrr: number;
    churnRate: number;
    newSubscriptionsThisMonth: number;
  }> {
    try {
      // Counts by status
      const statusCounts = await db
        .select({
          status: subscriptions.status,
          total: count(),
        })
        .from(subscriptions)
        .groupBy(subscriptions.status);

      const getCount = (status: string) =>
        Number(statusCounts.find((s: any) => s.status === status)?.total ?? 0);

      const totalActive = getCount("active");
      const totalTrialing = getCount("trialing");
      const totalPastDue = getCount("past_due");
      const totalCanceled = getCount("canceled");
      const totalExpired = getCount("expired");

      // MRR calculation: sum of monthly-normalized prices for active subscriptions
      const activeSubRows = await db
        .select({
          priceAtPurchase: subscriptions.priceAtPurchase,
          billingCycle: subscriptions.billingCycle,
        })
        .from(subscriptions)
        .where(inArray(subscriptions.status, ["active", "trialing"]));

      let mrr = 0;
      for (const row of activeSubRows) {
        const price = parseFloat(row.priceAtPurchase);
        switch (row.billingCycle) {
          case "monthly":
            mrr += price;
            break;
          case "quarterly":
            mrr += price / 3;
            break;
          case "semi_annual":
            mrr += price / 6;
            break;
          case "annual":
            mrr += price / 12;
            break;
          case "lifetime":
            // Lifetime subscriptions don't contribute to recurring revenue
            break;
          default:
            mrr += price;
            break;
        }
      }
      mrr = parseFloat(mrr.toFixed(2));

      // Churn rate: cancellations + expirations this month / active at month start
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [churnedResult] = await db
        .select({ total: count() })
        .from(subscriptions)
        .where(
          and(
            inArray(subscriptions.status, ["canceled", "expired"]),
            or(
              gt(subscriptions.canceledAt, monthStart),
              gt(subscriptions.expiredAt, monthStart),
            ),
          ),
        );

      const churned = Number(churnedResult?.total ?? 0);
      const activeBase = totalActive + totalTrialing + churned; // approximate start-of-month
      const churnRate =
        activeBase > 0
          ? parseFloat(((churned / activeBase) * 100).toFixed(2))
          : 0;

      // New subscriptions this month
      const [newSubsResult] = await db
        .select({ total: count() })
        .from(subscriptions)
        .where(gt(subscriptions.createdAt, monthStart));

      const newSubscriptionsThisMonth = Number(newSubsResult?.total ?? 0);

      return {
        totalActive,
        totalTrialing,
        totalPastDue,
        totalCanceled,
        totalExpired,
        mrr,
        churnRate,
        newSubscriptionsThisMonth,
      };
    } catch (error) {
      logger.error("SubscriptionService getSubscriptionStats error", {
        error: String(error),
      });
      throw error;
    }
  }

  async getRevenueByPackage(): Promise<
    {
      packageId: string;
      packageName: string;
      activeSubscribers: number;
      totalRevenue: number;
      mrr: number;
    }[]
  > {
    try {
      const rows = await db
        .select({
          packageId: subscriptions.packageId,
          packageName: subscriptionPackages.name,
          priceAtPurchase: subscriptions.priceAtPurchase,
          billingCycle: subscriptions.billingCycle,
          status: subscriptions.status,
        })
        .from(subscriptions)
        .innerJoin(
          subscriptionPackages,
          eq(subscriptions.packageId, subscriptionPackages.id),
        );

      // Group by package
      const grouped = new Map<
        string,
        {
          packageId: string;
          packageName: string;
          activeSubscribers: number;
          totalRevenue: number;
          mrr: number;
        }
      >();

      for (const row of rows) {
        const existing = grouped.get(row.packageId) || {
          packageId: row.packageId,
          packageName: row.packageName,
          activeSubscribers: 0,
          totalRevenue: 0,
          mrr: 0,
        };

        const price = parseFloat(row.priceAtPurchase);
        existing.totalRevenue += price;

        if (row.status === "active" || row.status === "trialing") {
          existing.activeSubscribers++;
          switch (row.billingCycle) {
            case "monthly":
              existing.mrr += price;
              break;
            case "quarterly":
              existing.mrr += price / 3;
              break;
            case "semi_annual":
              existing.mrr += price / 6;
              break;
            case "annual":
              existing.mrr += price / 12;
              break;
            // lifetime doesn't add to MRR
          }
        }

        grouped.set(row.packageId, existing);
      }

      return Array.from(grouped.values()).map((r) => ({
        ...r,
        totalRevenue: parseFloat(r.totalRevenue.toFixed(2)),
        mrr: parseFloat(r.mrr.toFixed(2)),
      }));
    } catch (error) {
      logger.error("SubscriptionService getRevenueByPackage error", {
        error: String(error),
      });
      throw error;
    }
  }

  async getChurnAnalytics(period?: "7d" | "30d" | "90d" | "1y"): Promise<{
    totalChurned: number;
    cancellations: number;
    expirations: number;
    churnByDay: { date: string; cancellations: number; expirations: number }[];
  }> {
    try {
      const daysMap: Record<string, number> = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "1y": 365,
      };
      const days = daysMap[period || "30d"] ?? 30;
      const sinceDate = addDays(new Date(), -days);

      const dateFormatExpr = (col: any) =>
        isMysql
          ? sql<string>`DATE_FORMAT(${col}, '%Y-%m-%d')`
          : sql<string>`to_char(${col}, 'YYYY-MM-DD')`;

      // Cancellations
      const cancelledRows = await db
        .select({
          date: dateFormatExpr(subscriptions.canceledAt).as("date"),
          total: count(),
        })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.status, "canceled"),
            gt(subscriptions.canceledAt, sinceDate),
          ),
        )
        .groupBy(dateFormatExpr(subscriptions.canceledAt))
        .orderBy(dateFormatExpr(subscriptions.canceledAt));

      // Expirations
      const expiredRows = await db
        .select({
          date: dateFormatExpr(subscriptions.expiredAt).as("date"),
          total: count(),
        })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.status, "expired"),
            gt(subscriptions.expiredAt, sinceDate),
          ),
        )
        .groupBy(dateFormatExpr(subscriptions.expiredAt))
        .orderBy(dateFormatExpr(subscriptions.expiredAt));

      // Merge into daily timeline
      const dayMap = new Map<
        string,
        { cancellations: number; expirations: number }
      >();
      for (const row of cancelledRows) {
        const key = row.date;
        const existing = dayMap.get(key) || {
          cancellations: 0,
          expirations: 0,
        };
        existing.cancellations = Number(row.total);
        dayMap.set(key, existing);
      }
      for (const row of expiredRows) {
        const key = row.date;
        const existing = dayMap.get(key) || {
          cancellations: 0,
          expirations: 0,
        };
        existing.expirations = Number(row.total);
        dayMap.set(key, existing);
      }

      const churnByDay = Array.from(dayMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const cancellations = churnByDay.reduce((s, d) => s + d.cancellations, 0);
      const expirations = churnByDay.reduce((s, d) => s + d.expirations, 0);

      return {
        totalChurned: cancellations + expirations,
        cancellations,
        expirations,
        churnByDay,
      };
    } catch (error) {
      logger.error("SubscriptionService getChurnAnalytics error", {
        error: String(error),
      });
      throw error;
    }
  }

  async getSubscriberGrowth(period?: "7d" | "30d" | "90d" | "1y"): Promise<{
    totalNewSubscribers: number;
    growthByDay: { date: string; newSubscribers: number }[];
  }> {
    try {
      const daysMap: Record<string, number> = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "1y": 365,
      };
      const days = daysMap[period || "30d"] ?? 30;
      const sinceDate = addDays(new Date(), -days);

      const dateFormatExpr = (col: any) =>
        isMysql
          ? sql<string>`DATE_FORMAT(${col}, '%Y-%m-%d')`
          : sql<string>`to_char(${col}, 'YYYY-MM-DD')`;

      const rows = await db
        .select({
          date: dateFormatExpr(subscriptions.createdAt).as("date"),
          total: count(),
        })
        .from(subscriptions)
        .where(gt(subscriptions.createdAt, sinceDate))
        .groupBy(dateFormatExpr(subscriptions.createdAt))
        .orderBy(dateFormatExpr(subscriptions.createdAt));

      const growthByDay = rows.map((r: any) => ({
        date: r.date,
        newSubscribers: Number(r.total),
      }));

      const totalNewSubscribers = growthByDay.reduce(
        (s: number, d: any) => s + d.newSubscribers,
        0,
      );

      return { totalNewSubscribers, growthByDay };
    } catch (error) {
      logger.error("SubscriptionService getSubscriberGrowth error", {
        error: String(error),
      });
      throw error;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 10. Legacy Sync
  // ──────────────────────────────────────────────────────────────

  /**
   * Sync the legacy `users.subscriptionStatus`, `users.subscriptionPlan`,
   * and `users.subscriptionExpiresAt` fields from the subscriptions table.
   * Called after every lifecycle state change.
   */
  async syncUserSubscriptionFields(userId: string): Promise<void> {
    try {
      // Find the user's most relevant subscription
      // Priority: active > trialing > past_due > paused > canceled > expired
      const statusPriority = [
        "active",
        "trialing",
        "past_due",
        "paused",
        "canceled",
        "expired",
      ];

      let bestSub: Subscription | undefined;

      for (const status of statusPriority) {
        const [sub] = await db
          .select()
          .from(subscriptions)
          .where(
            and(
              eq(subscriptions.userId, userId),
              eq(subscriptions.status, status),
            ),
          )
          .orderBy(desc(subscriptions.createdAt))
          .limit(1);
        if (sub) {
          bestSub = sub;
          break;
        }
      }

      if (!bestSub) {
        // No subscriptions at all — reset to "none"
        await db
          .update(users)
          .set({
            subscriptionStatus: "none",
            subscriptionPlan: null,
            subscriptionExpiresAt: null,
          })
          .where(eq(users.id, userId));
        return;
      }

      // Resolve the package name for the legacy plan field
      let packageName: string | null = null;
      const [pkg] = await db
        .select()
        .from(subscriptionPackages)
        .where(eq(subscriptionPackages.id, bestSub.packageId));
      if (pkg) {
        packageName =
          normalizeSubscriptionPlan(pkg.name) ||
          normalizeSubscriptionPlan(pkg.slug) ||
          pkg.name;
      }

      // Map subscription status to the legacy status field
      const legacyStatus =
        bestSub.status === "trialing" ? "trialing" : bestSub.status;

      await db
        .update(users)
        .set({
          subscriptionStatus: legacyStatus,
          subscriptionPlan: packageName,
          subscriptionExpiresAt: bestSub.currentPeriodEnd,
        })
        .where(eq(users.id, userId));
    } catch (error) {
      // Legacy sync should not break the main operation
      logger.error("SubscriptionService syncUserSubscriptionFields error", {
        error: String(error),
      });
    }
  }
}

export const subscriptionService = new SubscriptionService();
