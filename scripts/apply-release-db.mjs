import fs from "fs";
import path from "path";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({
  connectionString: dbUrl,
});

async function main() {
  const releaseDigest =
    "f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605";
  const topicsDir = path.resolve(
    "content/book-releases",
    releaseDigest,
    "topics",
  );

  if (!fs.existsSync(topicsDir)) {
    console.error("Topics dir not found:", topicsDir);
    process.exit(1);
  }

  const topicFiles = fs
    .readdirSync(topicsDir)
    .filter((f) => f.endsWith(".json"));
  console.log(`[*] Found ${topicFiles.length} topic JSON files to apply...`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let totalBlocks = 0;
    for (const file of topicFiles) {
      const topicData = JSON.parse(
        fs.readFileSync(path.join(topicsDir, file), "utf-8"),
      );
      const topicId = topicData.topic_id;

      // Delete existing blocks for this topic
      await client.query("DELETE FROM content_blocks WHERE topic_id = $1", [
        topicId,
      ]);

      // Insert new blocks
      for (const block of topicData.blocks) {
        const blockId = `cb-book-${topicId}-${block.order}`;
        await client.query(
          `INSERT INTO content_blocks (id, topic_id, type, content, "order")
           VALUES ($1, $2, $3, $4, $5)`,
          [blockId, topicId, "document_html", block.content, block.order],
        );
        totalBlocks++;
      }
    }

    await client.query("COMMIT");
    console.log(
      `[+] SUCCESS: Applied ${topicFiles.length} topics (${totalBlocks} content blocks) to PostgreSQL database!`,
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[-] Transaction failed and rolled back:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
