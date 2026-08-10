import dotenv from "dotenv";
dotenv.config();

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Starting migration to add is_paid columns...");

  try {
    console.log("Adding is_paid column to topics table if not exists...");
    await db.execute(
      sql.raw(
        "ALTER TABLE topics ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;"
      )
    );
    console.log("Successfully added is_paid column to topics table.");

    console.log("Adding is_paid column to mcqs table if not exists...");
    await db.execute(
      sql.raw(
        "ALTER TABLE mcqs ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;"
      )
    );
    console.log("Successfully added is_paid column to mcqs table.");

    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main();
