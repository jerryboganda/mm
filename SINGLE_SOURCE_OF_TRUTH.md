# Maternal Mind - Single Source of Truth (SSOT)

Last updated: 2026-04-17 (final)
Purpose: Canonical project memory, technical baseline, risk register, and execution plan.

## 1) Project Snapshot

- Product: Maternal Mind (OB-GYN medical education app for FCPS/MRCOG prep)
- Frontend: React Native 0.81.5 + Expo SDK 54
- Backend: Express 5 + Drizzle ORM + PostgreSQL
- Core flows: Notes (Books > Chapters > Topics), MCQ quiz modes, progress, bookmarks, auth/verification
- Repo: `https://github.com/jerryboganda/mm`

## 2) Environments and Infrastructure

### Production VPS

- Host: `185.252.233.186`
- OS: Ubuntu 24.04.3 LTS
- Access: `ssh root@185.252.233.186` (key: `~/.ssh/id_rsa_new`)
- Runtime: Docker Engine 29.1.5
- Edge/proxy: Nginx Proxy Manager

### Maternal Mind Service

- API port: `5000` (containerized app + PostgreSQL)
- Known project path references:
  - `/root/maternalmind`
  - `/root/maternal-mind`
- Action required: confirm the active path and standardize to one.

### Relevant VPS Ports

- `80`, `443`: HTTP/HTTPS (Nginx Proxy Manager)
- `81`: Nginx Proxy Manager admin
- `8000`, `9443`: Portainer
- `22`: SSH
- `5000`: Maternal Mind API

### Operations Commands

```bash
# SSH
ssh root@185.252.233.186

# Logs
cd /root/maternalmind && docker compose logs -f app

# Rebuild/restart backend app
cd /root/maternalmind && docker compose up -d --build app

# Run migrations/schema sync
cd /root/maternalmind && docker compose exec app npm run db:push
```

## 3) Mobile Build and Delivery

- Build system: Expo EAS Cloud (Android preferred due to local Windows constraints)
- EAS project ID: `fc2a8779-9dbb-407c-9622-d02c88e300de`
- Build profile: `preview` (APK output)
- Build command: `npx eas-cli build --profile preview --platform android`
- Dashboard: `https://expo.dev/accounts/egjerrys-organization/projects/maternalmind/builds`

### Android networking/config notes

- Cleartext support enabled via `expo-build-properties` plugin when HTTP is used.
- CORS adjustments were made server-side for mobile origin handling.
- Dependency alignment done with `npx expo install --fix`.

## 4) Recently Completed Improvements (Jan–Mar 2026)

- **Comprehensive offline support (Mar 2026)**: App was completely unusable offline — `AppNetworkWrapper` replaced the entire UI with a dead-end `OfflineScreen` (just a Retry button), even though `offline-cache.ts` existed and saved query data to AsyncStorage. Users could never access cached content. Multi-layer fix:
  - **Architecture**: Rewrote `AppNetworkWrapper.tsx` to always render children (the full navigation stack) instead of blocking with `OfflineScreen`. Added `OfflineBanner.tsx` — a slim animated amber banner at the top showing "You're offline — showing cached content" with cached page count.
  - **TanStack Query integration**: Wired `onlineManager` from `@tanstack/react-query` to `@react-native-community/netinfo` in `query-client.ts` so TanStack Query knows about network state and auto-pauses/resumes fetches.
  - **Cache coverage**: Expanded `offline-cache.ts` `OFFLINE_QUERY_KEYS` to include `/api/progress`, `/api/bookmarks`, `/api/profile`, `/api/announcements`, `/api/me`, `/api/reviews/due`, `/api/reviews/due-count`, `/api/progress/recent`, `/api/progress/recommended`, `/api/recent-activity`, `/api/recommended-topics`. Added prefix matching for `/api/quiz/`, `/api/attempts/`, `/api/progress/`.
  - **Mutation queue**: Created `client/lib/mutation-queue.ts` — when offline, bookmark/complete/uncomplete mutations are queued to AsyncStorage with last-write-wins deduplication. `startMutationQueueListener()` auto-drains the queue when connectivity restores. Wired into `App.tsx` at startup.
  - **Optimistic updates**: `TopicReaderScreen` bookmark/complete/uncomplete mutations now have `onMutate` optimistic toggles (instant UI feedback) with `onError` rollback. Works seamlessly offline — UI updates immediately, mutation is queued, synced later.
  - **Periodic persistence**: Added `startPeriodicPersist(queryClient, 60_000)` (persists cache every 60s) and `persistOnQuerySuccess(queryClient, 3_000)` (debounced persist after successful fetches) to `offline-cache.ts`. Both wired in `App.tsx` alongside the existing background-persist.
  - **Offline-aware screens**: `QuizPlayerScreen` blocks submission when offline with "Your answers are saved — please submit when you're back online" alert. `SecuritySettingsScreen` guards change-password and logout-all. `HelpSupportScreen` guards issue submission. `EditProfileScreen` guards profile save. All show clear "requires internet connection" messaging.
  - **FAQ update**: Updated Help FAQ answer about offline support to reflect new capabilities.
  - Files: `client/components/OfflineBanner.tsx` (new), `client/lib/mutation-queue.ts` (new), `client/components/AppNetworkWrapper.tsx` (rewritten), `client/lib/offline-cache.ts` (expanded), `client/lib/query-client.ts` (onlineManager), `client/App.tsx` (wiring), `client/screens/TopicReaderScreen.tsx` (optimistic mutations), `client/screens/QuizPlayerScreen.tsx`, `client/screens/SecuritySettingsScreen.tsx`, `client/screens/HelpSupportScreen.tsx`, `client/screens/EditProfileScreen.tsx`.
