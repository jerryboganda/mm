# Maternal Mind - Single Source of Truth (SSOT)

Last updated: 2026-03-04
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

## 5) Current Product Quality Baseline (Audit)

### Scorecard (2026-02-07 audit)
- UI Polish: 6.5/10
- UX Clarity: 6.0/10
- Learning Efficacy: 4.5/10
- Performance: 5.5/10
- Accessibility: 3.0/10
- Security/Privacy: 4.0/10
- Reliability: 5.0/10
- Backend/API Quality: 5.5/10
- Admin Panel: 6/10 (deployed web admin surface; hardening/polish pending)

### Top Critical Risks
1. Hardcoded JWT secret fallback exists.
2. Plaintext password persisted in remember-me flow.
3. Admin panel is deployed but requires dedicated production hardening (auth/session security review, TLS finalization on admin subdomain, operational SOP).
4. RBAC field exists but is not enforced.
5. No rate limiting for auth and sensitive endpoints.
6. Hardcoded HTTP API URL in client.
7. No offline support.
8. No spaced repetition system.
9. Search uses full scan pattern (performance/scalability risk).
10. Accessibility implementation is weak/incomplete.

## 6) Confirmed Gaps (Functional/Platform)
- Admin panel implemented and routed via backend `/admin`; dedicated HTTPS subdomain finalization in progress.
- Offline mode not implemented.
- Localization not implemented.
- CI/CD pipeline not implemented.
- Analytics/crash reporting not implemented.
- Editorial workflow/content versioning not implemented.
- Exam blueprint workflows not implemented.

## 7) Priority Execution Backlog

### P0 (Immediate)
- Remove JWT secret fallback; require `SESSION_SECRET`.
- Stop storing plaintext password in SecureStore.
- Move API traffic to HTTPS only.
- Add content attribution fields (`author`, `source`, `lastUpdated`, `references`).
- Register all required screens in authenticated nav stack.
- Replace search full scan with PostgreSQL full-text search.
- Build admin panel MVP (RBAC + content/MCQ CRUD).

### P1 (This sprint)
- Add rate limiting.
- Tighten CORS allowlist.
- Enforce RBAC middleware.
- Add OTP attempt limits/lockouts.
- Fix Home progress query key mismatch.
- Connect home recommendations to real recent activity.
- Fix bookmark icon state feedback.
- Remove password/hash from all user response payloads.
- Add pagination to list endpoints.
- Add missing indexes on frequently queried columns.

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
