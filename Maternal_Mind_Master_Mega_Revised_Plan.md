# Maternal Mind — Master Mega Prompt (2026 Premium Audit)
**Purpose:** Use this prompt to instruct an agentic AI to perform a **complete, end-to-end audit** of the **Maternal Mind** mobile app (React Native + Expo) and its **Admin Panel**, covering **UI/UX, functionality, backend/API, content workflows, performance, accessibility, security/privacy, analytics, and structured user testing**—benchmarked to **2026 “premium” product standards**.

> **Context:** Maternal Mind is a **medical education** app focused on **Obstetrics & Gynecology** postgraduate exam prep (e.g., **FCPS**, **MRCOG**). Core features include **notes**, **study materials**, **MCQ/quiz bank**, progress tracking, and content management via an admin panel.

---

## 0) Operating Rules (Non‑Negotiable)
1. **Be exhaustive and systematic.** Assume issues exist unless disproven.
2. **No hand‑waving.** Every finding must include: **Evidence → Impact → Severity → Fix → Acceptance Criteria**.
3. **Premium requirement:** the app must look/feel premium in **typography, spacing, motion, microinteractions, and speed**.
4. **Domain-aware:** treat this as a **medical education** product—accuracy, trust, and safety signals matter.
5. **Privacy by default:** no patient data should ever be required; if any patient-like data appears in content, flag it as a critical issue.
6. If you lack access to the app/code, produce the **inspection plan + scripts + test cases** and proceed using provided artifacts (build, videos, screenshots, logs, API samples).
7. Use **2026 best practices** for mobile UI/UX, accessibility, privacy/security, reliability, and observability.
8. Output must be **actionable**: prioritized backlog, test suite, component/token recommendations, and clear next steps.

---

## 1) Inputs Intake (Start Immediately; Don’t Block Progress)
Confirm what you have and what you don’t. Then proceed.

### App & Platform
- App name: **Maternal Mind**
- Targets: iOS / Android / tablet? `{PLATFORMS}`
- Expo workflow: Managed vs Bare `{EXPO_WORKFLOW}`; Expo SDK `{EXPO_SDK}`
- Navigation: `{NAV_LIB}` (Expo Router / React Navigation)
- State management: `{STATE}` (React Query / Redux / Zustand, etc.)
- UI framework: `{UI_SYSTEM}` (NativeWind/Tamagui/custom)
- Localization: `{LOCALES}` (English/Urdu/etc.)
- Auth model: `{AUTH}` (email/pass, OTP, social, etc.)

### Learning Product Requirements (Key)
- Learning modes: notes / PDFs / videos / audio / flashcards? `{CONTENT_TYPES}`
- MCQ system: single-best-answer, SBA, EMQ, true/false, image-based? `{MCQ_TYPES}`
- Exam blueprints: FCPS/MRCOG modules, topics, subtopics `{SYLLABUS_STRUCTURE}`
- Scoring + analytics: accuracy, speed, weak areas `{LEARNING_ANALYTICS}`
- Question metadata: difficulty, tags, references, explanations `{MCQ_METADATA}`
- Content governance: editorial review, citation requirements, version history `{EDITORIAL_WORKFLOW}`

### Backend & Admin
- Backend stack `{BACKEND}`; API style `{API_STYLE}` (REST/GraphQL)
- File storage/CDN `{STORAGE}`
- Admin panel stack `{ADMIN_TECH}`; roles/RBAC `{RBAC}`
- CI/CD `{CI_CD}`; environments dev/staging/prod `{ENVS}`
- Analytics/crash `{ANALYTICS}` (Sentry/Firebase/Amplitude)

### Access Artifacts (If Available)
- TestFlight/APK `{BUILD_LINK}`
- Repo read access `{REPO_ACCESS}`
- Admin credentials with limited role `{ADMIN_LOGIN}`
- API docs / Postman collection `{API_DOCS}`
- Screenshots/screen recording `{MEDIA}`

---

## 2) Required Deliverables
Produce the following artifacts in your final response.

### A) Executive Summary
- Overall score across: **UI polish, UX clarity, learning effectiveness, performance, accessibility, reliability, security/privacy, backend/API quality, admin usability**
- Top 10 risks + top 10 wins
- **“Premium Gap”**: what prevents Maternal Mind from feeling premium

### B) Priority Backlog (Actionable)
Format for every item:
- **ID** | **Area** | **Issue** | **Evidence** | **Severity (P0–P3)** | **User impact** | **Root cause (hypothesis)** | **Fix** | **Effort** | **Acceptance criteria** | **Owner** (Design/FE/BE/Admin/QA)

### C) UI/UX Audit Report (Premium 2026)
- Design system quality (type, color, spacing, radii, elevation, iconography)
- IA & navigation (topic taxonomy, filters, breadcrumbs, “continue learning”)
- Interaction design (tap targets, states, feedback, empty/error/loading)
- Microinteractions & motion (meaningful, not gimmicky; no jank)
- Content readability (dense medical text, tables, references)
- Accessibility (contrast, dynamic type, SR labels, reduced motion)
- Responsiveness (small phones → large phones → tablets; keyboard; safe areas)

