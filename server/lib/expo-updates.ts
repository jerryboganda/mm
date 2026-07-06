/**
 * Self-hosted Expo Updates protocol helpers.
 *
 * Implements the manifest + code-signing pieces of the Expo Updates protocol
 * (https://docs.expo.dev/technical-specs/expo-updates-1/) so the app's Express
 * server can act as a self-hosted OTA update server. Adapted from Expo's
 * MIT-licensed reference implementation `expo/custom-expo-updates-server`.
 *
 * Bundles produced by `npx expo export` are laid out on disk as:
 *
 *   updates/<runtimeVersion>/<epochMillis>/
 *     ├─ _expo/static/js/<platform>/<entry>-<hash>.hbc   (JS bundle)
 *     ├─ assets/<contentHash>                             (images, fonts, …)
 *     ├─ metadata.json                                    (from expo export)
 *     └─ expo-updates-extra.json                          (optional; our extras)
 *
 * This module reads that layout and produces protocol-compliant manifests.
 * It depends only on Node built-ins so it survives the esbuild `--packages=external`
 * server bundle without pulling new runtime dependencies.
 */
import { createHash, createSign } from "node:crypto";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";

/** Absolute path to the directory that holds published updates on the host. */
export const UPDATES_ROOT = path.resolve(process.cwd(), "updates");

/** The `expo-updates` code-signing key id. Must match app.json codeSigningMetadata.keyid. */
export const CODE_SIGNING_KEY_ID = process.env.CODE_SIGNING_KEY_ID || "main";

export type UpdatePlatform = "ios" | "android";

interface FileAssetMetadata {
  path: string;
  ext: string;
}

interface PlatformMetadata {
  bundle: string;
  assets: FileAssetMetadata[];
}

interface UpdateMetadataJson {
  version: number;
  bundler: string;
  fileMetadata: Partial<Record<UpdatePlatform, PlatformMetadata>>;
}

export interface ManifestAsset {
  hash: string;
  key: string;
  contentType: string;
  fileExtension: string;
  url: string;
}

export interface UpdateManifest {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  launchAsset: ManifestAsset;
  assets: ManifestAsset[];
  metadata: Record<string, unknown>;
  extra: Record<string, unknown>;
}

// Minimal extension → content-type map. Kept local so we don't add a `mime`
// runtime dependency to the server bundle.
const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  js: "application/javascript",
  hbc: "application/javascript",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  webm: "video/webm",
  lottie: "application/json",
  bin: "application/octet-stream",
};

export function contentTypeForExtension(ext: string): string {
  const key = ext.replace(/^\./, "").toLowerCase();
  return CONTENT_TYPE_BY_EXT[key] ?? "application/octet-stream";
}

function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sha256Base64Url(buffer: Buffer): string {
  return toBase64Url(createHash("sha256").update(buffer).digest("base64"));
}

function md5Hex(buffer: Buffer): string {
  return createHash("md5").update(buffer).digest("hex");
}