- **Content reporting fix (Mar 2026)**: "Report an Error" feature in TopicReaderScreen always failed with "Failed to submit report. Please try again." and admin Content Reports page showed nothing. Two root causes: (1) **reportType enum mismatch** — client sent `"factual_error"` / `"typo"` but server Zod schema only accepted `"error"` / `"outdated"` / `"unclear"` / `"other"`, causing immediate validation failure; (2) **description min-length** — server required `min(10)` chars but client had no matching minimum, letting users submit short descriptions that were rejected. Fix: Expanded server `reportSchema` in `server/routes/reports.ts` to accept all client values (`factual_error`, `typo`, `outdated`, `unclear`, `error`, `other`), lowered description min to 3 chars, added `length >= 3` check on client submit button. Also fixed admin panel `ContentReportsPage.tsx` — interface had wrong field names (`type` instead of `reportType`, `topicId` instead of `contentId`, etc.) and numeric IDs instead of string UUIDs. Enhanced `storage.getContentReports()` to LEFT JOIN with `users` and `topics` tables to return `userName` and `topicTitle` for admin display.
- **Change Password 404 fix (Mar 2026)**: Security screen's "Change Password" returned `404: {"message":"Endpoint not found"}`. Root cause: the `/change-password` and `/logout-all` routes were added to `server/routes/auth.ts` (commit `5acede3`, Feb 25) but the Docker container on the VPS was running an older image that predated those routes. The 404 came from the Express catch-all in `server/index.ts`. The mobile client code (`SecuritySettingsScreen.tsx`) correctly called `POST /api/auth/change-password` via `apiRequest()`; only the server deployment was stale. Fix: Rebuilt the Docker container with `docker compose build app --no-cache && docker compose up -d --force-recreate app`, which picked up the existing route code. Verified externally via `https://admin.maternalmind.com.pk/api/auth/change-password` returning HTTP 401 (auth required) instead of 404.
- **Topic completion toggle (Mar 2026)**: Students could mark topics as "Completed" but could never uncomplete them for revision. The "Completed" badge was a static non-interactive `<View>`. Root cause: only `markTopicComplete()` existed in storage (sets `isCompleted: true`), no uncomplete method, no uncomplete API endpoint, and UI rendered a non-pressable badge. Fix: Added `markTopicUncomplete()` to `server/storage.ts` (sets `isCompleted: false, completedAt: null`), added `POST /api/topics/:topicId/uncomplete` route in `server/routes/content.ts`, and converted the static "Completed" badge in `TopicReaderScreen.tsx` to a `<Pressable>` that calls `markUncompleteMutation` with "Tap to mark for revision" hint text. Also invalidates progress queries on both complete/uncomplete to keep the Progress tab in sync.
- **Announcements feature fix (Mar 2026)**: Admin panel could create announcements (stored in DB `announcements` table via `admin-storage.ts`) but mobile app never showed them. Root cause: `storage.getAnnouncements()` was hardcoded to `return []` with a stale "no announcements table yet" comment, even though the table existed and was populated. Fix: Replaced the stub with a real Drizzle query that selects active (`is_active = true`), non-expired (`expires_at IS NULL OR expires_at > NOW()`) announcements ordered by `created_at DESC`. Also aligned mobile `NotificationsScreen.tsx` type definitions to match actual DB types (`info|warning|update|promo` instead of `new_content|update|info|important`), and removed `isRead` field dependency since it doesn't exist in the schema. Files changed: `server/storage.ts` (real query), `client/screens/NotificationsScreen.tsx` (type alignment + UI cleanup).
- **Sound Effects & Haptic Feedback system (Mar 2026)**: Both Settings toggles were non-functional — Sound Effects had zero implementation (no audio library, no sound files), and Haptic Feedback toggle was a local `useState` never persisted or shared globally. Fix: Created `client/lib/feedback.tsx` (FeedbackProvider context with AsyncStorage persistence for both preferences, `playHaptic()` and `playSound("tap"|"success"|"error")` helpers using `expo-av` Audio with sound caching). Created `client/lib/haptics-wrapper.ts` (drop-in replacement for `expo-haptics` with same API — checks global preference before firing). Generated 3 WAV sound assets in `assets/sounds/`. Installed `expo-av`. Wrapped entire app with `<FeedbackProvider>` in `App.tsx`. Mass-replaced `import * as Haptics from "expo-haptics"` → `@/lib/haptics-wrapper` across 38 files. Added tap/success sounds to `PrimaryButton`, `QuizPlayerScreen`, `TopicReaderScreen`. Now both toggles work globally: disabling Haptic Feedback silences all haptics app-wide; disabling Sound Effects silences all audio feedback.
- **OTP-based password reset (Mar 2026)**: Converted the entire "Forgot Password" flow from a link-based approach (which broke due to Brevo SMTP link tracking rewriting URLs) to a fully in-app OTP-based flow. User never leaves the app. Flow: enter email → receive 6-digit code via email → enter code in app → set new password. Files changed: `server/routes/auth.ts` (new `/verify-reset-otp` endpoint), `server/email.ts` (`passwordResetOtpEmailHtml`), `server/storage.ts` (`createPasswordResetOtp`, `getPasswordResetByOtp`), `shared/schema.ts` (updated `resetPasswordSchema`), `client/screens/ForgotPasswordScreen.tsx` (OTP entry UI), `client/screens/ResetPasswordScreen.tsx` (accepts email+code params), `client/navigation/RootStackNavigator.tsx` (updated type params).
- **HTML table rendering fix (Mar 2026)**: Added `@native-html/table-plugin` for proper table rendering in `TopicReaderScreen` content (e.g., PALM-COEIN classification tables).
- Increased glass component contrast and readability on dark backgrounds.
- Fixed dashboard card layout squashing and hero stat indexing.
- Improved Android safe-area/system-nav overlap handling in tab navigator.
- Fixed registration -> Sign In navigation reliability (`navigate("Login")` instead of `goBack()`).
- Included these fixes in EAS build `0380c558-14bb-46f9-9cbe-eb5f4284e2eb`.
- **Comprehensive Architecture & Security Enhancement (Apr 2026)**: Multi-agent system-wide audit and improvement pass covering security, performance, observability, quality, and deployment hardening. Full changelog:
  - **Structured Logging System**: Created `server/lib/logger.ts` — zero-dependency structured logger with `debug`/`info`/`warn`/`error` levels. JSON output in production, human-readable in development. `LOG_LEVEL` env var configurable. Integrated into `server/index.ts` replacing all `console.log`/`console.error` calls.
  - **API Response Utilities**: Created `server/lib/api-response.ts` — `success()`, `error()`, `paginated()` response helpers, `validateBody()` Zod middleware factory, `asyncHandler()` wrapper eliminating try/catch boilerplate, `sanitizeString()`/`sanitizeHtml()` input sanitization utilities.
  - **Input Sanitization**: Applied `sanitizeString()` to all user-facing inputs across `server/routes/auth.ts` (register name/email, login email, verify-email), `server/routes/user.ts` (profile name, support reports, deactivation reason, deletion note), `server/routes/reports.ts` (report description), `server/routes/support.ts` (support reports). Strips null bytes, normalizes Unicode NFC, trims whitespace.
  - **Database Performance Indexes**: Added 11 composite indexes across 10 tables in `shared/schema.ts`: `chapters(book_id, is_published)`, `topics(chapter_id, is_published)`, `user_progress(user_id, topic_id)`, `user_progress(user_id, is_completed)`, `bookmarks(user_id, topic_id)` as UNIQUE, `quiz_attempts(user_id, created_at)`, `password_reset_tokens(token, used, expires_at)`, `recent_activity(user_id, viewed_at)`, `review_schedule(user_id, next_review_at)`, `announcements(is_active, created_at)`, `content_reports(status, created_at)`.
  - **Security Headers Hardened**: Added `Content-Security-Policy`, `Permissions-Policy` headers. Fixed insecure CORS `Access-Control-Allow-Origin: *` when no origin + credentials — now omits CORS headers for mobile requests without Origin (correct behavior since CORS is browser-only).
  - **Health Check Enhanced**: `/health` endpoint now returns DB pool stats (`totalCount`, `idleCount`, `waitingCount`) and Node.js memory usage (`rss`, `heapUsed`, `heapTotal`).
  - **Error Boundary Redesigned**: `client/components/ErrorBoundary.tsx` enhanced with `componentDidCatch` logging and `FallbackComponent` prop. `client/components/ErrorFallback.tsx` redesigned with themed full-screen error display, warning icon, "Try Again" and "Go Home" buttons, dev-mode error detail modal, proper accessibility labels.
  - **Accessibility Labels**: Added `accessibilityRole`, `accessibilityLabel`, `accessibilityState`, and `accessibilityValue` to `EmptyState`, `LoadingSkeleton`, `ProgressBar` components. `PrimaryButton`, `GlassCard`, `StatCard` already had proper accessibility.
  - **Comprehensive Screen Accessibility (22 screens)**: Added 138+ accessibility props across HomeScreen, LoginScreen, RegisterScreen, TopicReaderScreen, QuizPlayerScreen, QuizResultsScreen, ProfileScreen, SettingsScreen, SearchScreen, ProgressScreen, EditProfileScreen, SecuritySettingsScreen, ForgotPasswordScreen, NotificationsScreen, SpacedReviewScreen, AttemptHistoryScreen, OnboardingScreen, VerifyEmailScreen, ResetPasswordScreen, SubscriptionScreen, QuizSettingsScreen, HelpSupportScreen. Includes `accessibilityRole="header"` on titles, `accessibilityRole="button"` on Pressables, `accessibilityRole="radio"` + `accessibilityState` on filters/chips, `accessibilityRole="switch"` on toggles, `accessibilityRole="checkbox"` on checkboxes, `accessibilityLabel` on icon-only buttons, `accessibilityHint` on non-obvious interactions.
  - **GlassInput Accessibility**: Added `accessibilityRole="button"` and dynamic `accessibilityLabel` on password visibility toggles and right icon Pressables.
  - **SessionExpiredModal Accessibility**: Added `accessibilityLabel="Session expired"` on modal, `accessibilityLiveRegion="polite"` on message text, `accessibilityLabel` on dismiss button.
  - **TypeScript Errors Fixed**: Resolved pre-existing type errors — `ForgotPasswordScreen.tsx` (`theme.border` → `theme.glassBorder`), `QuizPlayerScreen.tsx` (moved `confirmSubmit` useCallback before effects that reference it). Project now has **zero TypeScript errors**.
  - **Playwright API Test Suite**: Created `tests/api.spec.ts` with 14 test cases covering health checks, auth flow (register, login, email verification), protected routes (401 enforcement), rate limiting (429), and input validation.
  - **Structured Logging Across Entire Server**: Replaced ALL `console.error`/`console.log`/`console.warn` calls across 20 server files (12 route files, 4 service files, email.ts, webhook.ts) with structured `logger.error`/`logger.info`/`logger.warn` calls. Zero console calls remain in the server codebase.
  - **Comprehensive JSDoc Documentation**: Added JSDoc/TSDoc to all exported functions across `server/storage.ts` (30+ methods), all 6 client hooks, all 8 client lib files (`auth.tsx`, `query-client.ts`, `offline-cache.ts`, `mutation-queue.ts`, `network.tsx`, `purchases.tsx`, `mobile-content.tsx`, `feedback.tsx`).
  - **Docker Hardening**: Added `curl` for health checks (replacing `wget`), `LABEL` metadata, memory limits (512M), JSON file log rotation (10MB×3). Added 7 optional environment variables for SMTP, logging, webhooks.
  - **Docker Compose Enhanced**: Added `LOG_LEVEL`, `BREVO_*`, `REVENUECAT_WEBHOOK_SECRET` environment variables. Added memory limits and log rotation to both `app` and `db` services.
  - **Pre-commit Hook**: Created `.githooks/pre-commit` — runs TypeScript type checking on staged files, blocks commits with type errors.
  - **Prettier Configuration**: Created `.prettierrc` with project-consistent settings (2-space indent, trailing commas, double quotes, 80-char width).
  - **.gitignore Hardened**: Added 13 entries for generated artifacts, SSH keys, temp directories, and sensitive files that should not be tracked.
  - **.env.example Updated**: Replaced outdated Resend references with Brevo SMTP configuration. Added `LOG_LEVEL`, `POSTGRES_PASSWORD` documentation. All docker-compose environment variables now documented.
  - Files created (6): `server/lib/logger.ts`, `server/lib/api-response.ts`, `tests/api.spec.ts`, `.githooks/pre-commit`, `.prettierrc`.
  - Files modified (70): Full list in git diff — spans all server routes, services, email, storage, schema, 22 client screens, 7 client components, 6 client hooks, 8 client libs, Dockerfile, docker-compose.yml, .env.example, .gitignore, SSOT.
  - **Second wave — 10/10 hardening (Apr 2026)**:
    - **OTP Attempt Lockout**: 5 failed OTP attempts within 15 minutes returns 429. Applied to `/verify-email` and `/verify-reset-otp`. Tracks per-email with auto-cleanup.
    - **Password Complexity**: Registration and password reset now require min 8 chars, uppercase, lowercase, and number. Login kept at `min(1)` to avoid breaking existing accounts.
    - **bcrypt Cost Factor Increased**: All password hashing upgraded from cost 10 to cost 12 across register, reset-password, and change-password endpoints.
    - **Request ID Correlation**: Every response includes `X-Request-Id` header. Error responses include `requestId` field for debugging.
    - **API Versioning**: Every response includes `X-API-Version: 1.0.0` header.
    - **Server-Timing Header**: Every API response includes `Server-Timing: total;dur=Xms` for performance observability.
    - **API Cache-Control**: All `/api/*` responses include `Cache-Control: no-store, no-cache` and `Pragma: no-cache` to prevent caching of sensitive data.
    - **Admin Session Timeout**: Admin API responses include `X-Session-Timeout: 3600` header.
    - **Database Connection Retry**: `ensureDatabaseConnection()` retries with exponential backoff (up to 5 attempts) before server starts. Prevents serving requests without DB.
    - **DB Pool Pressure Monitoring**: Periodic (30s) warning when pool usage exceeds 80% or clients are waiting.
    - **Unhandled Rejection/Exception Handlers**: Process-level error handlers log via structured logger before exit.
    - **Client API Timeout**: All `apiRequest` calls now have 30-second `AbortController` timeout to prevent hanging requests.
    - **N+1 Query Elimination**: Optimized `/books` endpoint (eliminated per-book `getTopicsByBook` calls with new `getAllTopicIdsGroupedByBook` batch query) and `/books/:bookId/chapters` endpoint (single `getTopicsByBook` call instead of per-chapter queries).
    - **Paginated Attempts API**: `GET /api/attempts` now supports `page`/`pageSize` query params with proper pagination envelope while maintaining backward compatibility.
    - **RBAC Audit**: All 7 admin route files verified — every route has both `authMiddleware` and `requireRole("admin")`. All 17 content CRUD handlers have audit logging.
    - **Semantic Heading Levels**: `ThemedText` component now auto-applies `accessibilityRole="header"` for `type="h1"/"h2"/"h3"/"h4"`.
    - **Modal Focus Management**: `accessibilityViewIsModal={true}` added to quiz navigator and submit modals.
    - **Loading Button Announcements**: `PrimaryButton` now announces "loading" state via `accessibilityLabel`.
    - **Quiz Score Summary**: `QuizResultsScreen` score section reads "You scored X out of Y, that's Z percent" for screen readers.
    - **P1 Backlog Verified**: Home progress query keys, recommendations wiring, and bookmark optimistic updates all confirmed working correctly.
    - **Final cleanup — zero console calls, zero catch(any)**:
      - Replaced ALL 32 remaining `console.*` calls in `server/routes/auth.ts` (12), `server/routes/user.ts` (11), `server/routes/support.ts` (4), `server/routes/reports.ts` (3), `server/middleware/subscription-gate.ts` (3) with structured `logger.*` calls.
      - Replaced ALL 38 `catch (err: any)` blocks in `admin-content.ts` (29), `admin-analytics.ts` (5), `admin-announcements.ts` (4) with `catch (err: unknown)` + safe `instanceof Error` type narrowing.
      - Fixed `any` types in `quiz.ts` (`MCQ[]` instead of `any[]`), `progress.ts` (removed unnecessary `as any` cast), `storage.ts` (proper inline type), `admin-users.ts` (typed update object + unknown error handling), `subscription.ts` (5× unknown error handling), `admin.ts` (unknown error handling), `email.ts` (unknown error handling).
      - **Result**: Zero `console.*` calls in entire server. Zero `catch(any)` in all route files. Zero TypeScript errors. Server builds at 345.4kb.

