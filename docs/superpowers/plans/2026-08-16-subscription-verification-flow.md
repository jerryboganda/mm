# Subscription Verification, In-App Notification & Premium Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete verification flow with "Continue to App" / "Go to Main Page" on PendingApprovalScreen, in-app verification notifications upon admin approval, and dynamic "Premium User ✅" banner transformation on ProfileScreen.

**Architecture:** 
- Add optional `userId` to `announcements` table in `shared/schema.ts` to support user-targeted notifications.
- Update `server/storage.ts` and `server/routes/content.ts` to return global + user-specific announcements.
- Update `server/routes/admin-manual-payments.ts` to dispatch an in-app verification notification when approving payment proofs.
- Update `client/screens/PendingApprovalScreen.tsx` with "Continue to App" / "Go to Main Page", "Check Status Again", and "Sign Out".
- Update `client/screens/ProfileScreen.tsx` to dynamically transform "Upgrade to Premium" into "Premium User ✅" when `subscriptionStatus === 'active'`.

**Tech Stack:** React Native (Expo), TypeScript, Express.js, Drizzle ORM, PostgreSQL.

## Global Constraints
- Preserve all existing auth, billing, and polling logic.
- Ensure TypeScript typecheck (`npx tsc --noEmit`) passes with 0 errors.
- Deploy to Production VPS (`185.252.233.186`) and verify live endpoints.

---

### Task 1: Update Schema & Server for User In-App Notifications

**Files:**
- Modify: `shared/schema.ts`
- Modify: `server/storage.ts`
- Modify: `server/routes/content.ts`
- Modify: `server/routes/admin-manual-payments.ts`

- [ ] **Step 1: Add `userId` column to `announcements` in `shared/schema.ts`**
Add `userId: varchar("user_id").references(() => users.id)` to `announcements` table.

- [ ] **Step 2: Update `getAnnouncements(userId?: string)` in `server/storage.ts`**
Update query: `and(eq(announcements.isActive, true), or(isNull(announcements.userId), eq(announcements.userId, userId || '')))` ordered by `createdAt DESC`.

- [ ] **Step 3: Update `/api/announcements` endpoint in `server/routes/content.ts`**
Pass `(req as any).userId` or extract optional auth token to fetch user-specific announcements.

- [ ] **Step 4: Dispatch in-app notification in `server/routes/admin-manual-payments.ts`**
In `POST /:id/approve`, insert an announcement targeted to `proof.userId` with title `"Subscription Verified ✅"` and details.

- [ ] **Step 5: Run TypeScript check**
Run: `npx tsc --noEmit`
Expected: 0 errors.

---

### Task 2: Update Mobile Client Screens (PendingApprovalScreen & ProfileScreen)

**Files:**
- Modify: `client/screens/PendingApprovalScreen.tsx`
- Modify: `client/screens/ProfileScreen.tsx`

- [ ] **Step 1: Update `client/screens/PendingApprovalScreen.tsx`**
Add:
- Primary button: `"Continue to App"` / `"Go to Main Page"` with `Feather name="arrow-right"` calling `navigation.reset({ index: 0, routes: [{ name: "Main" }] })`.
- Recheck button: `"Check Status Again"` with refresh spinner and instant `refreshUser()` + `refetch()`.
- Sign Out button: cleanly styled at the bottom.

- [ ] **Step 2: Update `client/screens/ProfileScreen.tsx`**
Replace static upgrade card condition to dynamically render:
- When `user?.subscriptionStatus === "active"`:
  - Green/Emerald card (`borderColor: theme.success`)
  - Icon: `<Feather name="check-circle" size={24} color={theme.success} />`
  - Title: `"Premium User ✅"`
  - Subtitle: `"All content and features unlocked • " + (user.subscriptionPlan || "Full Access")`
  - Action: Navigates to `Subscription` screen.
- When `user?.subscriptionStatus !== "active"`:
  - Existing `"Upgrade to Premium"` card with zap icon.

- [ ] **Step 3: Run TypeScript check**
Run: `npx tsc --noEmit`
Expected: 0 errors.

---

### Task 3: Deploy to Production VPS & Verify Live

**Files:**
- None (deployment and verification task)

- [ ] **Step 1: Commit and push changes to GitHub `origin/main`**
- [ ] **Step 2: Pull and rebuild on Production VPS (`185.252.233.186`)**
- [ ] **Step 3: Verify live health and API endpoints**
