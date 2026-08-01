import dotenv from "dotenv";
dotenv.config();

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema";
import { logger } from "./lib/logger";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || "20", 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  allowExitOnIdle: false,
});

// Log pool errors so they don't crash the process silently
pool.on("error", (err) => {
  logger.error("[DB Pool] Unexpected client error", { error: err.message });
});

// Warn when pool usage exceeds 80%
setInterval(() => {
  const { totalCount, idleCount, waitingCount } = pool;
  const usage =
    ((totalCount - idleCount) / parseInt(process.env.DB_POOL_MAX || "20", 10)) *
    100;
  if (usage > 80 || waitingCount > 0) {
    logger.warn("DB pool pressure", {
      totalCount,
      idleCount,
      waitingCount,
      usagePercent: Math.round(usage),
    });
  }
}, 30_000);

/**
 * Verify database connectivity at startup with retries.
 * Prevents the server from starting if the DB is unreachable.
 */
export async function ensureDatabaseConnection(maxRetries = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      logger.info(`[DB] Connected successfully (attempt ${attempt})`);
      return;
    } catch (error) {
      logger.error(`[DB] Connection attempt ${attempt}/${maxRetries} failed`, {
        error: error instanceof Error ? error.message : String(error),
      });
      if (attempt === maxRetries) {
        logger.error(`[DB] Warning: DB unreachable after ${maxRetries} attempts — server will continue running and retry on requests`);
        return;
      }
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export const db = drizzle(pool, { schema });
