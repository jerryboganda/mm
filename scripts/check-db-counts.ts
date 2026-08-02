import dotenv from "dotenv";
dotenv.config();
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function check() {
  const tables = [
    "books", "chapters", "topics", "content_blocks", "mcqs",
    "user_progress", "quiz_attempts", "bookmarks", "recent_activity",
    "review_schedule", "content_reports", "users"
  ];

  console.log("--- DATABASE TABLE ROW COUNTS ---");
  for (const table of tables) {
    try {
      const res: any = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${table}`));
      const count = res.rows ? res.rows[0].count : (res[0] ? res[0].count || res[0]['COUNT(*)'] : 0);
      console.log(`Table '${table}': ${count} rows`);
    } catch (err: any) {
      console.log(`Table '${table}': Error - ${err.message}`);
    }
  }
  process.exit(0);
}

check();
