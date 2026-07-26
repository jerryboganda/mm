import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../shared/schema";
import { logger } from "./lib/logger";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  connectionLimit: parseInt(process.env.DB_POOL_MAX || "20", 10),
  idleTimeout: 30000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

/**
 * Verify database connectivity at startup with retries.
 * Prevents the server from starting if the DB is unreachable.
 */
export async function ensureDatabaseConnection(maxRetries = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const connection = await pool.getConnection();
      await connection.query("SELECT 1");
      connection.release();
      logger.info(`[DB] Connected successfully to MySQL (attempt ${attempt})`);
      return;
    } catch (error) {
      logger.error(`[DB] Connection attempt ${attempt}/${maxRetries} failed`, {
        error: error instanceof Error ? error.message : String(error),
      });
      if (attempt === maxRetries) {
        throw new Error(
          `Failed to connect to database after ${maxRetries} attempts`,
        );
      }
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export const db = drizzle(pool, { schema, mode: "default" });
