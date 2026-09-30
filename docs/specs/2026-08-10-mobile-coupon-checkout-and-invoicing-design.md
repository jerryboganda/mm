# Design Specification: Student Mobile App Coupon Checkout, Instant Activation & Invoicing

**Date**: 2026-08-10  
**Status**: Approved by User  
**Target Area**: Admin Panel, Server API, Database Schema, and Student Mobile App

---

## 1. Overview & Objective
This specification defines the complete end-to-end design for the **Coupon Checkout & Invoicing System**:
1. **Admin Panel Generator**: Admins can generate single or bulk coupons, set target packages, define custom access duration overrides (e.g. 30 days, 90 days, 365 days), set expiry dates, and copy shareable promo links.
2. **Mobile App Coupon Checkout**: Students can enter a promo code on the subscription screen, validate it in real-time, view itemized price reductions (or 100% free access), and clear/swap coupons with a single tap.
3. **Instant 100% Free Activation**: 100% discount coupons immediately activate the student's subscription without requiring bank proof upload.
4. **Formal Invoicing & Student Profile History**: Automatically generates itemized invoices (`invoices` table) and displays redeemed coupons & invoices under Student Profile -> Subscription.

---

## 2. Database Schema Changes (`shared/schema.ts`)

### 2.1 `coupons` Table Update
- `durationDaysOverride: integer("duration_days_override")` — Optional custom duration (in days) granted upon redemption. Null = use target package duration.

### 2.2 Migration Script (`scripts/migrate-coupon-duration.ts`)
- Executes SQL: `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS duration_days_override INTEGER;`

---

## 3. Admin Panel UI (`admin/src/pages/SubscriptionCouponsPage.tsx`)
- **Package Selection**: Multi-select dropdown or checkboxes for target packages.
- **Custom Access Duration**: Optional numeric input field `Duration Override (Days)` (e.g., 14, 30, 90, 365).
- **Expiry Date (`validUntil`)**: Date picker for coupon code expiration.
- **Bulk Generator**: Generates N unique alphanumeric codes with campaign grouping.
- **Quick Copy Links**: One-click "Copy Code / Copy Link" buttons next to each coupon in the list table.

---

## 4. Server API & Invoicing Engine (`server`)

### 4.1 Coupon Validation (`POST /api/subscriptions/validate-coupon`)
- Payload: `{ code: string, packageId: string, priceId?: string }`
- Validation logic:
  - Check `isActive === true`.
  - Check `validUntil` has not passed.
  - Check `maxTotalUses` vs `currentUseCount`.
  - Check user's prior redemptions vs `maxUsesPerUser`.
  - Check target package matching (`applicablePackageIds`).
- Returns:
  ```json
  {
    "valid": true,
    "couponId": "uuid",
    "code": "SUMMER50",
    "discountType": "percentage",
    "discountValue": 50,
    "discountAmount": 2500,
    "originalPrice": 5000,
    "finalPrice": 2500,
    "isFreeAccess": false,
    "accessDurationDays": 30,
    "message": "Coupon applied! You save PKR 2,500"
  }
  ```

### 4.2 Instant 100% Free Redemption (`POST /api/subscriptions/redeem-free-coupon`)
- Payload: `{ code: string, packageId: string, priceId?: string }`
- Execution steps:
  1. Re-validate coupon in atomic transaction.
  2. Increment `currentUseCount` and insert record into `coupon_usage`.
  3. Generate formal itemized record in `invoices` table:
     - `invoiceNumber`: `INV-YYYY-XXXX`
     - `status`: `"paid"`
     - `total`: `"0.00"`
     - `discountAmount`: original price
  4. Activate subscription: `user.subscriptionStatus = "active"`, `subscriptionExpiresAt = now + accessDurationDays`.
  5. Return `{ success: true, invoiceId: string, subscriptionExpiresAt: string }`.

---

## 5. Mobile App UI & Student Experience (`client`)

### 5.1 Pricing & Package Checkout (`SubscriptionScreen.tsx`)
- **Promo Code Box**: Card with TextInput `[ Promo / Coupon Code ]` and `[ Apply ]` button.
- **Visual Feedback**:
  - Shows green badge on applied coupon with discount summary.
  - Shows strikethrough original price (~~PKR 5,000~~) and updated final price.
  - Includes **"Remove Coupon"** icon button to clear or swap code.
- **Instant Activation Button**:
  - If `isFreeAccess === true`, changes primary action button to **"Claim Instant Free Access"**.
  - Tapping calls `redeem-free-coupon` and navigates directly to `PurchaseSuccessScreen`.

### 5.2 Student Profile Invoices (`ProfileScreen.tsx` & `SettingsScreen.tsx`)
- Add **"My Invoices & Redeemed Coupons"** menu item under Subscription settings.
- Displays history list of all past invoices & redemptions with itemized modal details.

---

## 6. Verification Checklist
- [x] Schema migration clean with zero errors.
- [x] Admin panel coupon creation & bulk generator tested with duration overrides.
- [x] Backend validation & 100% free redemption tested.
- [x] Mobile app coupon box, instant activation, and invoice view verified.
