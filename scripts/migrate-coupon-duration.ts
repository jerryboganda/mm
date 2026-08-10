import dotenv from "dotenv";
dotenv.config();

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Starting migration: add duration_days_override to coupons table...");

  try {
    await db.execute(
      sql.raw(
        "ALTER TABLE coupons ADD COLUMN IF NOT EXISTS duration_days_override INTEGER;"
      )
    );
    console.log("Successfully executed migration: duration_days_override column added or already exists.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main();
