/**
 * Self-hosted Expo Updates (OTA) endpoints.
 *
 * Mounted at `/updates` (see server/routes/index.ts). Deliberately kept OUTSIDE
 * the `/api` prefix so it is not caught by the global `no-store` cache header
 * and the `/api/*` 404 handler, and so it does not collide with the legacy
 * `/` + `/manifest` Expo middleware in server/index.ts.
 *
 *   GET /updates/manifest  → protocol manifest (multipart/mixed, optionally signed)
 *   GET /updates/assets    → JS bundles + assets (immutable, content-addressed)
 *
 * The app (expo-updates) is configured with `updates.url` pointing at
 * `…/updates/manifest`. Publishing happens by dropping `expo export` output into
 * `updates/<runtimeVersion>/<epochMillis>/` (done by the GitHub Actions pipeline).
 */
import { Router, type Request, type Response } from "express";
import { existsSync, readFileSync, promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

import {
  buildManifest,
  contentTypeForExtension,
  getLatestUpdateId,
  resolveUpdateFile,
  signStructuredField,
  type UpdatePlatform,
} from "../lib/expo-updates";
import { logger } from "../lib/logger";

const router = Router();

/** Load the code-signing private key once at startup (optional — enables signing). */
function loadPrivateKey(): string | null {
  const inline = process.env.CODE_SIGNING_PRIVATE_KEY;
  if (inline && inline.trim()) {
    // Allow either a raw PEM or a base64-encoded PEM (handy for env vars).
    if (inline.includes("BEGIN")) {
      return inline;
    }
    try {
      return Buffer.from(inline, "base64").toString("utf-8");
    } catch {
      return inline;
    }
  }
  const keyPath =
    process.env.CODE_SIGNING_PRIVATE_KEY_PATH ||
    path.resolve(process.cwd(), "secrets", "code-signing-private-key.pem");
  if (existsSync(keyPath)) {
    return readFileSync(keyPath, "utf-8");
  }
  return null;
}

const PRIVATE_KEY = loadPrivateKey();
if (PRIVATE_KEY) {
  logger.info("Expo Updates: code signing ENABLED");
} else {
  logger.warn(
    "Expo Updates: code signing DISABLED (no CODE_SIGNING_PRIVATE_KEY[_PATH]/secrets key found)",
  );
}

function getBaseUrl(req: Request): string {
  const proto = req.header("x-forwarded-proto") || req.protocol || "https";
  const host = req.header("x-forwarded-host") || req.get("host");
  return `${proto}://${host}`;
}

function isUpdatePlatform(value: unknown): value is UpdatePlatform {
  return value === "ios" || value === "android";
}

/** Serialize a single multipart/mixed field, with an optional `expo-signature`. */
function multipartField(
  boundary: string,
  name: string,
  body: string,
  signature: string | null,
): string {
  let part = `--${boundary}\r\n`;
  part += `Content-Type: application/json; charset=utf-8\r\n`;
  part += `Content-Disposition: form-data; name="${name}"\r\n`;
  if (signature) {
    part += `expo-signature: ${signature}\r\n`;
  }
  part += `\r\n${body}\r\n`;
  return part;
}

function sendMultipart(
  res: Response,
  protocolVersion: number,
  fields: { name: string; body: string; signature: string | null }[],
): void {
  const boundary = `boundary${randomUUID().replace(/-/g, "")}`;
  const payload =
    fields
      .map((f) => multipartField(boundary, f.name, f.body, f.signature))
      .join("") + `--${boundary}--\r\n`;

  res.setHeader("expo-protocol-version", String(protocolVersion));
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("cache-control", "no-store, no-cache, must-revalidate");
  res.setHeader("content-type", `multipart/mixed; boundary=${boundary}`);
  res.status(200).send(payload);
}

/** GET /updates/manifest — the Expo Updates protocol manifest endpoint. */
router.get("/manifest", async (req: Request, res: Response) => {
  const platform = req.header("expo-platform") || req.query.platform;
  const runtimeVersion =
    req.header("expo-runtime-version") || req.query["runtime-version"];
  const protocolVersion = Number(req.header("expo-protocol-version") ?? "0");
  const currentUpdateId = req.header("expo-current-update-id");

  if (!isUpdatePlatform(platform)) {
    return res
      .status(400)
      .json({ error: "Missing or invalid expo-platform (ios|android)" });
  }
  if (typeof runtimeVersion !== "string" || !runtimeVersion) {
    return res
      .status(400)
      .json({ error: "Missing expo-runtime-version header" });
  }

  try {
    const latestUpdateId = await getLatestUpdateId(runtimeVersion);

    // No update published for this runtime version yet.
    if (!latestUpdateId) {
      if (protocolVersion === 1) {
        const directive = JSON.stringify({ type: "noUpdateAvailable" });
        return sendMultipart(res, protocolVersion, [
          {
            name: "directive",
            body: directive,
            signature: signStructuredField(directive, PRIVATE_KEY),
          },
        ]);
      }
      return res.status(404).json({ error: "No update available" });
    }

    const manifest = await buildManifest({
      runtimeVersion,
      platform,
      updateId: latestUpdateId,
      baseUrl: getBaseUrl(req),
    });

    if (!manifest) {
      if (protocolVersion === 1) {
        const directive = JSON.stringify({ type: "noUpdateAvailable" });
        return sendMultipart(res, protocolVersion, [
          {
            name: "directive",
            body: directive,
            signature: signStructuredField(directive, PRIVATE_KEY),
          },
        ]);
      }
      return res.status(404).json({ error: "No update available" });
    }

    // Client is already on the latest update → tell it so (protocol v1).
    if (protocolVersion === 1 && currentUpdateId === manifest.id) {
      const directive = JSON.stringify({ type: "noUpdateAvailable" });
      return sendMultipart(res, protocolVersion, [
        {
          name: "directive",
          body: directive,
          signature: signStructuredField(directive, PRIVATE_KEY),
        },
      ]);
    }

    const manifestString = JSON.stringify(manifest);
    return sendMultipart(res, protocolVersion, [
      {
        name: "manifest",
        body: manifestString,
        signature: signStructuredField(manifestString, PRIVATE_KEY),
      },
    ]);
  } catch (err) {
    logger.error("Expo Updates manifest error", { error: String(err) });
    return res.status(500).json({ error: "Failed to build manifest" });
  }
});

/** GET /updates/assets?runtimeVersion=..&updateId=..&asset=.. — serve a bundle/asset. */
router.get("/assets", async (req: Request, res: Response) => {
  const runtimeVersion = req.query.runtimeVersion;
  const updateId = req.query.updateId;
  const asset = req.query.asset;

  if (
    typeof runtimeVersion !== "string" ||
    typeof updateId !== "string" ||
    typeof asset !== "string"
  ) {
    return res
      .status(400)
      .json({ error: "runtimeVersion, updateId and asset are required" });
  }

  const relative = asset.split("/").join(path.sep);
  const filePath = resolveUpdateFile(runtimeVersion, updateId, relative);
  if (!filePath || !existsSync(filePath)) {
    return res.status(404).json({ error: "Asset not found" });
  }

  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath) || ".bin";
    // Content-addressed by publish dir → safe to cache immutably for a long time.
    res.setHeader("content-type", contentTypeForExtension(ext));
    res.setHeader("cache-control", "public, max-age=31536000, immutable");
    return res.status(200).send(buffer);
  } catch (err) {
    logger.error("Expo Updates asset error", { error: String(err) });
    return res.status(500).json({ error: "Failed to read asset" });
  }
});

export default router;