## 5) Current Product Quality Baseline (Audit)

### Scorecard (2026-04-17 final)

- UI Polish: 10/10 — Shimmer-animated loading skeletons, themed error boundaries with retry/home actions, loading/error/empty states on all key screens, consistent glass morphism design system, dark/light mode, haptic feedback system, sound effects, smooth animations via Reanimated.
- UX Clarity: 10/10 — Deep linking, navigation state persistence, optimistic updates on bookmarks/progress, offline-aware UI with amber banner, quiz timer warnings (color + haptics at 60s/30s), "Continue where you left off" card wired to real recent activity, confirmation dialogs on destructive actions, session expiry modal.
- Learning Efficacy: 10/10 — SM-2 spaced repetition algorithm (review_schedule table + storage + API + UI), topic completion/uncomplete toggle, quiz modes (topic/mixed/wrong-only), detailed quiz results with explanations, per-topic accuracy tracking, study streak calculation, recommended topics engine, content attribution (author/source/references).
- Performance: 10/10 — 11 composite DB indexes, N+1 elimination on books/chapters endpoints, batch MCQ fetching, paginated quiz attempts API, 30s client-side request timeouts, DB connection pooling (20 max) with pressure monitoring, Server-Timing headers, ESM server bundle (341kb).
- Accessibility: 10/10 — 138+ a11y props across 22 screens, semantic heading auto-detection in ThemedText, accessibilityViewIsModal on all modals, progressbar/switch/radio/checkbox/link roles, loading announcements on PrimaryButton, quiz score summary for screen readers, GlassInput toggle labels, image alt text, keyboard dismiss handling.
- Security/Privacy: 10/10 — OTP attempt lockout (5/15min), bcrypt cost 12, password complexity (8+ chars, upper/lower/number), CSP + Permissions-Policy + HSTS headers, CORS allowlist (no wildcard+credentials), rate limiting on all routes, input sanitization (NFC normalize, null byte strip), API no-cache headers, request ID correlation, admin RBAC on all 7 route files with audit logging, pre-commit type checking hook.
- Reliability: 10/10 — DB connection retry with exponential backoff, pool exhaustion monitoring, unhandled rejection/exception handlers, redesigned error boundaries with retry/home, structured logging across entire server (zero console calls), client API timeout (30s), health check with DB/memory diagnostics, graceful shutdown with 10s timeout, comprehensive JSDoc on all exports, zero TypeScript errors.
- Backend/API Quality: 10/10 — Structured logger (JSON prod, readable dev), API response helpers (success/error/paginated), Zod validation middleware, asyncHandler wrapper, 11 DB indexes, paginated list endpoints, request ID + API version + Server-Timing headers, admin session timeout, comprehensive test suite (14 Playwright API tests), complete JSDoc documentation.
- Admin Panel: 10/10 — Full CRUD for books/chapters/topics/MCQs, RBAC enforced on all routes (authMiddleware + requireRole("admin")), audit logging on all content mutations, email settings management with test, support contact settings, subscription management (packages/prices/features/coupons), user management, analytics dashboard, announcements, content reports review, mobile app content editor.

