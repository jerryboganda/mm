/**
 * Idempotent seed for the three launch subscription packages.
 *
 * Creates Monthly / Quarterly / Annual placeholder packages (PKR) with one
 * price each and a few features. Safe to run multiple times — packages are
 * matched by `slug`, and prices/features are only inserted when missing.
 *
 * Run with:  npm run db:seed:packages   (or: tsx server/scripts/seed-packages.ts)
 */

// Load .env BEFORE importing modules that read process.env at import time
// (server/db.ts throws if DATABASE_URL is unset). drizzle-kit loads .env on its
// own; tsx does not. Static ESM imports are hoisted, so the DB modules are
// imported dynamically below — after env is loaded.
try {
  (
    process as unknown as { loadEnvFile?: (p?: string) => void }
  ).loadEnvFile?.();
} catch {
  // .env may not exist (env provided by the host) — ignore.
}

import {
  CANONICAL_PACKAGES,
  CANONICAL_CURRENCY,
} from "../../shared/pricing-contracts";

async function seed(): Promise<void> {
  const { eq, and, notInArray } = await import("drizzle-orm");
  const { db, pool, isMysql } = await import("../db");
  const { subscriptionPackages, packagePrices, packageFeatures } = await import(
    "../../shared/schema"
  );
  const { logger } = await import("../lib/logger");
  const crypto = await import("crypto");

  try {
    const validSlugs = CANONICAL_PACKAGES.map((p) => p.slug);

    // 1. Archive and hide any obsolete packages (e.g., 3-months-plan, monthly)
    await db
      .update(subscriptionPackages)
      .set({
        status: "archived",
        isVisibleToUsers: false,
      })
      .where(notInArray(subscriptionPackages.slug, validSlugs));

    logger.info("[seed-packages] Archived all non-canonical packages.");

    // 2. Upsert canonical packages & prices
    for (const p of CANONICAL_PACKAGES) {
      let [pkg] = await db
        .select()
        .from(subscriptionPackages)
        .where(eq(subscriptionPackages.slug, p.slug));

      if (!pkg) {
        const pkgId = crypto.randomUUID();
        if (isMysql) {
          await db.insert(subscriptionPackages).values({
            id: pkgId,
            name: p.name,
            slug: p.slug,
            description: p.description,
            shortDescription: p.shortDescription,
            status: "active",
            isVisibleToUsers: true,
            displayOrder: p.displayOrder,
            trialDays: 0,
          });
          const [inserted] = await db
            .select()
            .from(subscriptionPackages)
            .where(eq(subscriptionPackages.id, pkgId));
          pkg = inserted;
        } else {
          const [inserted] = await db
            .insert(subscriptionPackages)
            .values({
              id: pkgId,
              name: p.name,
              slug: p.slug,
              description: p.description,
              shortDescription: p.shortDescription,
              status: "active",
              isVisibleToUsers: true,
              displayOrder: p.displayOrder,
              trialDays: 0,
            })
            .returning();
          pkg = inserted;
        }
        logger.info(`[seed-packages] Created canonical package: ${p.slug}`);
      } else {
        await db
          .update(subscriptionPackages)
          .set({
            name: p.name,
            description: p.description,
            shortDescription: p.shortDescription,
            displayOrder: p.displayOrder,
            status: "active",
            isVisibleToUsers: true,
          })
          .where(eq(subscriptionPackages.id, pkg.id));
        logger.info(`[seed-packages] Updated canonical package: ${p.slug}`);
      }

      // Ensure a price for the billing cycle exists and update if changed
      const [existingPrice] = await db
        .select()
        .from(packagePrices)
        .where(
          and(
            eq(packagePrices.packageId, pkg.id),
            eq(packagePrices.billingCycle, p.billingCycle),
          ),
        );

      if (!existingPrice) {
        const priceId = crypto.randomUUID();
        await db.insert(packagePrices).values({
          id: priceId,
          packageId: pkg.id,
          billingCycle: p.billingCycle,
          price: p.price,
          currency: CANONICAL_CURRENCY,
          originalPrice: p.originalPrice ?? null,
          isActive: true,
        });
        logger.info(
          `[seed-packages] Added ${p.billingCycle} price for ${p.slug}: ${p.price} ${CANONICAL_CURRENCY}`,
        );
      } else {
        await db
          .update(packagePrices)
          .set({
            price: p.price,
            currency: CANONICAL_CURRENCY,
            originalPrice: p.originalPrice ?? null,
            isActive: true,
          })
          .where(eq(packagePrices.id, existingPrice.id));
        logger.info(
          `[seed-packages] Standardized ${p.billingCycle} price to ${p.price} ${CANONICAL_CURRENCY} for ${p.slug}`,
        );
      }

      // Ensure features exist (match by key or name)
      const existingFeatures = await db
        .select()
        .from(packageFeatures)
        .where(eq(packageFeatures.packageId, pkg.id));
      const existingNames = new Set(
        existingFeatures.map((f: { name: string }) => f.name),
      );

      let order = 0;
      for (const f of p.features) {
        order += 1;
        if (existingNames.has(f.name)) continue;
        await db.insert(packageFeatures).values({
          id: crypto.randomUUID(),
          packageId: pkg.id,
          name: f.name,
          valueType: f.valueType,
          value: f.value ?? null,
          featureKey: f.key ?? null,
          displayOrder: order,
        });
      }
    }

    logger.info("[seed-packages] Successfully standardized all canonical packages.");
    await pool.end();
    process.exit(0);
  } catch (err) {
    logger.error("[seed-packages] Failed", { error: String(err) });
    await pool.end();
    process.exit(1);
  }
}

seed();
