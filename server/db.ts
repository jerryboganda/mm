import dotenv from "dotenv";
dotenv.config();

import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import pg from "pg";
import mysql from "mysql2/promise";
import * as schema from "../shared/schema";
import { logger } from "./lib/logger";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const dbUrl = process.env.DATABASE_URL;
const isMysql = dbUrl.startsWith("mysql:") || dbUrl.startsWith("mysql://");

let poolInstance: any;
let dbInstance: any;

if (isMysql) {
  logger.info("[DB] Initializing MySQL driver (mysql2)");
  poolInstance = mysql.createPool({
    uri: dbUrl,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_MAX || "20", 10),
    queueLimit: 0,
  });

  dbInstance = drizzleMysql(poolInstance, { schema, mode: "default" });
} else {
  logger.info("[DB] Initializing PostgreSQL driver (pg)");
  const { Pool } = pg;
  poolInstance = new Pool({
    connectionString: dbUrl,
    max: parseInt(process.env.DB_POOL_MAX || "20", 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: false,
  });

  poolInstance.on("error", (err: Error) => {
    logger.error("[DB Pool] Unexpected client error", { error: err.message });
  });

  dbInstance = drizzlePg(poolInstance, { schema });
}

export const pool = poolInstance;
export const db = dbInstance;

/**
 * Verify database connectivity at startup with retries.
 * Non-fatal: logs warnings if DB is offline without crashing server boot.
 */
export async function ensureDatabaseConnection(maxRetries = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (isMysql) {
        const conn = await pool.getConnection();
        await conn.query("SELECT 1");
        conn.release();
      } else {
        const client = await pool.connect();
        await client.query("SELECT 1");
        client.release();
      }
      logger.info(`[DB] Connected successfully (attempt ${attempt})`);
      return;
    } catch (error) {
      logger.error(`[DB] Connection attempt ${attempt}/${maxRetries} failed`, {
        error: error instanceof Error ? error.message : String(error),
      });
      if (attempt === maxRetries) {
        logger.error(
          `[DB] Warning: DB unreachable after ${maxRetries} attempts — server will continue running and retry on requests`,
        );
        return;
      }
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