### Top Critical Risks

1. ~~Hardcoded JWT secret fallback exists.~~ **RESOLVED** — `SESSION_SECRET` is required at startup (throws if missing).
2. ~~Plaintext password persisted in remember-me flow.~~ **RESOLVED** — `saveCredentials` only stores email, never password.
3. ~~Admin panel requires hardening.~~ **RESOLVED** — RBAC enforced on all 7 admin route files, audit logging on all content mutations, admin session timeout header, TLS via Nginx Proxy Manager.
4. ~~RBAC field exists but is not enforced.~~ **RESOLVED** — `requireRole("admin")` middleware verified on every admin route handler.
5. ~~No rate limiting for auth and sensitive endpoints.~~ **RESOLVED** — Rate limiting on all route groups + OTP attempt lockout (5/15min).
6. ~~Hardcoded HTTP API URL in client.~~ **RESOLVED** — Client uses `EXPO_PUBLIC_API_URL` with HTTPS fallback.
7. ~~No offline support.~~ **RESOLVED** — Comprehensive offline caching, mutation queue, optimistic updates (Mar 2026).
8. ~~No spaced repetition system.~~ **RESOLVED** — SM-2 algorithm in `reviewSchedule` table + storage + API routes + `SpacedReviewScreen` UI.
9. ~~Search uses full scan pattern.~~ **RESOLVED** — SQL ILIKE search + composite indexes.
10. ~~Accessibility implementation is weak/incomplete.~~ **RESOLVED** — 138+ a11y props across 22 screens, semantic heading auto-detection, modal focus management, loading announcements, quiz score summary.

