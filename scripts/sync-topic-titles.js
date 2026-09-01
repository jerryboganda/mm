const fs = require("fs");
const { Client } = require("D:\\Projects\\Maternal Mind\\node_modules\\pg");
const env = fs.readFileSync("D:\\Projects\\Maternal Mind\\.env", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)[1];
const client = new Client({ connectionString: url });
async function main() {
  await client.connect();
  const manifest = JSON.parse(
    fs.readFileSync(
      "D:\\Projects\\Maternal Mind\\content\\book-releases\\f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605\\release_manifest.json",
      "utf8",
    ),
  );
  await client.query("BEGIN");
  let n = 0;
  for (const t of manifest.topics) {
    await client.query("UPDATE topics SET title = $1 WHERE id = $2", [
      t.title,
      t.topic_id,
    ]);
    n++;
  }
  await client.query("COMMIT");
  console.log("updated titles:", n);
  await client.end();
}
main().catch((e) => {
  console.log("ERR", e.message);
  process.exit(1);
});
