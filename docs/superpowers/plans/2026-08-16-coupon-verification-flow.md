# Implementation Plan: Promo/Coupon Verification Flow & Query Contacts

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete promo/coupon submission flow: enter coupon `(XXXX-XXXX-XXXX)` ➔ Send for verification ➔ Confirmation screen with "your promo/coupon code received, we shall verify soon" + WhatsApp, Web, and Email contact options + "Continue to App" / "Go to Main Page".

**Architecture:**
- Create `POST /api/subscriptions/submit-coupon-proof` endpoint in `server/routes/subscription.ts` to register coupon submissions into `manualPaymentProofs`.
- Update `client/screens/SubscriptionScreen.tsx` with high-contrast input `(XXXX-XXXX-XXXX)` and "Send for Verification" action.
- Update `client/screens/PendingApprovalScreen.tsx` to display the received confirmation message and WhatsApp, Web, and Email query links.

---

### Task 1: Add Backend Coupon Submission Route

**Files:**
- Modify: `server/routes/subscription.ts`

- [ ] **Step 1: Add `POST /api/subscriptions/submit-coupon-proof` route in `server/routes/subscription.ts`**
  - Accept `{ code: string, packageId?: string, priceId?: string }`.
  - Resolve default package and price if not supplied.
  - Insert pending record in `manualPaymentProofs` with method `"Promo / Coupon Code"` and sender reference as the uppercase code.
- [ ] **Step 2: Typecheck server**
  - Run `npx tsc --noEmit` to verify type compatibility.

---

### Task 2: Update Mobile Screens (`SubscriptionScreen.tsx` & `PendingApprovalScreen.tsx`)

**Files:**
- Modify: `client/screens/SubscriptionScreen.tsx`
- Modify: `client/screens/PendingApprovalScreen.tsx`

- [ ] **Step 1: Update `client/screens/SubscriptionScreen.tsx`**
  - Fix input background color/contrast for light & dark themes.
  - Change placeholder to `"Enter Coupon (XXXX-XXXX-XXXX)"`.
  - Add / wire `"Send for Verification"` button to submit to `/api/subscriptions/submit-coupon-proof` and transition to `PendingApproval`.
- [ ] **Step 2: Update `client/screens/PendingApprovalScreen.tsx`**
  - Render confirmation message: `"Your promo/coupon code has been received. We shall verify and activate your subscription soon."`
  - Add query & support contact card:
    - WhatsApp: `+923360830836` -> `https://wa.me/923360830836`
    - Web: `https://maternalmind.com.pk/` -> `https://maternalmind.com.pk/`
    - Email: `maternalmind.help@gmail.com` -> `mailto:maternalmind.help@gmail.com`
  - Maintain "Continue to App" / "Go to Main Page", "Check Status Again", and "Sign Out" buttons.
- [ ] **Step 3: Run TypeScript typecheck**
  - Run `npx tsc --noEmit` and ensure 0 errors.

---

### Task 3: Deploy to Production VPS & Verify

- [ ] **Step 1: Commit and push changes to GitHub `origin/main`**
- [ ] **Step 2: Pull and rebuild container on Production VPS (`185.252.233.186`)**
- [ ] **Step 3: Verify live health endpoint `https://maternalmind.com.pk/health`**
