/**
 * Canonical Single Source of Truth for Maternal Mind Pricing Packages
 *
 * The platform recognizes ONLY TWO valid pricing packages:
 * 1. 6 Months Access — PKR 700 (180 days)
 * 2. 1 Year Access   — PKR 1,000 (365 days)
 */

export interface CanonicalPackageDefinition {
  readonly slug: string;
  readonly name: string;
  readonly shortDescription: string;
  readonly description: string;
  readonly displayOrder: number;
  readonly billingCycle: "semi_annual" | "annual";
  readonly durationDays: number;
  readonly durationMonths: number;
  readonly price: string;
  readonly priceNumber: number;
  readonly currency: string;
  readonly originalPrice: string;
  readonly originalPriceNumber: number;
  readonly features: readonly {
    readonly key: string;
    readonly name: string;
    readonly valueType: "check" | "text" | "number";
    readonly value?: string;
  }[];
}

export const CANONICAL_CURRENCY = "PKR" as const;

export const CANONICAL_PACKAGES: readonly CanonicalPackageDefinition[] = [
  {
    slug: "six_months",
    name: "6 Months Plan",
    shortDescription: "Full access for 6 months",
    description:
      "6 months of full premium access to all OB-GYN chapters, high-yield topics, unlimited MCQs, and clinical notes.",
    displayOrder: 1,
    billingCycle: "semi_annual",
    durationDays: 180,
    durationMonths: 6,
    price: "700.00",
    priceNumber: 700,
    currency: "PKR",
    originalPrice: "1200.00",
    originalPriceNumber: 1200,
    features: [
      {
        key: "full_content_access",
        name: "Full Textbook & Notes Access",
        valueType: "check",
      },
      {
        key: "unlimited_mcqs",
        name: "Unlimited MCQ Practice & Mock Exams",
        valueType: "check",
      },
      {
        key: "performance_analytics",
        name: "Detailed Analytics & Weak Areas Tracker",
        valueType: "check",
      },
      {
        key: "priority_support",
        name: "Priority WhatsApp & Email Support",
        valueType: "check",
      },
    ],
  },
  {
    slug: "annual",
    name: "1 Year Plan",
    shortDescription: "Best value, full access for 1 full year",
    description:
      "A full year of unlimited premium access to all OB-GYN chapters, topics, MCQs, mock exams, and clinical notes.",
    displayOrder: 2,
    billingCycle: "annual",
    durationDays: 365,
    durationMonths: 12,
    price: "1000.00",
    priceNumber: 1000,
    currency: "PKR",
    originalPrice: "2000.00",
    originalPriceNumber: 2000,
    features: [
      {
        key: "full_content_access",
        name: "Full Textbook & Notes Access",
        valueType: "check",
      },
      {
        key: "unlimited_mcqs",
        name: "Unlimited MCQ Practice & Mock Exams",
        valueType: "check",
      },
      {
        key: "performance_analytics",
        name: "Detailed Analytics & Weak Areas Tracker",
        valueType: "check",
      },
      {
        key: "priority_support",
        name: "Priority WhatsApp & Email Support",
        valueType: "check",
      },
    ],
  },
] as const;

export const CANONICAL_BILLING_CYCLE_DAYS: Record<string, number> = {
  semi_annual: 180,
  annual: 365,
  yearly: 365,
};

export const CANONICAL_CYCLE_LABELS: Record<string, string> = {
  semi_annual: "for 6 months",
  annual: "for 1 year",
  yearly: "for 1 year",
};

export const VALID_SUBSCRIPTION_PLANS = [
  "6 Months Plan",
  "1 Year Plan",
] as const;

export type ValidSubscriptionPlan = (typeof VALID_SUBSCRIPTION_PLANS)[number];

/**
 * Normalizes any legacy or variant plan name/slug to canonical "6 Months Plan" | "1 Year Plan" | null.
 */
export function normalizeSubscriptionPlan(
  raw: string | null | undefined,
): ValidSubscriptionPlan | null {
  if (!raw || typeof raw !== "string") return null;
  const clean = raw.trim().toLowerCase().replace(/[_-]/g, " ");

  if (
    clean.includes("6 month") ||
    clean.includes("semi annual") ||
    clean.includes("six month") ||
    clean === "quarterly" ||
    clean === "monthly"
  ) {
    return "6 Months Plan";
  }

  if (
    clean.includes("1 year") ||
    clean.includes("annual") ||
    clean.includes("yearly") ||
    clean.includes("12 month") ||
    clean.includes("one year")
  ) {
    return "1 Year Plan";
  }

  return null;
}

/**
 * Format price in PKR currency for clean user-facing display.
 */
export function formatPackagePrice(price: string | number): string {
  const n = typeof price === "number" ? price : Number(price);
  const amount = Number.isNaN(n)
    ? String(price)
    : n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return `PKR ${amount}`;
}