### D) Learning Experience Audit (Education-Specific)
Evaluate whether Maternal Mind improves outcomes:
- Retrieval practice support (quizzes, spaced repetition, review sessions)
- Explanation quality & distractor rationale
- Topic mastery visualization (weak areas, milestones)
- “Exam mode” realism (timed blocks, mixed sets, negative marking if relevant)
- Confidence calibration (flag uncertain, revisit, error log)
- References/citations workflow (guidelines, updates, errata)
- Anti-cheat/integrity considerations (if needed)

### E) Functional QA + User Journey Testing
A full suite of test scenarios and edge cases for:
- onboarding + auth
- browse notes/materials
- search + filter + tags
- download/offline reading
- MCQ quiz flows (practice, timed, review, explanation, bookmarks)
- progress tracking (streaks, charts, history)
- sync across devices
- purchases/subscriptions (if any)
- push notifications/deep links
- accessibility paths
- failure recovery: offline, 429, 500, timeouts

Each test: steps, expected result, instrumentation notes.

### F) Performance Audit (Mobile + Admin)
- cold start, warm start, screen transitions, list rendering
- heavy content: PDFs/images, large question banks
- network: payload sizes, caching, pagination, retries/backoff
- RN/Expo: Hermes, FlatList, image caching, memory, reanimated usage
- admin performance: bundle size, table virtualization, search performance

### G) Security & Privacy Audit (Medical Education Context)
- Auth/session/token storage + refresh flows
- RBAC for admin (content editors vs admins)
- API security: rate limiting, input validation, permissions
- PII handling: user accounts, payments, telemetry, error logs redaction
- **Prohibited content checks:** any patient-identifiable data in notes/images
- Compliance posture recommendations (region-dependent): GDPR/UK, etc.
- OWASP-style risks for mobile + admin

### H) Backend/API Audit
- Consistent API contracts + error schema
- Versioning, pagination/filtering/search
- Data model integrity for MCQs, explanations, references, tags
- Editorial workflow support: draft/publish, scheduled release, rollback, audit logs
- Observability: logs/metrics/traces; alerting readiness
- Reliability patterns: retries, idempotency, background jobs

### I) Admin Panel Audit
- IA & usability for large content operations
- Content workflows: creating questions, importing bulk, tagging, reviewing
- Preview (mobile rendering parity), scheduling, version history, audit logs
- Safety rails: destructive actions, permissions, confirmations
- QA tools: content validation rules, broken link scans, duplicate detection

### J) Premium Upgrade Blueprint (2–6w and 6–12w)
- Design system tokens & components to standardize (RN + admin)
- Motion guidelines and haptics usage
- High-leverage screens to redesign first
- Quality bar checklist for every screen prior to release
- Delight features that help learning (not distractions)

---

## 3) Methodology (Must Follow)
### Step 1 — Map the Product
- Build a **screen inventory** (every screen, modal, sheet)
- Identify user roles and permissions
- Create **journey maps** for:
  - Discover content → study → quiz → review → track progress
  - Topic mastery improvement loop

### Step 2 — Heuristic + Premium Review
Use:
- Nielsen heuristics + modern mobile patterns
- “Premium 2026” checklist (Section 6)
- Medical education trust signals (references, update notes, errata)

### Step 3 — Structured User Testing (Required)
Run (or simulate if users unavailable):
- **5–8 representative users**: FCPS/MRCOG candidates, junior trainees, repeat users
- Tasks aligned to key journeys
- Capture: time-on-task, success, confusion, rage taps, drop-offs, trust issues
- Output a table: issue, frequency, severity, recommended fix, supporting quotes

If real users unavailable, do:
- Persona-based tasks + cognitive walkthrough
- Red-team misuse tests (e.g., content import mistakes, permission leakage)

### Step 4 — Technical Review
Frontend:
- architecture, navigation/state patterns, error boundaries
- performance hot spots: lists, images, PDF rendering, animations
Backend:
- auth/RBAC, validation, observability, reliability
Admin:
- roles, bulk workflows, safety rails

### Step 5 — Fix Plan + Acceptance Criteria
- Quick wins (1–3 days)
- Medium (1–2 weeks)
- Strategic (1–3 months)
Include regression tests for each.

---

## 4) “Premium 2026” Standard (Enforce This)
### Visual System
- Consistent **8pt spacing** + clear hierarchy
- Typography tuned for **dense medical content** (readability > aesthetics)
- Icon system consistent; minimal visual noise
- Elevation/shadows consistent and modern
- High-quality empty states + guidance

### Interaction + Motion
- Instant tap feedback; pressed states; optional haptics
- Motion supports continuity (screen transitions, expanding cards)
- Skeleton loaders where relevant; no blank flashes
- Bottom sheets/modals predictable; back behavior consistent

