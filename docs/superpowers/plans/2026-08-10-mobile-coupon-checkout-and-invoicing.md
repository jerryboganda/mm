# Mobile Coupon Checkout, Instant Activation & Invoicing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow students to apply coupon codes on the mobile app pricing screen with real-time price reduction, instant activation for 100% free coupons, automatic invoice generation, and student profile invoice history, while equipping admins with package targeting, custom access duration overrides, and shareable promo links.

**Architecture:** Add `durationDaysOverride` to `coupons` table in Drizzle schema. Update Admin Panel `SubscriptionCouponsPage.tsx` with target package selection, custom duration inputs, and copy-link triggers. Implement backend endpoints `POST /api/subscriptions/validate-coupon` and `POST /api/subscriptions/redeem-free-coupon`. Enhance mobile `SubscriptionScreen.tsx` with promo input box, real-time discount preview, one-tap remove, and instant free access claim button. Update `ProfileScreen.tsx` with student invoice & coupon redemption history.

**Tech Stack:** React Native (Expo), TypeScript, Express.js, Drizzle ORM, PostgreSQL, TailwindCSS.

## Global Constraints
- 100% free coupons activate immediately with zero manual payment proof required.
- Invoices are automatically recorded in `invoices` table.
- All code passes `npx tsc --noEmit`.

---

### Task 1: Schema Migration & Database Setup

**Files:**
- Modify: `shared/schema.ts`
- Create: `scripts/migrate-coupon-duration.ts`

- [ ] **Step 1: Add `durationDaysOverride` to `coupons` table in `shared/schema.ts`**

```ts
durationDaysOverride: integer("duration_days_override"),
```

- [ ] **Step 2: Create and run migration script `scripts/migrate-coupon-duration.ts`**

```ts
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function run() {
  await db.execute(sql`ALTER TABLE coupons ADD COLUMN IF NOT EXISTS duration_days_override INTEGER;`);
  console.log("Coupon duration migration complete.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```
Run: `npx tsx scripts/migrate-coupon-duration.ts`

- [ ] **Step 3: Commit schema changes**

```bash
git add shared/schema.ts scripts/migrate-coupon-duration.ts
git commit -m "feat(schema): add durationDaysOverride column to coupons table"
```

---

### Task 2: Update Admin Panel UI for Target Packages, Custom Duration & Copy Links

**Files:**
- Modify: `server/services/coupon-service.ts`
- Modify: `server/routes/admin-subscriptions.ts`
- Modify: `admin/src/pages/SubscriptionCouponsPage.tsx`

- [ ] **Step 1: Update `coupon-service.ts` and `admin-subscriptions.ts`**

Include `durationDaysOverride` in Zod validation schemas and Drizzle insert/update operations.

- [ ] **Step 2: Update `SubscriptionCouponsPage.tsx`**

1. Add target package multi-select / checkboxes in coupon creation & edit forms.
2. Add numeric input `Duration Override (Days)` (e.g. 14, 30, 90, 365).
3. Add **"Copy Code / Link"** button in table rows for instant sharing.

- [ ] **Step 3: Commit Admin Panel updates**

```bash
git add server/services/coupon-service.ts server/routes/admin-subscriptions.ts admin/src/pages/SubscriptionCouponsPage.tsx
git commit -m "feat(admin): update coupon management with package targeting, duration overrides, and copy links"
```

---

### Task 3: Backend Coupon Validation, Instant 100% Free Activation & Invoicing Endpoints

**Files:**
- Modify: `server/routes/subscription.ts`
- Modify: `server/services/coupon-service.ts`

- [ ] **Step 1: Add `POST /api/subscriptions/validate-coupon` in `server/routes/subscription.ts`**

Validates coupon code against target package, expiry date (`validUntil`), usage limits, and user status. Returns itemized price calculation (`originalPrice`, `discountAmount`, `finalPrice`, `isFreeAccess`, `accessDurationDays`).

- [ ] **Step 2: Add `POST /api/subscriptions/redeem-free-coupon` in `server/routes/subscription.ts`**

For 100% free coupons:
1. Atomically validates coupon and increments `currentUseCount`.
2. Inserts `coupon_usage` record.
3. Creates formal `invoices` row (`INV-YYYY-XXXX`, `status: "paid"`, `total: "0.00"`).
4. Activates subscription: `user.subscriptionStatus = "active"`, `subscriptionExpiresAt = now + duration`.

- [ ] **Step 3: Commit Backend API endpoints**

```bash
git add server/routes/subscription.ts server/services/coupon-service.ts
git commit -m "feat(api): add coupon validation, 100% free instant redemption, and auto-invoicing endpoints"
```

---

### Task 4: Mobile App UI Checkout, Promo Input, Instant Free Claim & Invoices History

**Files:**
- Modify: `client/screens/SubscriptionScreen.tsx`
- Modify: `client/screens/PurchaseScreen.tsx`
- Modify: `client/screens/ProfileScreen.tsx`

- [ ] **Step 1: Add Promo Code Card in `SubscriptionScreen.tsx`**

1. TextInput `[ Promo / Coupon Code ]` with `[ Apply ]` button.
2. Render applied coupon badge with green discount tag and **"Remove"** icon button.
3. Display strikethrough original price (~~PKR 5,000~~) and updated final price.
4. For 100% free access, render primary button: **"Claim Instant Free Access"**. Tapping it invokes `redeem-free-coupon` and navigates to `PurchaseSuccessScreen`.

- [ ] **Step 2: Update `ProfileScreen.tsx` with Student Invoices & Coupons History**

Add a **"My Invoices & Redeemed Coupons"** section under Profile -> Subscription showing past invoices, itemized details, discount applied, and access expiry date.

- [ ] **Step 3: Run TypeScript typecheck & commit**

Run: `npx tsc --noEmit`  
Expected: 0 errors.

```bash
git add client/screens/SubscriptionScreen.tsx client/screens/PurchaseScreen.tsx client/screens/ProfileScreen.tsx
git commit -m "feat(mobile): add coupon input box, 100% free instant activation, and student invoice history"
```
