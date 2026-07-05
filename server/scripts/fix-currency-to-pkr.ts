/**
 * One-off data repair: forces every existing `currency` value in the
 * currency-bearing tables to "PKR" (the project's only supported currency).
 *
 * Safe to run multiple times — only rows whose currency is not already
 * "PKR" are updated, and the script reports how many rows changed per table.
 *
 * Run with:  npm run db:fix-currency   (or: tsx server/scripts/fix-currency-to-pkr.ts)
 */

// Load .env BEFORE importing modules that read process.env at import time
// (server/db.ts throws if DATABASE_URL is unset). drizzle-kit loads .env on its
// own; tsx does not. Static ESM imports are hoisted, so the DB modules are
// imported dynamically below — after env is loaded.
try {
  (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.();
} catch {
  // .env may not exist (env provided by the host) — ignore.
}

const CURRENCY = "PKR";

async function fixCurrency(): Promise<void> {
  const { ne } = await import("drizzle-orm");
  const { db, pool } = await import("../db");
  const {
    packagePrices,
    addOns,
    addOnBundles,
    subscriptions,
    invoices,
    paymentTransactions,
  } = await import("../../shared/schema");
  const { logger } = await import("../lib/logger");

  const tables = [
    { name: "package_prices", table: packagePrices },
    { name: "add_ons", table: addOns },
    { name: "add_on_bundles", table: addOnBundles },
    { name: "subscriptions", table: subscriptions },
    { name: "invoices", table: invoices },
    { name: "payment_transactions", table: paymentTransactions },
  ] as const;

  try {
    for (const { name, table } of tables) {
      const updated = await db
        .update(table)
        .set({ currency: CURRENCY })
        .where(ne(table.currency, CURRENCY))
        .returning({ id: table.id });

      logger.info(`[fix-currency] ${name}: updated ${updated.length} row(s)`);
    }

    logger.info("[fix-currency] Done.");
    await pool.end();
    process.exit(0);
  } catch (err) {
    logger.error("[fix-currency] Failed", { error: String(err) });
    await pool.end();
    process.exit(1);
  }
}

fixCurrency();
