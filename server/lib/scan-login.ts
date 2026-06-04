import bcrypt from "bcryptjs";
import { storage } from "../storage";

export interface ScanLoginSettings {
  enabled: boolean;
  targetEmail: string;
  title: string;
  instructions: string;
  buttonText: string;
  hasCode: boolean;
}

export const SCAN_LOGIN_KEYS = {
  enabled: "scan_login_enabled",
  codeHash: "scan_login_code_hash",
  targetEmail: "scan_login_target_email",
  title: "scan_login_title",
  instructions: "scan_login_instructions",
  buttonText: "scan_login_button_text",
} as const;

const DEFAULT_SCAN_LOGIN_TITLE = "Scan to login";
const DEFAULT_SCAN_LOGIN_INSTRUCTIONS =
  "Scan the QR code or enter the printed access code provided by Maternal Mind.";
const DEFAULT_SCAN_LOGIN_BUTTON_TEXT = "Scan to login";

function parseEnabled(raw?: string): boolean {
  return ["true", "1", "yes", "enabled", "on"].includes(
    String(raw || "")
      .trim()
      .toLowerCase(),
  );
}

function normalizeCode(code: string): string {
  return code.trim().replace(/\s+/g, "").toUpperCase();
}

export async function getScanLoginSettings(): Promise<
  ScanLoginSettings & { codeHash: string }
> {
  const settings = await storage.getAppSettings(Object.values(SCAN_LOGIN_KEYS));
  const map = new Map(settings.map((entry) => [entry.key, entry.value]));
  const codeHash = map.get(SCAN_LOGIN_KEYS.codeHash) || "";

  return {
    enabled: parseEnabled(map.get(SCAN_LOGIN_KEYS.enabled)),
    targetEmail: (map.get(SCAN_LOGIN_KEYS.targetEmail) || "").trim(),
    title:
      (map.get(SCAN_LOGIN_KEYS.title) || "").trim() || DEFAULT_SCAN_LOGIN_TITLE,
    instructions:
      (map.get(SCAN_LOGIN_KEYS.instructions) || "").trim() ||
      DEFAULT_SCAN_LOGIN_INSTRUCTIONS,
    buttonText:
      (map.get(SCAN_LOGIN_KEYS.buttonText) || "").trim() ||
      DEFAULT_SCAN_LOGIN_BUTTON_TEXT,
    hasCode: codeHash.length > 0,
    codeHash,
  };
}

export async function setScanLoginSettings(input: {
  enabled: boolean;
  targetEmail: string;
  title: string;
  instructions: string;
  buttonText: string;
  code?: string;
}): Promise<ScanLoginSettings> {
  const settings: { key: string; value: string }[] = [
    { key: SCAN_LOGIN_KEYS.enabled, value: String(input.enabled) },
    { key: SCAN_LOGIN_KEYS.targetEmail, value: input.targetEmail.trim() },
    { key: SCAN_LOGIN_KEYS.title, value: input.title.trim() },
    { key: SCAN_LOGIN_KEYS.instructions, value: input.instructions.trim() },
    { key: SCAN_LOGIN_KEYS.buttonText, value: input.buttonText.trim() },
  ];

  if (input.code && input.code.trim()) {
    settings.push({
      key: SCAN_LOGIN_KEYS.codeHash,
      value: await bcrypt.hash(normalizeCode(input.code), 12),
    });
  }

  await storage.setAppSettings(settings);
  const updated = await getScanLoginSettings();
  const { codeHash: _codeHash, ...publicSettings } = updated;
  return publicSettings;
}

export async function verifyScanLoginCode(code: string): Promise<boolean> {
  const settings = await getScanLoginSettings();
  if (!settings.enabled || !settings.codeHash || !code.trim()) {
    return false;
  }
  return bcrypt.compare(normalizeCode(code), settings.codeHash);
}

export function parseScannedLoginCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed?.code === "string") {
      return normalizeCode(parsed.code);
    }
  } catch {
    // Plain QR/manual codes are expected, JSON is optional for future printed cards.
  }

  try {
    const url = new URL(trimmed);
    const code =
      url.searchParams.get("code") || url.searchParams.get("loginCode");
    if (code) return normalizeCode(code);
  } catch {
    // Not a URL; treat as the raw printed code.
  }

  return normalizeCode(trimmed);
}
