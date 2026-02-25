import { storage } from "../storage";

export const MOBILE_APP_TEXT_OVERRIDES_KEY = "mobile_app_text_overrides";

export interface MobileAppContentResponse {
  textOverrides: Record<string, string>;
  updatedAt: string | null;
}

function normalizeTextOverrides(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey) continue;
    if (typeof value !== "string") continue;
    normalized[normalizedKey] = value;
  }
  return normalized;
}

function parseTextOverrides(rawValue: string | undefined): Record<string, string> {
  if (!rawValue) return {};
  try {
    const parsed = JSON.parse(rawValue);
    return normalizeTextOverrides(parsed);
  } catch {
    return {};
  }
}

export async function getMobileAppContent(): Promise<MobileAppContentResponse> {
  const settings = await storage.getAppSettings([MOBILE_APP_TEXT_OVERRIDES_KEY]);
  const entry = settings.find((s) => s.key === MOBILE_APP_TEXT_OVERRIDES_KEY);

  return {
    textOverrides: parseTextOverrides(entry?.value),
    updatedAt: entry?.updatedAt?.toISOString() || null,
  };
}

export async function setMobileAppTextOverrides(
  textOverrides: unknown,
): Promise<MobileAppContentResponse> {
  const normalized = normalizeTextOverrides(textOverrides);

  await storage.setAppSettings([
    {
      key: MOBILE_APP_TEXT_OVERRIDES_KEY,
      value: JSON.stringify(normalized),
    },
  ]);

  return getMobileAppContent();
}

