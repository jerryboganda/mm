# Design Specification: Free vs. Paid Content Access Control

**Date**: 2026-08-10  
**Status**: Approved by User  
**Target Area**: Admin Panel, Server API, and Mobile App (Student Access)

---

## 1. Overview & Objective
Currently, the Maternal Mind mobile application enforces a blanket paywall lock upon login for any user without an active premium subscription, completely blocking access to the app's main screens and content. 

This design establishes a granular **Free vs. Paid Content Access Model**:
1. All authenticated students can log into the mobile app and freely access all content marked as **Free**.
2. Administrators can independently set **Topics** and **Quiz Questions (MCQs)** as **Free** or **Paid** via the Admin Panel UI.
3. Access to content marked as **Paid** is strictly enforced via server-side checks and client-side navigation. Unsubscribed users attempting to access Paid content are routed to the **Dedicated Paywall Screen**.

---

## 2. Database Schema Changes (`shared/schema.ts`)
Two new boolean columns will be added to represent paid access requirements:

### 2.1 `topics` Table
- `isPaid: boolean("is_paid").default(false).notNull()`
- Default: `false` (All existing and newly created topics are Free unless explicitly marked Paid).

### 2.2 `mcqs` Table
- `isPaid: boolean("is_paid").default(false).notNull()`
- Default: `false` (All existing and newly created MCQs are Free unless explicitly marked Paid).

---

## 3. Admin Panel UI (`admin/src`)

### 3.1 Topic Management (`TopicsPage.tsx` & `TopicEditorPage.tsx`)
- Add a toggle switch in the Topic creation/edit forms: **"Paid Content (Requires Premium Subscription)"**.
- Include `isPaid` in topic API create/update payloads.
- Display a status column in the Topics list table with badges:
  - `Free` (Green badge)
  - `Paid` (Amber/Yellow badge)

### 3.2 Quiz / MCQ Management (`McqsPage.tsx`)
- Add a toggle switch in the MCQ creation/edit dialogs: **"Paid Question (Requires Premium Subscription)"**.
- Include `isPaid` in MCQ API create/update payloads.
- Display a status column in the MCQs table with badges for Free vs. Paid.

---

## 4. Server API & Security Gate (`server`)

### 4.1 Content API Endpoints (`server/routes/content.ts`)
- Update `/api/books`, `/api/books/:bookId/chapters`, and `/api/chapters/:chapterId/topics` to include the `isPaid` field in topic items.
- Update `/api/topics/:topicId`:
  - Fetch `topic.isPaid`.
  - Check the requesting user's `subscriptionStatus`.
  - If `topic.isPaid === true` AND `user.subscriptionStatus !== "active"`, respond with `403 Forbidden`:
    ```json
    {
      "code": "SUBSCRIPTION_REQUIRED",
      "message": "This material requires a Premium subscription."
    }
    ```
- Update Quiz endpoints (`/api/mcqs`, `/api/quiz/...`):
  - In quiz session creation or fetching questions for non-subscribed users, restrict access or filter out questions where `isPaid === true`.

---

## 5. Mobile App Navigation & UX (`client`)

### 5.1 Unblock Login Access (`client/navigation/RootStackNavigator.tsx`)
- Remove the global `!hasActiveSubscription` condition blocking entry to `MainTabNavigator`.
- All authenticated, email-verified users will land on the `Main` app navigator after login.

### 5.2 Topic & Quiz Cards (`LearnScreen.tsx`, `TopicsScreen.tsx`, `QuizTopicSelectScreen.tsx`)
- Display visual indicators on content cards:
  - **Free Badge** (Unlock icon + green styling).
  - **Premium Badge** (Star icon + amber styling).

### 5.3 Paywall Interceptor & Guard
- When a user taps a topic or quiz card:
  - If `isPaid === true` and `user.subscriptionStatus !== "active"`:
    - Redirect / navigate immediately to `PaywallScreen`.
  - Otherwise:
    - Open `TopicReader` or `QuizPlayer` normally.

---

## 6. Verification & Self-Review Checklist
- [x] **No Placeholders**: All fields and endpoints specified explicitly.
- [x] **Internal Consistency**: Schema, Admin UI, API, and Mobile App logic align perfectly.
- [x] **Scope Boundaries**: Focuses specifically on Free vs. Paid content gating per user request.
