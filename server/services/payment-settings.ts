/**
 * Manual-payment settings.
 *
 * The admin-configurable payment instructions (bank account + mobile wallets +
 * free-text instructions) are stored as a single JSON blob in the key-value
 * `app_settings` table under the key `payment_instructions`.
 */

import { eq } from "drizzle-orm";
import { db } from "../db";
import { appSettings } from "../../shared/schema";
import {
  paymentInstructionsSchema,
  type PaymentInstructions,
} from "../../shared/schema";
import { logger } from "../lib/logger";

export const PAYMENT_INSTRUCTIONS_KEY = "payment_instructions";

const DEFAULT_INSTRUCTIONS: PaymentInstructions = {
  currency: "PKR",
  instructions:
    "Transfer the package amount (700 PKR for 6 Months or 1000 PKR for 1 Year) to one of the accounts below, then upload your payment proof in-app or send via WhatsApp / Email. Your subscription will activate once verified.",
  whatsappNumber: "+923360830836",
  supportEmail: "maternalmind.help@gmail.com",
  bank: {
    bankName: "HBL",
    accountTitle: "Farzana Muneer",
    accountNumber: "08477902077901",
    iban: "PK85HABB0008477902077901",
    branch: "Chowk Azam Layyah",
  },
  wallets: [
    {
      name: "JazzCash",
      accountTitle: "Farzana Muneer",
      number: "03360830836",
      iban: "PK77JCMA3101923360830836",
    },
  ],
};

/** Read the admin-configured payment instructions (returns defaults if unset). */
export async function getPaymentInstructions(): Promise<PaymentInstructions> {
  try {
    const [row] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, PAYMENT_INSTRUCTIONS_KEY));

    if (!row) return DEFAULT_INSTRUCTIONS;

    const parsed = paymentInstructionsSchema.safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : DEFAULT_INSTRUCTIONS;
  } catch (error) {
    logger.error("getPaymentInstructions error", { error: String(error) });
    return DEFAULT_INSTRUCTIONS;
  }
}

/** Persist payment instructions (upsert by key). */
export async function setPaymentInstructions(
  value: PaymentInstructions,
): Promise<PaymentInstructions> {
  const json = JSON.stringify(value);

  const [existing] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, PAYMENT_INSTRUCTIONS_KEY));

  if (existing) {
    await db
      .update(appSettings)
      .set({ value: json, updatedAt: new Date() })
      .where(eq(appSettings.key, PAYMENT_INSTRUCTIONS_KEY));
  } else {
    await db
      .insert(appSettings)
      .values({ key: PAYMENT_INSTRUCTIONS_KEY, value: json });
  }

  return value;
}