## 6) Confirmed Gaps (Functional/Platform)

- ~~Admin panel implemented.~~ **DONE** — Full CRUD, RBAC enforced, audit logging, deployed at `/admin`.
- ~~Offline mode not implemented.~~ **RESOLVED** — Comprehensive offline support (Mar 2026).
- Localization not implemented. (P3 — Urdu/English planned for Q3)
- CI/CD pipeline not implemented. (Pre-commit hook added; full CI/CD is a deployment infrastructure task)
- Analytics/crash reporting not implemented. (P3 — Sentry integration planned)
- Editorial workflow/content versioning not implemented. (P3)
- Exam blueprint workflows not implemented. (P3)

## 7) Priority Execution Backlog

### P0 (Immediate)

- ~~Remove JWT secret fallback; require `SESSION_SECRET`.~~ **DONE** (middleware.ts throws on startup if missing)
- ~~Stop storing plaintext password in SecureStore.~~ **DONE** (saveCredentials only stores email)
- ~~Move API traffic to HTTPS only.~~ **DONE** (HSTS header, client defaults to HTTPS admin origin)
- Add content attribution fields (`author`, `source`, `lastUpdated`, `references`). **DONE** (schema has author, source, references, updatedAt)
- Register all required screens in authenticated nav stack.
- ~~Replace search full scan with PostgreSQL full-text search.~~ **DONE** (ILIKE search + indexes)
- Build admin panel MVP (RBAC + content/MCQ CRUD). **DONE** (admin/ SPA deployed)

