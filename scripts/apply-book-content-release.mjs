#!/usr/bin/env node
/**
 * Safe database release applicator for Maternal Mind book content.
 * Atomically updates content_blocks for the 285 authoritative topics.
 * Strictly leaves users, subscriptions, progress, MCQs, and chapters untouched.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const SOURCE_SHA256 = "f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605";

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");

  const releaseDir = path.resolve(
    process.cwd(),
    "content/book-releases",
    SOURCE_SHA256
  );
  const manifestPath = path.join(releaseDir, "release_manifest.json");
  const sqlPath = path.join(releaseDir, "release.sql");

  if (!fs.existsSync(manifestPath)) {
    console.error(`[-] Release manifest not found at: ${manifestPath}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  console.log(`[*] Loaded release manifest for source digest: ${manifest.source_sha256}`);
  console.log(`[*] Scope: ${manifest.topic_count} topics, ${manifest.total_block_count} blocks, ${manifest.total_media_count} media assets.`);

  if (manifest.source_sha256 !== SOURCE_SHA256) {
    console.error(`[-] Digest mismatch! Expected ${SOURCE_SHA256}, got ${manifest.source_sha256}`);
    process.exit(1);
  }

  if (!fs.existsSync(sqlPath)) {
    console.error(`[-] Release SQL script not found at: ${sqlPath}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlPath, "utf8");

  if (isDryRun) {
    console.log(`[+] DRY-RUN SUCCESS: Manifest and SQL valid. ${manifest.total_block_count} blocks ready for release.`);
    process.exit(0);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("[-] DATABASE_URL environment variable is not set.");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  console.log("[*] Connected to database. Beginning atomic release transaction...");
  try {
    await client.query("BEGIN;");
    await client.query(sqlContent);
    await client.query("COMMIT;");
    console.log(`[+] Successfully applied release ${SOURCE_SHA256} to production database!`);
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("[-] Release transaction failed and was rolled back:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[-] Fatal error during release application:", err);
  process.exit(1);
});
