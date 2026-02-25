import { storage } from "../storage";

export interface SupportContactSettings {
  whatsappNumber: string;
  phoneNumber: string;
  supportEmail: string;
  whatsappDefaultMessage: string;
  whatsappEnabled: boolean;
  phoneEnabled: boolean;
  emailEnabled: boolean;
}

export const SUPPORT_CONTACT_KEYS = {
  whatsappNumber: "support_whatsapp_number",
  phoneNumber: "support_phone_number",
  supportEmail: "support_email",
  whatsappDefaultMessage: "support_whatsapp_default_message",
} as const;

const DEFAULT_SUPPORT_EMAIL = "support@maternalmind.com.pk";
const DEFAULT_WHATSAPP_MESSAGE = "Hello Support Team, I need help.";

const SUPPORT_CONTACT_KEY_ALIASES = {
  whatsappNumber: [
    SUPPORT_CONTACT_KEYS.whatsappNumber,
    "support_contact_whatsapp_number",
    "whatsapp_number",
    "support_whatsapp",
  ],
  phoneNumber: [
    SUPPORT_CONTACT_KEYS.phoneNumber,
    "support_contact_phone_number",
    "phone_number",
    "support_phone",
  ],
  supportEmail: [
    SUPPORT_CONTACT_KEYS.supportEmail,
    "support_contact_email",
    "contact_email",
    "help_email",
  ],
  whatsappDefaultMessage: [
    SUPPORT_CONTACT_KEYS.whatsappDefaultMessage,
    "support_contact_whatsapp_default_message",
    "whatsapp_default_message",
    "support_whatsapp_message",
  ],
  whatsappEnabled: [
    "support_whatsapp_enabled",
    "support_contact_whatsapp_enabled",
    "whatsapp_enabled",
  ],
  phoneEnabled: [
    "support_phone_enabled",
    "support_contact_phone_enabled",
    "phone_enabled",
  ],
  emailEnabled: [
    "support_email_enabled",
    "support_contact_email_enabled",
    "email_enabled",
  ],
} as const;

function firstNonEmpty(
  settingsMap: Map<string, string>,
  keys: readonly string[],
): string {
  for (const key of keys) {
    const value = settingsMap.get(key)?.trim();
    if (value) return value;
  }
  return "";
}

function readBooleanSetting(
  settingsMap: Map<string, string>,
  keys: readonly string[],
): boolean | undefined {
  for (const key of keys) {
    const raw = settingsMap.get(key);
    if (typeof raw !== "string") continue;

    const normalized = raw.trim().toLowerCase();
    if (["true", "1", "yes", "enabled", "on"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "disabled", "off"].includes(normalized)) {
      return false;
    }
  }
  return undefined;
}

export async function getSupportContactSettings(): Promise<SupportContactSettings> {
  const keys = Array.from(
    new Set([
      ...SUPPORT_CONTACT_KEY_ALIASES.whatsappNumber,
      ...SUPPORT_CONTACT_KEY_ALIASES.phoneNumber,
      ...SUPPORT_CONTACT_KEY_ALIASES.supportEmail,
      ...SUPPORT_CONTACT_KEY_ALIASES.whatsappDefaultMessage,
      ...SUPPORT_CONTACT_KEY_ALIASES.whatsappEnabled,
      ...SUPPORT_CONTACT_KEY_ALIASES.phoneEnabled,
      ...SUPPORT_CONTACT_KEY_ALIASES.emailEnabled,
    ]),
  );

  const settings = await storage.getAppSettings(keys);
  const settingsMap = new Map(settings.map((entry) => [entry.key, entry.value]));

  const whatsappNumber = firstNonEmpty(
    settingsMap,
    SUPPORT_CONTACT_KEY_ALIASES.whatsappNumber,
  );
  const phoneNumber = firstNonEmpty(
    settingsMap,
    SUPPORT_CONTACT_KEY_ALIASES.phoneNumber,
  );
  const supportEmail =
    firstNonEmpty(settingsMap, SUPPORT_CONTACT_KEY_ALIASES.supportEmail) ||
    DEFAULT_SUPPORT_EMAIL;
  const whatsappDefaultMessage =
    firstNonEmpty(settingsMap, SUPPORT_CONTACT_KEY_ALIASES.whatsappDefaultMessage) ||
    DEFAULT_WHATSAPP_MESSAGE;
  const whatsappEnabledFlag = readBooleanSetting(
    settingsMap,
    SUPPORT_CONTACT_KEY_ALIASES.whatsappEnabled,
  );
  const phoneEnabledFlag = readBooleanSetting(
    settingsMap,
    SUPPORT_CONTACT_KEY_ALIASES.phoneEnabled,
  );
  const emailEnabledFlag = readBooleanSetting(
    settingsMap,
    SUPPORT_CONTACT_KEY_ALIASES.emailEnabled,
  );

  return {
    whatsappNumber,
    phoneNumber,
    supportEmail,
    whatsappDefaultMessage,
    whatsappEnabled:
      whatsappEnabledFlag !== undefined
        ? whatsappEnabledFlag
        : whatsappNumber.length > 0,
    phoneEnabled:
      phoneEnabledFlag !== undefined ? phoneEnabledFlag : phoneNumber.length > 0,
    emailEnabled:
      emailEnabledFlag !== undefined ? emailEnabledFlag : supportEmail.length > 0,
  };
}