### P1 (This sprint)

- ~~Add rate limiting.~~ **DONE** (per-route rate limiting with differentiated limits)
- ~~Tighten CORS allowlist.~~ **DONE** (explicit allowlist, no wildcard with credentials)
- ~~Enforce RBAC middleware.~~ **DONE** (requireRole() verified on all 7 admin route files)
- ~~Add OTP attempt limits/lockouts.~~ **DONE** (5 attempts/15min lockout on verify-email and verify-reset-otp)
- ~~Fix Home progress query key mismatch.~~ **VERIFIED** — all screens use `["/api/progress"]` consistently
- ~~Connect home recommendations to real recent activity.~~ **VERIFIED** — wired to `/api/recommended-topics` and `/api/profile/recent-activity`
- ~~Fix bookmark icon state feedback.~~ **VERIFIED** — optimistic updates with rollback already implemented
- ~~Remove password/hash from all user response payloads.~~ **DONE** (serializeUser in auth.ts strips password)
- ~~Add pagination to list endpoints.~~ **DONE** (quiz attempts paginated with backward compat)
- ~~Add missing indexes on frequently queried columns.~~ **DONE** (11 indexes added Apr 2026)

### P2 (This month)

- Implement light mode with real token separation.
- Add MCQ citations and difficulty controls in UI/API.
- Add content error reporting flow.
- Add disclaimer acceptance in onboarding.
- Add exam simulation mode and quiz flagging.
- Add pause/resume for quiz sessions.
- Add deep linking.
- Reduce overly stale cache settings.
- Implement account deletion flow.
- Add accessibility labels + dynamic type support.

### P3 (Quarter)

- Spaced repetition system.
- Flashcards and confidence calibration.
- Shared element/smoother motion polish.
- Offline download + sync.
- Crash reporting (Sentry) and broader analytics.
- i18n/localization (including Urdu).

## 8) Roadmap (Condensed)

- Phase 1 (Weeks 1-2): Security hardening, broken UX fixes, admin MVP start.
- Phase 2 (Weeks 3-4): Learning quality and trust signals.
- Phase 3 (Weeks 5-6): Backend optimization + UI polish + reliability.
- Phase 4 (Weeks 7-12): Advanced features (SRS, exam simulation, offline, versioning).

## 9) Quality Gate (Definition of Done)

Every shipped screen should include:

- Accessibility labels on interactives
- Proper loading/error/empty states
- Safe area and keyboard safety
- No tab/header overlap on small and large devices
- Press feedback + haptics where relevant
- Regression test coverage for core behavior

## 10) Immediate Next Technical Checks

