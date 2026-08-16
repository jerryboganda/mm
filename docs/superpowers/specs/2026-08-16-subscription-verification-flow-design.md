# Design Specification: Subscription Verification & In-App Notification Flow

**Date**: 2026-08-16  
**Status**: Approved  
**Target Areas**: 
- Client: `client/screens/PendingApprovalScreen.tsx`, `client/screens/ProfileScreen.tsx`, `client/screens/NotificationsScreen.tsx`
- Server: `server/routes/admin-manual-payments.ts`, `server/routes/content.ts`, `server/storage.ts`, `shared/schema.ts`

---

## 1. Overview & Objectives

Implement a seamless, end-to-end subscription verification experience matching the user's exact specification:
1. **Flow**: Subscription / Choose Plan ➔ Upload Proof ➔ Submit for Review ➔ Pending Screen with "Continue / Go to Main Page", "Check Again", and "Sign Out".
2. **In-App Notification on Verification**: When an admin verifies/approves a payment proof, create an in-app notification for the user ("Subscription Verified ✅").
3. **Profile Screen Transformation**: Once verified, the "Upgrade to Premium" banner dynamically transforms into a celebratory "Premium User ✅" banner.

---

## 2. Detailed Technical Design

### 2.1 Pending Approval Screen (`PendingApprovalScreen.tsx`)
- **Header / Content**:
  - "Pending Review" title & clock status card.
  - Explanatory message indicating our team is reviewing the payment proof.
- **Action Buttons**:
  1. **Primary Button ("Continue to App" / "Go to Main Page")**:
     - Calls `navigation.reset({ index: 0, routes: [{ name: "Main" }] })`.
     - Allows the student to continue using free content while verification is pending.
  2. **Recheck Button ("Check Status Again")**:
     - Polls `refreshUser()` and `refetch()`. If status is `active`, smoothly resets to `Main` with a success haptic.
  3. **Sign Out Button**:
     - Calls `logout()`.

---

### 2.2 In-App Notification System (`announcements` with optional `userId`)
- **Schema Update (`shared/schema.ts`)**:
  - Add optional `userId: varchar("user_id").references(() => users.id)` to `announcements` table.
  - Broadcast announcements have `userId = null` (visible to all users).
  - User-specific notifications have `userId = <specific_user_id>`.
- **Database Query Update (`server/storage.ts` & `server/routes/content.ts`)**:
  - In `/api/announcements`, if user is authenticated (`req.userId`), select announcements where `isActive = true AND (userId IS NULL OR userId = req.userId)` ordered by `createdAt DESC`.
- **Trigger on Admin Approval (`server/routes/admin-manual-payments.ts`)**:
  - When admin approves a manual payment (`POST /:id/approve`), insert an in-app notification:
    - `title`: `"Subscription Verified ✅"`
    - `message`: `"Your payment for ${packageName} has been approved! All premium OB-GYN modules, MCQs, and notes are now fully unlocked."`
    - `type`: `"update"`
    - `userId`: `proof.userId`
    - `isActive`: `true`

---

### 2.3 Profile Screen Dynamic Status (`ProfileScreen.tsx`)
- **When `user?.subscriptionStatus !== "active"`**:
  - Renders the existing **"Upgrade to Premium"** card (`borderColor: theme.warning`, zap icon, "Unlock all content and features").
- **When `user?.subscriptionStatus === "active"`**:
  - Renders the **"Premium User ✅"** card:
    - `borderColor: theme.success` (Emerald/Green glass card).
    - Icon: `<Feather name="check-circle" size={24} color={theme.success} />` with soft green background (`${theme.success}20`).
    - Title: `"Premium User ✅"`.
    - Subtitle: `"All content and features unlocked • " + (user.subscriptionPlan || "Full Access")`.
    - Tap Action: Navigates to `Subscription` screen so user can manage or view plan details.

---

## 3. Verification Plan
1. Test TypeScript compilation (`npx tsc --noEmit`) to verify zero errors across client and server.
2. Test Pending Screen buttons: "Continue to App", "Check Status Again", "Sign Out".
3. Verify Profile Screen renders "Premium User ✅" when `subscriptionStatus === 'active'`.
4. Verify `/api/announcements` delivers user-targeted notifications upon approval.
5. Deploy to Production VPS (`185.252.233.186`) and verify live health.
