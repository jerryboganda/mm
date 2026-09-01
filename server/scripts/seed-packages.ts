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

type SeedPackage = {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  displayOrder: number;
  billingCycle: string;
  price: string;
  originalPrice?: string;
  features: { name: string; valueType: string; value?: string; key?: string }[];
};

const CURRENCY = "PKR";

const PACKAGES: SeedPackage[] = [
  {
    slug: "six_months",
    name: "6 Months",
    shortDescription: "Full access for 6 months",
    description:
      "6 months of full premium access to all OB-GYN topics and MCQs.",
    displayOrder: 1,
    billingCycle: "semi_annual",
    price: "700.00",
    features: [
      {
        name: "Full content access",
        valueType: "check",
        key: "full_content_access",
      },
      { name: "Unlimited MCQs", valueType: "check", key: "unlimited_mcqs" },
      { name: "Priority support", valueType: "check", key: "priority_support" },
    ],
  },
  {
    slug: "annual",
    name: "1 Year",
    shortDescription: "Best value, full access for 1 year",
    description: "A full year of premium access to all OB-GYN topics and MCQs.",
    displayOrder: 2,
    billingCycle: "annual",
    price: "1000.00",
    features: [
      {
        name: "Full content access",
        valueType: "check",
        key: "full_content_access",
      },
      { name: "Unlimited MCQs", valueType: "check", key: "unlimited_mcqs" },
      { name: "Priority support", valueType: "check", key: "priority_support" },
    ],
  },
];

async function seed(): Promise<void> {
  const { eq, and } = await import("drizzle-orm");
  const { db, pool } = await import("../db");
  const { subscriptionPackages, packagePrices, packageFeatures } = await import(
    "../../shared/schema"
  );
  const { logger } = await import("../lib/logger");

  try {
    for (const p of PACKAGES) {
      // Upsert the package by slug
      let [pkg] = await db
        .select()
        .from(subscriptionPackages)
        .where(eq(subscriptionPackages.slug, p.slug));

      if (!pkg) {
        [pkg] = await db
          .insert(subscriptionPackages)
          .values({
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
        logger.info(`[seed-packages] Created package: ${p.slug}`);
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
        logger.info(`[seed-packages] Updated package: ${p.slug}`);
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
        await db.insert(packagePrices).values({
          packageId: pkg.id,
          billingCycle: p.billingCycle,
          price: p.price,
          currency: CURRENCY,
          originalPrice: p.originalPrice ?? null,
          isActive: true,
        });
        logger.info(
          `[seed-packages] Added ${p.billingCycle} price for ${p.slug}`,
        );
      } else {
        await db
          .update(packagePrices)
          .set({
            price: p.price,
            currency: CURRENCY,
            originalPrice: p.originalPrice ?? null,
            isActive: true,
          })
          .where(eq(packagePrices.id, existingPrice.id));
        logger.info(
          `[seed-packages] Updated ${p.billingCycle} price to ${p.price} PKR for ${p.slug}`,
        );
      }

      // Ensure features exist (match by name)
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
          packageId: pkg.id,
          name: f.name,
          valueType: f.valueType,
          value: f.value ?? null,
          featureKey: f.key ?? null,
          displayOrder: order,
        });
      }
    }

    logger.info("[seed-packages] Done.");
    await pool.end();
    process.exit(0);
  } catch (err) {
    logger.error("[seed-packages] Failed", { error: String(err) });
    await pool.end();
    process.exit(1);
  }
}

seed();
