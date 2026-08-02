import dotenv from "dotenv";
dotenv.config();
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function wipeStudyData() {
  console.log("=== STARTING STUDY DATA WIPE ===");

  const tablesToWipe = [
    "quiz_attempts",
    "user_progress",
    "bookmarks",
    "review_schedule",
    "recent_activity",
    "content_reports",
    "mcqs",
    "content_blocks",
    "topics",
    "chapters",
    "books"
  ];

  for (const table of tablesToWipe) {
    try {
      console.log(`Truncating table '${table}'...`);
      await db.execute(sql.raw(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`));
      console.log(`✓ Table '${table}' wiped successfully.`);
    } catch (err: any) {
      console.error(`✗ Error wiping table '${table}': ${err.message}`);
    }
  }

  console.log("=== STUDY DATA WIPE COMPLETE ===");
  process.exit(0);
}

wipeStudyData();
