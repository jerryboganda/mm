import { storage } from "../storage";

export const MOBILE_APP_TEXT_OVERRIDES_KEY = "mobile_app_text_overrides";
export const MOBILE_READER_WATERMARK_KEY = "mobile_reader_watermark";

export interface ReaderWatermarkSettings {
  enabled: boolean;
  opacity: number;
}

export const DEFAULT_READER_WATERMARK: ReaderWatermarkSettings = {
  enabled: true,
  opacity: 0.06,
};

export interface MobileAppContentResponse {
  textOverrides: Record<string, string>;
  readerWatermark: ReaderWatermarkSettings;
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

function parseTextOverrides(
  rawValue: string | undefined,
): Record<string, string> {
  if (!rawValue) return {};
  try {
    const parsed = JSON.parse(rawValue);
    return normalizeTextOverrides(parsed);
  } catch {
    return {};
  }
}

function clampOpacity(value: unknown): number {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : DEFAULT_READER_WATERMARK.opacity;

  if (!Number.isFinite(numericValue)) return DEFAULT_READER_WATERMARK.opacity;
  return Math.min(0.2, Math.max(0, numericValue));
}

function normalizeReaderWatermark(raw: unknown): ReaderWatermarkSettings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_READER_WATERMARK;
  }

  const input = raw as Partial<ReaderWatermarkSettings>;
  return {
    enabled:
      typeof input.enabled === "boolean"
        ? input.enabled
        : DEFAULT_READER_WATERMARK.enabled,
    opacity: clampOpacity(input.opacity),
  };
}

function parseReaderWatermark(
  rawValue: string | undefined,
): ReaderWatermarkSettings {
  if (!rawValue) return DEFAULT_READER_WATERMARK;
  try {
    const parsed = JSON.parse(rawValue);
    return normalizeReaderWatermark(parsed);
  } catch {
    return DEFAULT_READER_WATERMARK;
  }
}

export async function getMobileAppContent(): Promise<MobileAppContentResponse> {
  const settings = await storage.getAppSettings([
    MOBILE_APP_TEXT_OVERRIDES_KEY,
    MOBILE_READER_WATERMARK_KEY,
  ]);
  const textEntry = settings.find(
    (s) => s.key === MOBILE_APP_TEXT_OVERRIDES_KEY,
  );
  const watermarkEntry = settings.find(
    (s) => s.key === MOBILE_READER_WATERMARK_KEY,
  );
  const updatedAtValues = [textEntry?.updatedAt, watermarkEntry?.updatedAt]
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime());

  return {
    textOverrides: parseTextOverrides(textEntry?.value),
    readerWatermark: parseReaderWatermark(watermarkEntry?.value),
    updatedAt: updatedAtValues[0]?.toISOString() || null,
  };
}

export async function setMobileAppContentSettings(settings: {
  textOverrides: unknown;
  readerWatermark?: unknown;
}): Promise<MobileAppContentResponse> {
  const textOverrides = normalizeTextOverrides(settings.textOverrides);
  const readerWatermark =
    settings.readerWatermark === undefined
      ? (await getMobileAppContent()).readerWatermark
      : normalizeReaderWatermark(settings.readerWatermark);

  await storage.setAppSettings([
    {
      key: MOBILE_APP_TEXT_OVERRIDES_KEY,
      value: JSON.stringify(textOverrides),
    },
    {
      key: MOBILE_READER_WATERMARK_KEY,
      value: JSON.stringify(readerWatermark),
    },
  ]);

  return getMobileAppContent();
}

export async function setMobileAppTextOverrides(
  textOverrides: unknown,
): Promise<MobileAppContentResponse> {
  const current = await getMobileAppContent();
  return setMobileAppContentSettings({
    textOverrides,
    readerWatermark: current.readerWatermark,
  });
}
