# Design Specification: Promo/Coupon Code Submission & Verification Flow

**Date**: 2026-08-16  
**Status**: Approved  
**Target Areas**:
- Client: `client/screens/SubscriptionScreen.tsx`, `client/screens/PendingApprovalScreen.tsx`
- Server: `server/routes/subscription.ts`, `server/services/coupon-service.ts`

---

## 1. Overview & Objectives

Provide a frictionless coupon/promo code submission and verification flow:
1. **Subscription Screen**:
   - Promo/Coupon Code card with input placeholder `Enter Coupon (XXXX-XXXX-XXXX)`.
   - "Send for Verification" button.
2. **Pending / Verification Screen (`PendingApprovalScreen.tsx`)**:
   - Displays received message: `"Your promo/coupon code has been received. We shall verify soon."`
   - "For further queries please contact on" section:
     - **WhatsApp**: `+923360830836` (opens `https://wa.me/923360830836`)
     - **Web**: `https://maternalmind.com.pk/` (opens `https://maternalmind.com.pk/`)
     - **Email**: `maternalmind.help@gmail.com` (opens `mailto:maternalmind.help@gmail.com`)
   - "Continue to App" / "Go to Main Page" button.
   - "Check Status Again" button.
   - "Sign Out" button.
3. **Backend Support**:
   - Endpoint `POST /api/subscriptions/submit-coupon-proof`: Allows submitting a coupon code directly for review, creating a `pending` record in `manualPaymentProofs` with payment method `"Promo / Coupon Code"`.
   - When approved by admin: in-app notification is sent, and profile banner converts to `"Premium User ✅"`.

---

## 2. Technical Architecture

### 2.1 Backend Endpoint (`POST /api/subscriptions/submit-coupon-proof`)
- Body: `{ code: string, packageId?: string, priceId?: string }`
- Logic:
  - Validates `code`. If `packageId` or `priceId` is omitted, defaults to the primary default package and price.
  - Checks if user already has an active subscription or pending review.
  - Inserts a record in `manualPaymentProofs`:
    - `userId`: `req.userId`
    - `packageId`: resolved package id
    - `priceId`: resolved price id
    - `paymentMethod`: `"Promo / Coupon Code"`
    - `senderReference`: `code.toUpperCase()`
    - `userNote`: `Submitted promo/coupon code: ${code}`
    - `status`: `"pending"`
    - `amountClaimed`: `"0"`
  - Returns `{ success: true, message: "Coupon received for verification" }`.

### 2.2 Subscription Screen (`client/screens/SubscriptionScreen.tsx`)
- High-contrast text input for coupon codes.
- "Send for Verification" button that invokes `POST /api/subscriptions/submit-coupon-proof`.
- On success, navigates to `PendingApprovalScreen`.

### 2.3 Pending Approval Screen (`client/screens/PendingApprovalScreen.tsx`)
- Renders:
  - Header: `"Verification in Progress"` or `"Pending Review"`
  - Confirmation: `"Your promo/coupon code has been received. We shall verify soon."`
  - Contact section under `"For further queries please contact on:"` with WhatsApp, Web, and Email pressable items.
  - Primary button: `"Continue to App"` / `"Go to Main Page"`
  - Recheck button: `"Check Status Again"`
  - Sign out: `"Sign Out"`

---

## 3. Verification
1. Run `npx tsc --noEmit` to verify type cleanliness.
2. Commit, push, and deploy to VPS (`185.252.233.186`).
3. Verify live endpoints and container health.
