import "dotenv/config";
import { eq, and, notInArray, sql } from "drizzle-orm";
import { db, pool, isMysql } from "../server/db";
import {
  subscriptionPackages,
  packagePrices,
  packageFeatures,
  users,
} from "../shared/schema";
import {
  CANONICAL_PACKAGES,
  CANONICAL_CURRENCY,
  normalizeSubscriptionPlan,
} from "../shared/pricing-contracts";
import crypto from "crypto";

async function main() {
  console.log("=================================================");
  console.log(" STANDARDIZING PRICING PACKAGES & USER PLANS ");
  console.log("=================================================");

  const validSlugs = CANONICAL_PACKAGES.map((p) => p.slug);

  // 1. Archive non-canonical packages
  console.log("[1/4] Archiving non-canonical packages...");
  await db
    .update(subscriptionPackages)
    .set({
      status: "archived",
      isVisibleToUsers: false,
    })
    .where(notInArray(subscriptionPackages.slug, validSlugs));

  // Also deactivate prices of non-canonical packages
  const archivedPkgs = await db
    .select()
    .from(subscriptionPackages)
    .where(notInArray(subscriptionPackages.slug, validSlugs));

  for (const pkg of archivedPkgs) {
    await db
      .update(packagePrices)
      .set({ isActive: false })
      .where(eq(packagePrices.packageId, pkg.id));
  }

  // 2. Upsert canonical packages & prices
  console.log("[2/4] Upserting canonical packages and prices...");
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
      console.log(`[+] Created package: ${p.name} (${p.slug})`);
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
      console.log(`[+] Updated package: ${p.name} (${p.slug})`);
    }

    // Ensure price exists and matches canonical specification
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
      console.log(`[+] Added price: ${p.price} ${CANONICAL_CURRENCY} for ${p.name}`);
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
      console.log(`[+] Standardized price: ${p.price} ${CANONICAL_CURRENCY} for ${p.name}`);
    }

    // Ensure features
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

  // 3. Normalize legacy user subscription_plan values
  console.log("[3/4] Normalizing existing user subscription_plan records...");
  const allUsers = await db
    .select({ id: users.id, plan: users.subscriptionPlan })
    .from(users);

  let normalizedCount = 0;
  for (const u of allUsers) {
    if (!u.plan) continue;
    const normalized = normalizeSubscriptionPlan(u.plan);
    if (normalized && normalized !== u.plan) {
      await db
        .update(users)
        .set({ subscriptionPlan: normalized })
        .where(eq(users.id, u.id));
      normalizedCount++;
    }
  }
  console.log(`[+] Normalized ${normalizedCount} user subscription_plan records.`);

  // 4. Verification summary
  console.log("\n[4/4] Verifying standardized state...");
  const activePkgs = await db
    .select({
      id: subscriptionPackages.id,
      name: subscriptionPackages.name,
      slug: subscriptionPackages.slug,
      status: subscriptionPackages.status,
      displayOrder: subscriptionPackages.displayOrder,
      isVisibleToUsers: subscriptionPackages.isVisibleToUsers,
    })
    .from(subscriptionPackages)
    .where(eq(subscriptionPackages.isVisibleToUsers, true));

  console.log("Visible Active Packages:");
  console.table(activePkgs);

  console.log("\n✅ All pricing packages successfully standardized!");
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