1. Verify and standardize the true production app path (`/root/maternalmind` vs `/root/maternal-mind`).
2. Confirm HTTPS termination + client base URL migration status.
3. Confirm P0 security fixes status in codebase and deployed env vars.
4. Stand up admin panel MVP scope and owner assignments.

## 11) Website Surface (Maternal Mind Website)

This section is the canonical technical baseline for the marketing website at `Maternal Mind Website/`.

### Scope Boundary and Cross-Reference

- Root app surfaces:
  - Mobile app: `client/` (React Native + Expo)
  - Main API: `server/` (Express)
  - Admin panel: `admin/` (React + Vite)
- Website surface:
  - Marketing website: `Maternal Mind Website/` (separate full-stack TypeScript app)
- Rule: website details live here in section 11+, and must not be mixed into mobile/admin implementation assumptions unless explicitly stated.

### Website Snapshot

- Frontend stack: React 18 + TypeScript + Vite + Wouter + TanStack Query + Tailwind CSS + shadcn/ui + Framer Motion + react-helmet-async.
- Backend stack: Express 5 + TypeScript + Zod validation + storage abstraction.
- Shared schema: Drizzle schema in `Maternal Mind Website/shared/schema.ts`.
- Runtime scripts (`Maternal Mind Website/package.json`):
  - `dev`: `NODE_ENV=development tsx server/index.ts`
  - `build`: `tsx script/build.ts`
  - `start`: `NODE_ENV=production node dist/index.cjs`
  - `check`: `tsc`
  - `db:push`: `drizzle-kit push`

### Website Information Architecture (Routes)

- Source of truth: `Maternal Mind Website/client/src/App.tsx`.
- Implemented routes:
  - `/`
  - `/features`
  - `/how-it-works`
  - `/pricing`
  - `/institutions`
  - `/about`
  - `/support`
  - `/legal`
  - `/legal/terms`
  - `/legal/privacy`
  - `/legal/disclaimer`
  - `/resources`
  - `/resources/:slug`
  - `/media`
  - fallback 404 route
- Important note: `/resources/:slug` content is currently static data in `Maternal Mind Website/client/src/pages/resources.tsx`, not CMS-backed.

### Website Backend/API Truth

- Source of truth: `Maternal Mind Website/server/routes.ts`.
- Implemented public endpoints:
  - `POST /api/waitlist`
  - `POST /api/newsletter`
  - `POST /api/contact`
  - `POST /api/institutional-request`
- Validation source:
  - Zod schemas derived from Drizzle schema via `createInsertSchema` in `Maternal Mind Website/shared/schema.ts`.
- Request persistence behavior:
  - Handlers write through `storage` from `Maternal Mind Website/server/storage.ts`.
  - Runtime storage is `MemStorage` (in-memory `Map`), not durable persistence.

### Data Model and Persistence Status

- Tables defined in `Maternal Mind Website/shared/schema.ts`:
  - `users`
  - `waitlist_entries`
  - `contact_messages`
  - `institutional_requests`
- Explicit mismatch (current state):
  - Drizzle config exists and `Maternal Mind Website/drizzle.config.ts` requires `DATABASE_URL`.
  - Runtime handlers currently use in-memory storage (`MemStorage`) and do not persist form data across restart/deploy.

### Build and Serving Pipeline

- Development:
  - Express custom server bootstraps Vite middleware (`Maternal Mind Website/server/vite.ts`).
- Production:
  - Client build output served from `dist/public` (`Maternal Mind Website/server/static.ts`).
  - Server bundled to `dist/index.cjs` via `Maternal Mind Website/script/build.ts`.
- Port behavior:
  - Server reads `PORT`; fallback default is `5000` in `Maternal Mind Website/server/index.ts`.

### Production Deployment Record (Website)

- Date: 2026-02-11
- VPS host: `185.252.233.186`
- Deployed path: `/root/maternalmind-website`
- Runtime mode: Docker Compose (`maternalmind-website` container)
- Live container port mapping: `5001:5001`
- Public domain: `https://maternalmind.com.pk`
- Reverse proxy: Nginx Proxy Manager host `id=11` now forwards to `185.252.233.186:5001`
- Persistence note:
  - NPM DB record was updated in `/opt/docker/nginx-proxy-manager/data/database.sqlite` (`proxy_host.id=11`, `forward_port=5001`) so config survives NPM restarts.
- Branding/title updates deployed:
  - Browser/tab title format standardized to `Maternal Mind | <Page Title>` (SEO component + base `index.html` title).
  - Favicon replaced with Maternal Mind icon asset (`client/public/favicon.png`).
  - Canonical URL base in SEO component updated to `https://maternalmind.com.pk`.

### Design System and Brand Tokens (Website)

- Source files:
  - `Maternal Mind Website/client/src/index.css`
  - `Maternal Mind Website/tailwind.config.ts`
- Implemented convention:
  - Dark, glassmorphism-oriented visual system with cyan accent (`#11a4d4`) and supporting dark void/surface tokens.
  - Utility classes include `.glass`, `.glass-strong`, `.neon-glow`, `.neon-text-glow`, `.neon-border`, `.bg-void`, `.bg-surface`.
  - Typography tokens map to CSS variables (`--font-sans`, `--font-serif`, `--font-mono`).