### Responsiveness
- Great on small phones, big phones, and tablets
- Safe areas, keyboard avoidance, dynamic island/notch patterns
- Landscape support where relevant (e.g., tables/figures)

### Accessibility
- Contrast, dynamic type, screen reader labels
- Reduced motion, focus order, error announcements
- Tap targets ≥ 44pt; adequate line height for long passages

### Trust Signals (Medical Education)
- Content attribution and references
- “Last updated” and change logs for high-stakes content
- Errata/flag content mechanism
- Clear separation between **education** and **clinical advice**

---

## 5) Output Format (Strict)
Your final response must be structured:

1. Executive Summary  
2. Scorecard (UI, UX, Learning Efficacy, Perf, A11y, Security/Privacy, Reliability, Backend, Admin)  
3. Screen Inventory + Key Journeys  
4. UI/UX Findings (with references to screens/recordings)  
5. Learning Experience Findings  
6. Functional QA Findings  
7. Performance Findings  
8. Security/Privacy Findings  
9. Backend/API Findings  
10. Admin Panel Findings  
11. Priority Backlog (P0–P3)  
12. Premium Upgrade Blueprint (2–6w / 6–12w)  
13. Appendices: Test Cases, Heuristic Checklist, Acceptance Criteria Templates  

**Each finding must include:**
- Evidence
- Impact
- Severity
- Recommendation
- Acceptance Criteria
- Regression Tests

---

## 6) Inspection Checklist (Education + App Quality)
At minimum evaluate:
- Onboarding clarity + time-to-first-value (find a topic and start studying fast)
- Topic taxonomy and discoverability (search/tags/filters)
- Study flows (reading, highlighting, bookmarking, note-taking if present)
- Quiz flows (practice, timed, review, explanations, analytics)
- “Mistake notebook” / incorrect set review
- Offline support for core materials
- Sync + data integrity across devices
- Content credibility: references, updates, errata, report problem
- Error states everywhere + recovery
- Session expiry handling
- Push/deeplink correctness
- Accessibility pass
- Performance pass (PDFs, images, long lists)
- Admin: bulk import, validation, preview parity, audit logs, RBAC boundaries

---

## 7) User Testing Task Scripts (Ready-to-Run)
Use these tasks; adapt wording to the tester’s exam (FCPS/MRCOG).

### Task 1 — Find & Study
- Goal: “Find notes on **Postpartum Hemorrhage** and study the key steps.”
- Success: reaches correct topic, can read comfortably, bookmarks it, and finds references.

### Task 2 — Practice MCQs by Topic
- Goal: “Do 10 MCQs on **Hypertensive Disorders in Pregnancy** and review explanations.”
- Success: completes set, understands explanations, can bookmark mistakes, sees performance.

### Task 3 — Timed Exam Block
- Goal: “Start a **timed mixed block** (e.g., 30 questions) like your exam style.”
- Success: clear timer, pause rules (if any), submit, review incorrect, analytics recorded.

### Task 4 — Weak Areas Loop
- Goal: “Identify your weakest area and start a targeted revision session.”
- Success: easily finds weak topic, creates targeted set, tracks improvement.

### Task 5 — Offline Use
- Goal: “Download materials and use the app in airplane mode.”
- Success: content clearly available offline, no confusing errors, sync later works.

### Task 6 — Search + Filters
- Goal: “Search for ‘shoulder dystocia’ and filter to MCQs with images (if supported).”
- Success: relevant results, filters clear, no dead ends.

### Task 7 — Trust & Reporting
- Goal: “You suspect an explanation is outdated—report it.”
- Success: reporting flow exists, acknowledges submission, content notifies editorial queue.

Collect: time-on-task, confusion points, misclicks, satisfaction (1–7), trust rating (1–7).

---

## 8) Start Now (Your First Output Section Must Include)
1) What inputs you have vs missing  
2) A draft **screen inventory** template customized to Maternal Mind  
3) The above **user testing scripts** (included) + metrics sheet  
4) Initial **premium gap hypotheses** for medical education apps  
5) A **priority backlog skeleton** (P0–P3) ready to fill

---

## 9) Optional Multi-Agent Split (If Supported)
- Agent A: UI/UX + premium polish + design system tokens
- Agent B: Learning experience + pedagogy + quiz analytics
- Agent C: Functional QA + test cases + edge cases
- Agent D: Performance + RN/Expo optimization
- Agent E: Security/privacy + backend/API + admin RBAC
Merge into one backlog.

---

## 10) Placeholders to Fill (Optional)
- One-liner: `{ONE_LINER}`
- Primary users: `{USERS}`
- Top journeys: `{TOP_JOURNEYS}`
- Monetization: `{MONETIZATION}`
- Premium references: `{PREMIUM_REFERENCE_APPS}` (e.g., “Duolingo-level polish, Notion-level reading experience”)

---
**End of Prompt**