/** Convert a 64-char sha256 hex string into a UUID-shaped id (protocol requirement). */
function sha256HexToUUID(hex: string): string {
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/** Safely resolve `relativePath` inside an update directory, rejecting traversal. */
export function resolveUpdateFile(
  runtimeVersion: string,
  updateId: string,
  relativePath: string,
): string | null {
  const updateDir = path.resolve(UPDATES_ROOT, runtimeVersion, updateId);
  const resolved = path.resolve(updateDir, relativePath);
  const prefix = updateDir + path.sep;
  if (resolved !== updateDir && !resolved.startsWith(prefix)) {
    return null;
  }
  return resolved;
}

/**
 * Return the newest published update directory name (an epoch-millis string) for
 * a runtime version, or `null` if none exists. Directories are sorted numerically
 * descending so the latest publish always wins.
 */
export async function getLatestUpdateId(
  runtimeVersion: string,
): Promise<string | null> {
  const runtimeDir = path.resolve(UPDATES_ROOT, runtimeVersion);
  if (!existsSync(runtimeDir)) {
    return null;
  }
  const entries = await fs.readdir(runtimeDir, { withFileTypes: true });
  const timestamps = entries
    .filter((e) => e.isDirectory() && /^\d+$/.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => Number(b) - Number(a));
  return timestamps[0] ?? null;
}

async function buildAsset({
  runtimeVersion,
  updateId,
  relativePath,
  ext,
  baseUrl,
  isLaunchAsset,
}: {
  runtimeVersion: string;
  updateId: string;
  relativePath: string;
  ext: string;
  baseUrl: string;
  isLaunchAsset: boolean;
}): Promise<ManifestAsset> {
  const absolute = resolveUpdateFile(runtimeVersion, updateId, relativePath);
  if (!absolute) {
    throw new Error(`Illegal asset path: ${relativePath}`);
  }
  const buffer = await fs.readFile(absolute);
  const urlPath = relativePath.split(path.sep).join("/");
  const query = new URLSearchParams({
    runtimeVersion,
    updateId,
    asset: urlPath,
  });
  return {
    hash: sha256Base64Url(buffer),
    key: md5Hex(buffer),
    contentType: isLaunchAsset
      ? "application/javascript"
      : contentTypeForExtension(ext),
    fileExtension: ext.startsWith(".") ? ext : `.${ext}`,
    url: `${baseUrl}/updates/assets?${query.toString()}`,
  };
}

/**
 * Build a protocol-compliant manifest for the latest update of a runtime version
 * and platform. Returns `null` when no update exists for that runtime version.
 */
export async function buildManifest({
  runtimeVersion,
  platform,
  updateId,
  baseUrl,
}: {
  runtimeVersion: string;
  platform: UpdatePlatform;
  updateId: string;
  baseUrl: string;
}): Promise<UpdateManifest | null> {
  const updateDir = path.resolve(UPDATES_ROOT, runtimeVersion, updateId);
  const metadataPath = path.join(updateDir, "metadata.json");
  if (!existsSync(metadataPath)) {
    return null;
  }

  const metadataString = await fs.readFile(metadataPath, "utf-8");
  const metadata = JSON.parse(metadataString) as UpdateMetadataJson;
  const platformMetadata = metadata.fileMetadata?.[platform];
  if (!platformMetadata) {
    // No bundle for this platform in this update.
    return null;
  }

  // Deterministic id derived from the update contents; `createdAt` is the publish
  // timestamp encoded in the directory name (falls back to file mtime).
  const id = sha256HexToUUID(
    createHash("sha256").update(metadataString).digest("hex"),
  );
  let createdAt: string;
  if (/^\d+$/.test(updateId)) {
    createdAt = new Date(Number(updateId)).toISOString();
  } else {
    const stat = await fs.stat(metadataPath);
    createdAt = stat.mtime.toISOString();
  }

  const launchAsset = await buildAsset({
    runtimeVersion,
    updateId,
    relativePath: platformMetadata.bundle.split("/").join(path.sep),
    ext: ".hbc",
    baseUrl,
    isLaunchAsset: true,
  });

  const assets = await Promise.all(
    platformMetadata.assets.map((asset) =>
      buildAsset({
        runtimeVersion,
        updateId,
        relativePath: asset.path.split("/").join(path.sep),
        ext: asset.ext,
        baseUrl,
        isLaunchAsset: false,
      }),
    ),
  );

  // Optional publish-time extras (release notes, human version) written by CI.
  let extra: Record<string, unknown> = {};
  const extraPath = path.join(updateDir, "expo-updates-extra.json");
  if (existsSync(extraPath)) {
    try {
      extra = JSON.parse(await fs.readFile(extraPath, "utf-8"));
    } catch {
      extra = {};
    }
  }

  return {
    id,
    createdAt,
    runtimeVersion,
    launchAsset,
    assets,
    metadata: {},
    extra,
  };
}

/**
 * RSA-SHA256 sign a string with the code-signing private key (PEM). Returns the
 * value for the `expo-signature` structured-field header, or `null` when no key
 * is configured (signing disabled — e.g. local dev).
 */
export function signStructuredField(
  data: string,
  privateKeyPem: string | null,
): string | null {
  if (!privateKeyPem) {
    return null;
  }
  const signer = createSign("RSA-SHA256");
  signer.update(data, "utf8");
  signer.end();
  const signature = signer.sign(privateKeyPem, "base64");
  return `sig="${signature}", keyid="${CODE_SIGNING_KEY_ID}", alg="rsa-v1_5-sha256"`;
}
