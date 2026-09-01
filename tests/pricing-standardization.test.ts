import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_PACKAGES,
  CANONICAL_CURRENCY,
  CANONICAL_BILLING_CYCLE_DAYS,
  CANONICAL_CYCLE_LABELS,
  normalizeSubscriptionPlan,
  formatPackagePrice,
} from "../shared/pricing-contracts";

describe("Standardized Pricing Contracts", () => {
  it("must contain exactly two canonical packages", () => {
    assert.equal(CANONICAL_PACKAGES.length, 2);
    assert.equal(CANONICAL_CURRENCY, "PKR");
  });

  it("must define 6 Months Plan for PKR 700.00 (180 days)", () => {
    const pkg = CANONICAL_PACKAGES.find((p) => p.slug === "six_months");
    assert.ok(pkg, "six_months package must exist");
    assert.equal(pkg.name, "6 Months Plan");
    assert.equal(pkg.price, "700.00");
    assert.equal(pkg.priceNumber, 700);
    assert.equal(pkg.currency, "PKR");
    assert.equal(pkg.billingCycle, "semi_annual");
    assert.equal(pkg.durationDays, 180);
    assert.equal(pkg.durationMonths, 6);
    assert.equal(pkg.displayOrder, 1);
  });

  it("must define 1 Year Plan for PKR 1,000.00 (365 days)", () => {
    const pkg = CANONICAL_PACKAGES.find((p) => p.slug === "annual");
    assert.ok(pkg, "annual package must exist");
    assert.equal(pkg.name, "1 Year Plan");
    assert.equal(pkg.price, "1000.00");
    assert.equal(pkg.priceNumber, 1000);
    assert.equal(pkg.currency, "PKR");
    assert.equal(pkg.billingCycle, "annual");
    assert.equal(pkg.durationDays, 365);
    assert.equal(pkg.durationMonths, 12);
    assert.equal(pkg.displayOrder, 2);
  });

  it("must calculate canonical billing cycle durations correctly", () => {
    assert.equal(CANONICAL_BILLING_CYCLE_DAYS["semi_annual"], 180);
    assert.equal(CANONICAL_BILLING_CYCLE_DAYS["annual"], 365);
    assert.equal(CANONICAL_BILLING_CYCLE_DAYS["yearly"], 365);
  });

  it("must format prices accurately in PKR", () => {
    assert.equal(formatPackagePrice("700.00"), "PKR 700");
    assert.equal(formatPackagePrice(700), "PKR 700");
    assert.equal(formatPackagePrice("1000.00"), "PKR 1,000");
    assert.equal(formatPackagePrice(1000), "PKR 1,000");
  });

  it("must normalize legacy and variant plan strings to canonical names", () => {
    assert.equal(normalizeSubscriptionPlan("six_months"), "6 Months Plan");
    assert.equal(normalizeSubscriptionPlan("6-months-plan"), "6 Months Plan");
    assert.equal(normalizeSubscriptionPlan("6 Months Plan"), "6 Months Plan");
    assert.equal(normalizeSubscriptionPlan("quarterly"), "6 Months Plan");
    assert.equal(normalizeSubscriptionPlan("monthly"), "6 Months Plan");

    assert.equal(normalizeSubscriptionPlan("annual"), "1 Year Plan");
    assert.equal(normalizeSubscriptionPlan("yearly"), "1 Year Plan");
    assert.equal(normalizeSubscriptionPlan("1 Year Plan"), "1 Year Plan");
    assert.equal(normalizeSubscriptionPlan("1-year-plan"), "1 Year Plan");

    assert.equal(normalizeSubscriptionPlan(null), null);
    assert.equal(normalizeSubscriptionPlan(""), null);
    assert.equal(normalizeSubscriptionPlan("random_plan"), null);
  });
});
