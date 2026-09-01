/**
 * Full production DB vs local compiled release diff.
 * Compares every topic's content_blocks (document_html) digests.
 */
const fs = require("fs");
const crypto = require("crypto");
const { Client } = require("D:\\Projects\\Maternal Mind\\node_modules\\pg");

const MDIR =
  "D:\\Projects\\Maternal Mind\\content\\book-releases\\f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605";

async function main() {
  const env = fs.readFileSync("D:\\Projects\\Maternal Mind\\.env", "utf8");
  const url = env.match(/^DATABASE_URL=(.+)$/m)[1];
  const client = new Client({ connectionString: url });
  await client.connect();

  const manifest = JSON.parse(
    fs.readFileSync(MDIR + "\\release_manifest.json", "utf8"),
  );
  const topicsDir = MDIR + "\\topics";
  const expected = {}; // topicId -> [{order, sha}]
  for (const t of manifest.topics) {
    const js = JSON.parse(
      fs.readFileSync(`${topicsDir}\\${t.topic_id}.json`, "utf8"),
    );
    expected[t.topic_id] = js.blocks.map((b) => ({
      order: b.order,
      sha: b.content_sha256,
    }));
  }

  const dbBlocks = await client.query(
    `SELECT topic_id, id, "order", type, content FROM content_blocks WHERE type = 'document_html' ORDER BY topic_id, "order"`,
  );
  const byTopic = {};
  for (const row of dbBlocks.rows) {
    (byTopic[row.topic_id] = byTopic[row.topic_id] || []).push({
      order: row.order,
      sha: crypto
        .createHash("sha256")
        .update(row.content || "", "utf8")
        .digest("hex"),
      id: row.id,
    });
  }

  const prodTopics = Object.keys(byTopic);
  const expTopics = Object.keys(expected);

  const missingTopics = expTopics.filter((id) => !byTopic[id]);
  const extraTopics = prodTopics.filter((id) => !expected[id]);
  const mismatchTopics = [];
  const exactTopics = [];
  for (const id of expTopics) {
    if (!byTopic[id]) continue;
    const exp = expected[id];
    const prod = byTopic[id];
    const expS = JSON.stringify(exp.map((b) => b.order + ":" + b.sha));
    const prodS = JSON.stringify(prod.map((b) => b.order + ":" + b.sha));
    if (expS === prodS) exactTopics.push(id);
    else mismatchTopics.push(id);
  }

  console.log("=== DB vs RELEASE DIFF ===");
  console.log(
    "expected topics:",
    expTopics.length,
    "| prod topics with doc_html:",
    prodTopics.length,
  );
  console.log(
    "missing topics in DB:",
    missingTopics.length,
    missingTopics.slice(0, 20).join(","),
  );
  console.log(
    "extra/unknown topics in DB:",
    extraTopics.length,
    extraTopics.slice(0, 20).join(","),
  );
  console.log("exact-match topics:", exactTopics.length);
  console.log("mismatch topics:", mismatchTopics.length);
  fs.writeFileSync(
    "D:\\Projects\\Maternal Mind\\.tmp_db_diff.json",
    JSON.stringify(
      { missingTopics, extraTopics, mismatchTopics, exactTopics },
      null,
      1,
    ),
  );
  console.log("mismatch list:", mismatchTopics.join(","));
  await client.end();
}
main().catch((e) => {
  console.log("ERR", e.message);
  process.exit(1);
});
