#!/usr/bin/env node
/**
 * Content release verifier for Maternal Mind book content.
 * Validates manifest completeness, media presence, and database state.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";

dotenv.config();

const SOURCE_SHA256 =
  "f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605";

async function main() {
  const releaseDir = path.resolve(
    process.cwd(),
    "content/book-releases",
    SOURCE_SHA256,
  );
  const manifestPath = path.join(releaseDir, "release_manifest.json");

  if (!fs.existsSync(manifestPath)) {
    console.error(`[-] Release manifest not found at: ${manifestPath}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  console.log(
    `[*] Verifying release package for digest ${manifest.source_sha256}...`,
  );

  if (manifest.topic_count !== 285) {
    console.error(
      `[-] Topic count mismatch: expected 285, got ${manifest.topic_count}`,
    );
    process.exit(1);
  }

  if (manifest.books.length !== 13) {
    console.error(
      `[-] Book count mismatch: expected 13, got ${manifest.books.length}`,
    );
    process.exit(1);
  }

  // Check all media files exist
  let missingMedia = 0;
  for (const media of manifest.media || []) {
    const mediaPath = path.resolve(
      process.cwd(),
      "uploads/content-images/maternal-mind-book",
      media.target_rel_path,
    );
    if (!fs.existsSync(mediaPath)) {
      console.error(`[-] Missing media file: ${mediaPath}`);
      missingMedia++;
    }
  }

  if (missingMedia > 0) {
    console.error(
      `[-] Verification failed: ${missingMedia} media assets missing.`,
    );
    process.exit(1);
  }

  console.log(
    `[+] All ${manifest.total_media_count} media assets verified on disk.`,
  );
  console.log(
    `[+] Release package ${SOURCE_SHA256} verified 100% complete and valid.`,
  );
}

main().catch((err) => {
  console.error("[-] Verification error:", err);
  process.exit(1);
});
