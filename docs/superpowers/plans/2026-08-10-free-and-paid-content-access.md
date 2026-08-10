# Free vs. Paid Content Access Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow students to log in and access free learning content & quizzes without an active subscription, while enforcing paywall access checks for materials marked as paid in the Admin Panel.

**Architecture:** Add an `isPaid` boolean field to the `topics` and `mcqs` database schemas. Update the Admin Panel UI to allow toggling `isPaid` per topic and MCQ. Modify backend content routes to enforce 403 subscription gates on paid items for unsubscribed users. Update mobile app navigation to remove the blanket login paywall block and route non-subscribed users to the `PaywallScreen` only when tapping paid materials.

**Tech Stack:** React Native (Expo), TypeScript, Express.js, Drizzle ORM, PostgreSQL, TailwindCSS / React Admin UI.

## Global Constraints
- Every student can log in without requiring a subscription.
- Default for `isPaid` is `false` (Free access).
- Paid items display a star / premium badge; Free items display an unlock / free badge.
- Accessing a paid topic or quiz without an active subscription opens the dedicated `PaywallScreen`.

---

### Task 1: Update Database Schema & Migration

**Files:**
- Modify: `shared/schema.ts`
- Create: `scripts/migrate-is-paid.ts`

**Interfaces:**
- Consumes: Drizzle schema definitions for `topics` and `mcqs`.
- Produces: `isPaid` field on `topics` and `mcqs` table schemas.

- [ ] **Step 1: Add `isPaid` column to `topics` and `mcqs` tables in `shared/schema.ts`**

In `shared/schema.ts`:
```ts
// In topics table:
isPaid: boolean("is_paid").default(false).notNull(),

// In mcqs table:
isPaid: boolean("is_paid").default(false).notNull(),
```

- [ ] **Step 2: Create migration script to alter PostgreSQL database tables**

Create `scripts/migrate-is-paid.ts`:
```ts
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function run() {
  console.log("Migrating database tables for is_paid columns...");
  await db.execute(sql`ALTER TABLE topics ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;`);
  await db.execute(sql`ALTER TABLE mcqs ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;`);
  console.log("Migration complete.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Run the migration script**

Run: `npx tsx scripts/migrate-is-paid.ts`  
Expected: "Migration complete."

- [ ] **Step 4: Commit schema changes**

```bash
git add shared/schema.ts scripts/migrate-is-paid.ts
git commit -m "feat(schema): add isPaid columns to topics and mcqs"
```

---

### Task 2: Update Admin Panel UI for Topic & MCQ Paid Toggles

**Files:**
- Modify: `server/routes/admin-content.ts`
- Modify: `admin/src/pages/TopicsPage.tsx`
- Modify: `admin/src/pages/TopicEditorPage.tsx`
- Modify: `admin/src/pages/McqsPage.tsx`

**Interfaces:**
- Consumes: `isPaid` field from API requests and responses.
- Produces: Admin panel controls for setting topics and MCQs as Paid or Free.

- [ ] **Step 1: Update admin backend routes (`server/routes/admin-content.ts`) to handle `isPaid`**

In topic create/update routes (`POST /api/admin/topics`, `PUT /api/admin/topics/:id`) and MCQ routes (`POST /api/admin/mcqs`, `PUT /api/admin/mcqs/:id`), accept `isPaid: boolean` in request body and update the database accordingly.

- [ ] **Step 2: Add `isPaid` toggle to Admin Topic pages (`TopicsPage.tsx` and `TopicEditorPage.tsx`)**

Add a checkbox / toggle:
```tsx
<label className="flex items-center space-x-2">
  <input
    type="checkbox"
    checked={isPaid}
    onChange={(e) => setIsPaid(e.target.checked)}
    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
  />
  <span className="text-sm font-medium text-gray-700">Paid Content (Requires Premium Subscription)</span>
</label>
```
Display a green `Free` or yellow `Paid` badge in the Topics list table.

- [ ] **Step 3: Add `isPaid` toggle to Admin MCQ page (`McqsPage.tsx`)**

Add a checkbox / toggle in the create/edit MCQ dialog:
```tsx
<label className="flex items-center space-x-2">
  <input
    type="checkbox"
    checked={isPaid}
    onChange={(e) => setIsPaid(e.target.checked)}
    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
  />
  <span className="text-sm font-medium text-gray-700">Paid Quiz Question</span>