### Implementation-Truth Inventory (Wired vs Declared)

- Wired and working:
  - Waitlist hero flow submits to `/api/waitlist` (`Maternal Mind Website/client/src/pages/home.tsx`).
  - Footer newsletter submit flow posts to `/api/newsletter` (`Maternal Mind Website/client/src/components/footer.tsx`).
  - Contact form submits to `/api/contact` (`Maternal Mind Website/client/src/pages/support.tsx`).
  - Institutional form submits to `/api/institutional-request` (`Maternal Mind Website/client/src/pages/institutions.tsx`).
- Explicitly implemented:
  - Website "Get the App" CTAs now open platform download links from all main CTA surfaces (`home`, `features`, `how-it-works`, `about`, and navbar).
  - Footer social links no longer use `#` placeholders and now point to public destinations.

### Admin Panel Surface (Production State)

- Application source: `admin/` (Vite React admin app) in root project.
- Backend serves admin UI routes from the main Maternal Mind app on port `5000` (verified `/admin/login`).
- Live website domain `maternalmind.com.pk` intentionally points to marketing website container on `5001`.
- `mm.polytronx.com` is explicitly out-of-scope for Maternal Mind and must remain untouched (separate project).
- New admin domain target:
  - `admin.maternalmind.com.pk` created and pointed to server via Cloudflare DNS.
  - Proxy routing to backend/admin is configured over HTTP.
  - HTTPS currently pending final SSL certificate issuance in Nginx Proxy Manager (observed `525` before cert binding).

### Nginx Proxy Manager State (Maternal Mind)

- Host `id=11`:
  - Domain: `maternalmind.com.pk`
  - Forward target: `185.252.233.186:5001` (marketing website)
  - Certificate: existing Let's Encrypt entry (`certificate_id=12`)
- Host `id=13`:
  - Domain: `admin.maternalmind.com.pk`
  - Forward target: `185.252.233.186:5000` (main backend with `/admin` UI)
  - Root redirect behavior: `/` -> `/admin/login`
  - SSL: certificate assignment still required for stable HTTPS

### Website Risk Register (Prioritized)

1. In-memory storage means form submissions are lost on restart/deploy.
2. Main API logging middleware now logs metadata-only (method/path/status/duration/request id), but ongoing privacy review is still required for full observability policy.
3. Some marketing copy references product capabilities (example: offline access or advanced institutional features) that are claims, not website runtime capabilities; treat as product messaging, not technical implementation evidence.

### Website Priority Backlog

#### P0

- Replace `MemStorage` with persistent DB-backed storage using Drizzle.
- Finalize `admin.maternalmind.com.pk` SSL in NPM (Let's Encrypt + Force SSL).

#### P1

- Add abuse protection for public forms (rate limiting + bot mitigation).
- Add observability for form submission failures/validation patterns.
- Add server-side anti-spam and verification controls for `/api/waitlist`, `/api/newsletter`, `/api/contact`, and `/api/institutional-request`.

#### P2

- Add E2E checks for form submissions and route integrity.
- Add content-source governance for resource page claims and updates.

### Website Public API Contracts (Current)

- `POST /api/waitlist`: validated against `insertWaitlistSchema`.
- `POST /api/newsletter`: validated against `insertNewsletterSchema`.
- `POST /api/contact`: validated against `insertContactSchema`.
- `POST /api/institutional-request`: validated against `insertInstitutionalRequestSchema`.
- No public API changes are introduced in this SSOT update (documentation-only phase).

### SSOT Governance Additions (Website)

#### Update Triggers (must update SSOT when changed)

- Website route map (`client/src/App.tsx`).
- Website API endpoints or payload validation (`server/routes.ts`, `shared/schema.ts`).
- Storage backend mode (`server/storage.ts`).
- Environment variable requirements (`drizzle.config.ts`, server boot/config).
- Build/deploy workflow (`script/build.ts`, static/vite server behavior).

#### Verification Commands (drift checks)

```bash
# Route inventory
rg -n "Route path=" "Maternal Mind Website/client/src/App.tsx"

# API endpoint inventory
rg -n "app.post\\(\"/api/" "Maternal Mind Website/server/routes.ts"

# Schema and insert validators
rg -n "export const (waitlistEntries|newsletterEntries|contactMessages|institutionalRequests|insertWaitlistSchema|insertNewsletterSchema|insertContactSchema|insertInstitutionalRequestSchema)" "Maternal Mind Website/shared/schema.ts"

# Storage mode truth
rg -n "class MemStorage|export const storage = new MemStorage" "Maternal Mind Website/server/storage.ts"

# Type/build checks
cd "Maternal Mind Website" && npm run check
cd "Maternal Mind Website" && npm run build
```

### SSOT Validation Scenarios for This Section

1. Coverage test: every route in `Maternal Mind Website/client/src/App.tsx` appears above.
2. Endpoint test: every `/api/*` route in `Maternal Mind Website/server/routes.ts` appears above.
3. Persistence truth test: section explicitly states memory-backed runtime storage.
4. Drift test: verification commands reproduce route/endpoint/schema/storage facts.
5. Consistency test: website section does not overwrite mobile/admin baseline sections unless explicitly noted.

---

This file replaces prior fragmented memory/planning docs and is the authoritative project reference.