</label>
```
Display a badge in the MCQs table view.

- [ ] **Step 4: Commit Admin Panel updates**

```bash
git add server/routes/admin-content.ts admin/src/pages/TopicsPage.tsx admin/src/pages/TopicEditorPage.tsx admin/src/pages/McqsPage.tsx
git commit -m "feat(admin): add paid content toggles and badges for topics and mcqs"
```

---

### Task 3: Update Backend Server API Access Control

**Files:**
- Modify: `server/routes/content.ts`
- Modify: `server/storage.ts`

**Interfaces:**
- Consumes: `req.userId`, `user.subscriptionStatus`, `topic.isPaid`, `mcq.isPaid`.
- Produces: `isPaid` field in topic API responses, 403 `SUBSCRIPTION_REQUIRED` status on unauthorized paid content requests.

- [ ] **Step 1: Include `isPaid` in student content endpoints in `server/routes/content.ts`**

Update `GET /api/chapters/:chapterId/topics` and `GET /api/topics/:topicId` to include `isPaid: topic.isPaid` in the JSON response payload.

- [ ] **Step 2: Add subscription check on `GET /api/topics/:topicId`**

In `GET /api/topics/:topicId`:
```ts
const user = await storage.getUser(req.userId!);
const effectiveStatus = effectiveSubscriptionStatus(user?.subscriptionStatus, user?.subscriptionExpiresAt);

if (topic.isPaid && effectiveStatus !== "active") {
  return res.status(403).json({
    code: "SUBSCRIPTION_REQUIRED",
    message: "This topic requires an active Premium subscription.",
  });
}
```

- [ ] **Step 3: Commit backend API changes**

```bash
git add server/routes/content.ts server/storage.ts
git commit -m "feat(api): enforce subscription gate on paid topics"
```

---

### Task 4: Unblock Mobile App Login & Enforce Paywall Gating

**Files:**
- Modify: `client/navigation/RootStackNavigator.tsx`
- Modify: `client/screens/LearnScreen.tsx`
- Modify: `client/screens/TopicsScreen.tsx`
- Modify: `client/screens/QuizTopicSelectScreen.tsx`
- Modify: `client/screens/QuizPlayerScreen.tsx`

**Interfaces:**
- Consumes: `user.subscriptionStatus`, `topic.isPaid`, `mcq.isPaid`.
- Produces: Free login for all students; navigation to `PaywallScreen` upon tapping paid content without active subscription.

- [ ] **Step 1: Remove global paywall block in `client/navigation/RootStackNavigator.tsx`**

Remove the `!hasActiveSubscription` guard wrapping `PaywallScreen` so that all authenticated, email-verified users navigate directly into `MainTabNavigator`. Keep `PaywallScreen` accessible as a normal stack screen in the navigator.

- [ ] **Step 2: Update `TopicsScreen.tsx` to handle paid topic card press**

In `TopicsScreen.tsx`:
```tsx
onPress={() => {
  const hasActiveSubscription = user?.subscriptionStatus === "active";
  if (item.isPaid && !hasActiveSubscription) {
    navigation.navigate("Paywall");
  } else {
    navigation.navigate("TopicReader", {
      topicId: item.id,
      topicTitle: item.title,
    });
  }
}}
```

- [ ] **Step 3: Update `QuizPlayerScreen.tsx` and `QuizTopicSelectScreen.tsx`**

Ensure that if a user attempts to play a paid quiz without an active subscription, the app navigates to `PaywallScreen`.

- [ ] **Step 4: Verify mobile app flow and commit**

```bash
git add client/navigation/RootStackNavigator.tsx client/screens/LearnScreen.tsx client/screens/TopicsScreen.tsx client/screens/QuizTopicSelectScreen.tsx client/screens/QuizPlayerScreen.tsx
git commit -m "feat(mobile): unlock student app login and gate paid materials behind Paywall screen"
```
