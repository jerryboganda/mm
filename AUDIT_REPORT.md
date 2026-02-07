# Maternal Mind — Complete 2026 Premium Audit Report

**Audit Date:** February 7, 2026  
**Auditor:** GitHub Copilot (Claude Opus 4.6)  
**App:** Maternal Mind — OB-GYN Medical Education Platform  
**Tech Stack:** React Native 0.81.5 + Expo SDK 54 + Express 5 + Drizzle ORM + PostgreSQL  

---

## 1) Executive Summary

### Overall Assessment
Maternal Mind has a **solid functional foundation** for a medical education app: structured content (Books → Chapters → Topics), MCQ quizzes with three modes, progress tracking, bookmarks, and an auth flow with email/phone verification. The codebase is reasonably organized with clear separation of concerns.

However, **significant gaps** prevent it from meeting the **2026 premium standard** set out in the audit plan. Key issues span security, learning pedagogy, performance, accessibility, and UI polish.

### Overall Scorecard

| Dimension | Score | Grade |
|---|---|---|
| **UI Polish** | 6.5/10 | B- |
| **UX Clarity** | 6.0/10 | C+ |
| **Learning Efficacy** | 4.5/10 | D+ |
| **Performance** | 5.5/10 | C |
| **Accessibility** | 3.0/10 | F |
| **Security/Privacy** | 4.0/10 | D |
| **Reliability** | 5.0/10 | C |
| **Backend/API Quality** | 5.5/10 | C |
| **Admin Panel** | 0/10 | N/A (Missing) |

### Top 10 Risks

1. **CRITICAL: Hardcoded JWT secret** — `"maternal-mind-secret-key"` fallback in production enables token forging
2. **CRITICAL: Password stored in plaintext in SecureStore** via "Remember Me" — stores actual password string
3. **CRITICAL: No admin panel exists** — no way to manage content, users, MCQs without direct DB access
4. **HIGH: No RBAC enforcement** — `role` field exists on users but is never checked on any API endpoint
5. **HIGH: No rate limiting** — all endpoints (auth, quiz, search) are unprotected against brute force
6. **HIGH: Hardcoded API URL** — `http://185.252.233.186:5000` (HTTP, not HTTPS) in production
7. **HIGH: No offline support** — zero caching, no download capability, no offline reading
8. **HIGH: No spaced repetition** — core learning science feature completely absent
9. **MEDIUM: Search performs full table scan** — iterates all books/chapters/topics on every query
10. **MEDIUM: No accessibility implementation** — zero `accessibilityLabel`, no dynamic type, no screen reader support

### Top 10 Wins

1. **Well-structured data model** — Books → Chapters → Topics → ContentBlocks/MCQs hierarchy is sound
2. **Glass morphism design** — Consistent, visually appealing dark theme with glass effects
3. **Haptic feedback** — Good use of `expo-haptics` throughout interactions
4. **Quiz flow is complete** — Topic, Mixed, Wrong Questions modes all functional
5. **Auth flow is comprehensive** — Email verification OTP, phone OTP, password reset all exist
6. **Animated interactions** — Good use of `react-native-reanimated` for card press animations
7. **Type safety** — Zod schemas + TypeScript + Drizzle ORM provide good type coverage
8. **Error boundary** — App-level `ErrorBoundary` with fallback component
9. **Network awareness** — `NetworkProvider` + `AppNetworkWrapper` detect connectivity changes
10. **Progressive content** — Previous/Next topic navigation enables sequential reading

### Premium Gap Analysis

The biggest gaps preventing "premium feel":
- **No content attribution/references** — Medical content lacks citations, "last updated" dates, errata flow
- **No light mode** — Dark mode only (theme hook hardcodes `isDark = true`)
- **Static recommendations** — HomeScreen has hardcoded "recommended topics" instead of personalized suggestions
- **No search indexing** — Full table scan search with no relevance ranking
- **No animations on transitions** — Screen transitions use default native stack (no shared element transitions)
- **No skeleton loaders on key screens** — Only some screens have loading skeletons
- **No "Continue where you left off"** — Recent activity exists in DB but HomeScreen uses empty mock data

---

## 2) Inputs Intake — Confirmed vs. Missing

### What We Have ✅
| Input | Value |
|---|---|
| App name | Maternal Mind |
| Platforms | iOS, Android (+ web partial) |
| Expo workflow | Bare (expo SDK 54, `expo run:android/ios` scripts) |
| Navigation | React Navigation 7 (Native Stack + Bottom Tabs) |
| State management | TanStack React Query v5 |
| UI framework | Custom glass-morphism (BlurView + LinearGradient + Reanimated) |
| Auth model | Email/password + OTP email verification + phone OTP (Twilio) |
| Content types | Text blocks, headings, images, notes |
| MCQ types | Single-best-answer only |
| Backend stack | Express 5 + Drizzle ORM + PostgreSQL |
| API style | REST |
| Purchases | RevenueCat (react-native-purchases) |
| Fonts | Inter (Google Fonts, 5 weights) |

### What's Missing ❌
| Input | Status |
|---|---|
| Admin panel | **NOT IMPLEMENTED** — No admin routes, no admin UI |
| Offline support | Not implemented |
| Localization | English only, no i18n |
| CI/CD | Not configured |
| Analytics/crash reporting | Not configured (no Sentry, no Firebase) |
| Spaced repetition | Not implemented |
| Content versioning | Not implemented |
| Editorial workflow | Not implemented |
| RBAC enforcement | Schema has `role` field but never checked |
| Exam blueprints | Not implemented (no FCPS/MRCOG structure) |

---

## 3) Screen Inventory & Key Journeys

### Complete Screen Inventory (45 screens)

| # | Screen | Category | Auth Required | Notes |
|---|---|---|---|---|
| 1 | WelcomeScreen | Onboarding | No | App intro with features |
| 2 | OnboardingScreen | Onboarding | No | 4-slide carousel |
| 3 | PermissionsPromptScreen | Onboarding | No | Notification permissions |
| 4 | LoginScreen | Auth | No | Email/password + remember me |
| 5 | RegisterScreen | Auth | No | Name + email + password |
| 6 | VerifyEmailScreen | Auth | Partial | OTP input for email |
| 7 | VerifyPhoneScreen | Auth | Yes | OTP input for phone (5-day rule) |
| 8 | ForgotPasswordScreen | Auth | No | Email input |
| 9 | ResetPasswordScreen | Auth | No | Token + new password |
| 10 | HomeScreen | Core | Yes | Dashboard with stats, recommendations |
| 11 | LearnScreen | Core | Yes | Book listing with progress |
| 12 | ChaptersScreen | Core | Yes | Chapter listing for a book |
| 13 | TopicsScreen | Core | Yes | Topic listing for a chapter |
| 14 | TopicReaderScreen | Core | Yes | Content reader with blocks |
| 15 | SearchScreen | Core | Yes | Search across books/chapters/topics |
| 16 | PracticeScreen | Core | Yes | Quiz mode selection |
| 17 | QuizTopicSelectScreen | Core | Yes | Topic selector for quiz |
| 18 | QuizPlayerScreen | Core | Yes | MCQ quiz interface |
| 19 | QuizResultsScreen | Core | Yes | Score + answer review |
| 20 | QuizSettingsScreen | Core | Yes | Timer/difficulty config |
| 21 | ProgressScreen | Core | Yes | Stats + topic accuracy + attempts |
| 22 | TopicProgressDetailScreen | Core | Yes | Per-topic analytics |
| 23 | AttemptHistoryScreen | Core | Yes | Filtered attempt list |
| 24 | AttemptDetailScreen | Core | Yes | Full attempt review |
| 25 | ProfileScreen | Core | Yes | User info + settings menu |
| 26 | EditProfileScreen | Core | Yes | Name edit |
| 27 | SettingsScreen | Core | Yes | App preferences |
| 28 | SecuritySettingsScreen | Core | Yes | Password change |
| 29 | BookmarksScreen | Core | Yes | Saved topics |
| 30 | RecentActivityScreen | Core | Yes | Topic view history |
| 31 | SubscriptionScreen | Core | Yes | Subscription details |
| 32 | PaywallScreen | Core | Yes | Purchase flow |
| 33 | CheckoutProcessingScreen | Core | Yes | Payment processing |
| 34 | PurchaseSuccessScreen | Core | Yes | Success confirmation |
| 35 | PurchaseFailedScreen | Core | Yes | Failure handling |
| 36 | RestorePurchasesScreen | Core | Yes | Restore flow |
| 37 | HelpSupportScreen | Core | Yes | FAQs + issue reporting |
| 38 | AboutScreen | Core | Yes | App info |
| 39 | TermsPrivacyScreen | Core | Yes | Legal content |
| 40 | DisclaimerScreen | Core | Yes | Medical disclaimer |
| 41 | NotificationsScreen | Core | Yes | Announcements |
| 42 | ModalScreen | Core | Yes | Generic modal |
| 43 | OfflineScreen | Core | No | Offline state |
| 44 | MaintenanceScreen | Core | No | Maintenance state |
| 45 | ErrorScreen | Core | No | Error state |

### Key User Journeys

**Journey 1: Discover → Study → Bookmark**
```
Welcome → Login → Home → Library Tab → Select Book → Chapters → Topics → TopicReader → Bookmark → Mark Complete
```

**Journey 2: Practice MCQs**
```
Home → Quiz Tab → Select Mode (Topic/Mixed/Wrong) → [Topic Select] → QuizPlayer → Answer Questions → Submit → QuizResults → Review Answers
```

**Journey 3: Track Progress**
```
Home → Progress Tab → View Stats → Topic Accuracy → TopicProgressDetail → AttemptHistory → AttemptDetail
```

**Journey 4: Search & Find**
```
Library → Search → Type query → Filter (All/Books/Chapters/Topics) → Select Result → TopicReader
```

---

## 4) UI/UX Audit Findings (Premium 2026)

### 4.1 Design System Quality

| Aspect | Status | Finding |
|---|---|---|
| **Typography** | ✅ Good | 12 typography variants with proper hierarchy (hero→caption), Inter font family, good letter spacing |
| **Color System** | ⚠️ Partial | Dark theme only. Light/dark identical tokens. No semantic color mapping. |
| **Spacing** | ✅ Good | Consistent 8pt-based spacing system (4,8,12,18,24,32,40,52,64,80,96) |
| **Border Radius** | ✅ Good | Consistent scale (8,12,16,20,24,32,40,full) |
| **Shadows** | ✅ Good | Well-defined shadow system with glow variants per color |
| **Iconography** | ⚠️ Adequate | Uses Feather icons consistently, but medical domain could benefit from custom icons |
| **Glass morphism** | ✅ Strong | Well-implemented with BlurView + LinearGradient + animated borders |

**Findings:**

| ID | Issue | Severity | Evidence | Recommendation |
|---|---|---|---|---|
| UI-001 | Light mode not supported | P2 | `useTheme()` hardcodes `isDark = true` | Implement theme switching with proper light color tokens |
| UI-002 | Light and Dark color tokens are identical | P2 | `Colors.light` === `Colors.dark` in theme.ts | Define distinct light mode palette |
| UI-003 | No semantic color tokens | P2 | Components reference `Colors.dark.success` directly | Create semantic tokens: `surface`, `onSurface`, `surfaceVariant` etc. |
| UI-004 | Inconsistent Text component usage | P1 | SearchScreen uses raw `<Text>` while others use `<ThemedText>` | Enforce `ThemedText` everywhere via lint rule |

### 4.2 IA & Navigation

| ID | Issue | Severity | Evidence | Recommendation |
|---|---|---|---|---|
| NAV-001 | No "Continue Learning" real data | P1 | HomeScreen has hardcoded `recommendedTopics` with fake IDs like "rec1" | Connect to `/api/recent-activity` and show actual recent/in-progress topics |
| NAV-002 | Missing many screens in RootStackNavigator | P0 | TopicReader and other screens registered but missing between Disclaimer and VerifyPhone entries | Audit and register ALL screens (QuizTopicSelect, QuizPlayer, QuizResults, etc. missing from authenticated stack) |
| NAV-003 | No deep linking | P2 | No linking configuration in NavigationContainer | Add deep link support for topic URLs, quiz results, password reset |
| NAV-004 | No breadcrumb trail | P2 | TopicReader shows title but no Book > Chapter > Topic path | Add breadcrumb or subtitle showing hierarchy |

### 4.3 Interaction Design

| ID | Issue | Severity | Evidence | Recommendation |
|---|---|---|---|---|
| INT-001 | Bookmark icon doesn't change | P1 | TopicReaderScreen bookmark uses `"bookmark"` for both states (line: `name={topic?.isBookmarked ? "bookmark" : "bookmark"}`) | Change to `"bookmark"` (filled) vs `"bookmark"` with different styling, or use filled/outline variants |
| INT-002 | No pull-to-refresh on Progress screen list items | P3 | Topic accuracy list is not refreshable separately | Consider collapsible sections |
| INT-003 | Quiz "Next" button works without selection | P2 | `handleNext()` navigates even without selection (disabled prop exists but user can navigate) | Enforce answer selection or show "Skip?" confirmation |

### 4.4 Empty/Error/Loading States

| ID | Issue | Severity | Evidence | Recommendation |
|---|---|---|---|---|
| STATE-001 | Missing error handling on quiz start | P1 | If `/api/quiz/start/:mode` fails, QuizPlayerScreen shows infinite loading skeleton | Add error state with retry button |
| STATE-002 | QuizResults shows undefined data gracefully | P2 | If result query fails, renders "0%" and empty arrays | Add error/loading states |
| STATE-003 | HomeScreen progress query uses wrong key | P1 | Uses `/api/user/progress` but actual endpoint is `/api/progress` | Fix query key to match actual endpoint |

---

## 5) Learning Experience Audit

### 5.1 Retrieval Practice Support

| Feature | Status | Assessment |
|---|---|---|
| Quizzes | ✅ Implemented | Topic, Mixed, Wrong Questions modes |
| Spaced repetition | ❌ Missing | No SRS algorithm, no interval tracking, no review scheduling |
| Flashcards | ❌ Missing | Not implemented |
| Review sessions | ⚠️ Partial | "Wrong Questions" mode exists but no smart scheduling |

### 5.2 Explanation Quality

| ID | Issue | Severity | Evidence | Recommendation |
|---|---|---|---|---|
| LEARN-001 | No distractor rationale | P1 | MCQ schema only has single `explanation` field | Add per-option explanations: why each wrong option is wrong |
| LEARN-002 | No references in explanations | P2 | No `reference` or `citation` field in MCQ schema | Add reference fields (guideline, page, edition) |
| LEARN-003 | No difficulty filtering in quiz | P2 | `getMCQs()` accepts difficulty param but UI doesn't expose it | Add difficulty filter in QuizSettingsScreen |
| LEARN-004 | Questions limited to 10 always | P1 | `quiz.ts` hardcodes `.slice(0, 10)` | Make configurable via quiz settings |

### 5.3 Topic Mastery Visualization

| Feature | Status | Assessment |
|---|---|---|
| Accuracy per topic | ✅ Implemented | ProgressScreen shows topic accuracy % |
| Accuracy trend | ⚠️ Partial | Backend returns `accuracyTrend` but no chart in UI |
| Weak areas identification | ❌ Missing | No algorithm to surface weakest topics |
| Milestones/badges | ❌ Missing | No gamification elements |
| Study streaks | ⚠️ Incomplete | HomeScreen shows "Study Streak" stat but backend doesn't calculate it |

### 5.4 Exam Mode Realism

| ID | Issue | Severity | Evidence | Recommendation |
|---|---|---|---|---|
| EXAM-001 | No real exam simulation | P1 | No FCPS/MRCOG timed blocks, no negative marking | Add exam mode with configurable rules |
| EXAM-002 | Timer hardcoded to 10 minutes | P2 | Server returns `timeLimit: 10` always | Make configurable, support per-question timing |
| EXAM-003 | No question bookmarking during quiz | P2 | Can't flag uncertain questions for review | Add flag/mark for review during quiz |
| EXAM-004 | No pause/resume functionality | P2 | Quitting quiz loses all progress | Implement quiz state persistence |

### 5.5 Content Credibility (Medical Education)

| ID | Issue | Severity | Evidence | Recommendation |
|---|---|---|---|---|
| TRUST-001 | No content attribution | P0 | ContentBlocks have no author, source, or reference fields | Add `author`, `source`, `lastUpdated`, `references` to schema |
| TRUST-002 | No "Last Updated" on topics | P1 | Topics only have `createdAt`, no `updatedAt` | Add and display update timestamps |
| TRUST-003 | No errata/report mechanism for content | P1 | Users can report issues via Support but not flag specific content errors | Add per-topic/per-MCQ "Report Error" button |
| TRUST-004 | Medical disclaimer not prominent | P2 | DisclaimerScreen exists but isn't shown during onboarding | Show disclaimer acceptance during first launch |

---

## 6) Functional QA & Test Scenarios

### 6.1 Critical Path Tests

| Test ID | Journey | Steps | Expected | Status |
|---|---|---|---|---|
| QA-001 | Registration | 1. Enter name, email, password → 2. Submit → 3. Check email OTP → 4. Enter OTP | Account created, redirected to home | ✅ Flow exists |
| QA-002 | Login | 1. Enter email/password → 2. Submit | Authenticated, see HomeScreen | ✅ Flow exists |
| QA-003 | Login with unverified email | 1. Login with unverified account | 403 with code `EMAIL_NOT_VERIFIED`, redirect to VerifyEmail | ✅ Handled |
| QA-004 | Browse content | 1. Library → Book → Chapters → Topics → TopicReader | Content displayed | ✅ Flow exists |
| QA-005 | Take quiz | 1. Practice → Topic Quiz → Select topic → Answer → Submit | Results shown | ✅ Flow exists |
| QA-006 | Wrong questions retry | 1. After quiz with wrong answers → Practice → Wrong Questions | Only wrong questions shown | ✅ Implemented |
| QA-007 | Bookmark toggle | 1. Open topic → Tap bookmark | Bookmark toggled | ⚠️ Icon doesn't visually change |
| QA-008 | Mark complete | 1. Read topic → Mark as Complete | Progress updated | ✅ Works |
| QA-009 | Password reset | 1. Forgot Password → Enter email → Get token → Reset | Password changed | ✅ Flow exists |

### 6.2 Edge Case Tests

| Test ID | Scenario | Expected | Risk |
|---|---|---|---|
| EDGE-001 | Submit quiz with 0 answers | Should handle gracefully, score 0% | ⚠️ Unanswered marked as wrong but UI may confuse |
| EDGE-002 | Network loss during quiz | Quiz progress should persist or warn | ❌ No offline handling — quiz data lost |
| EDGE-003 | Token expiry mid-session | Should show session expired modal | ⚠️ `SessionExpiredModal` exists but `setSessionExpired` is never called automatically |
| EDGE-004 | Rapid bookmark toggle | Should handle debouncing | ❌ No debounce on bookmark mutation — can cause race conditions |
| EDGE-005 | Very long topic title | UI should truncate properly | ⚠️ `numberOfLines` used in some places but not TopicReaderScreen title |
| EDGE-006 | Empty content blocks | Topic with no blocks | ❌ No empty state for topic with zero blocks |
| EDGE-007 | Concurrent quiz submissions | Should be idempotent | ❌ No idempotency check — can create duplicate attempts |
| EDGE-008 | HTML/XSS in content | Rendered safely | ⚠️ Content blocks render as plain Text — safe but can't render rich HTML |
| EDGE-009 | Unicode/RTL in content | Display correctly | ❌ No RTL support |
| EDGE-010 | Session expiry during quiz | Clear UX | ❌ API 401 during quiz submit crashes — no error handling in mutation |

### 6.3 Auth Edge Cases

| Test ID | Scenario | Risk |
|---|---|---|
| AUTH-001 | OTP brute force | ❌ No rate limiting on verify-email/verify-phone endpoints |
| AUTH-002 | Expired OTP reuse | ✅ Checked against `emailTokenExpiresAt` |
| AUTH-003 | Password reset token replay | ✅ `used` flag prevents reuse |
| AUTH-004 | Register with existing email | ✅ Returns 400 |
| AUTH-005 | JWT token after password change | ❌ Old tokens remain valid — no token revocation |

---

## 7) Performance Audit

### 7.1 Backend Performance Issues

| ID | Issue | Severity | Evidence | Fix |
|---|---|---|---|---|
| PERF-001 | N+1 query in books endpoint | P1 | `/api/books` loops through each book, fetches chapters, then topics individually | Use SQL JOINs or batch queries |
| PERF-002 | N+1 query in search | P0 | `/api/search` fetches ALL books, then ALL chapters for each, then ALL topics — full table scan per search | Implement full-text search index (PostgreSQL `tsvector`) |
| PERF-003 | N+1 query in quiz topics | P1 | `/api/quiz/topics` iterates all books→chapters→topics→MCQs | Single JOIN query |
| PERF-004 | N+1 query in progress | P1 | `/api/progress` iterates all books→chapters→topics for every request | Pre-aggregate or cache |
| PERF-005 | Wrong questions full scan | P2 | `getWrongQuestions()` fetches ALL attempts, then ALL mcqs, filters in JS | Use SQL query with NOT IN subquery |
| PERF-006 | No query caching | P2 | Every API call hits DB directly, `staleTime: Infinity` masks this | Add server-side caching or reduce `staleTime` |
| PERF-007 | No pagination on attempts | P2 | `getQuizAttempts` returns ALL attempts for a user | Add limit/offset pagination |

### 7.2 Frontend Performance Issues

| ID | Issue | Severity | Evidence | Fix |
|---|---|---|---|---|
| PERF-008 | React Query staleTime: Infinity | P2 | Data never auto-refreshes unless manually triggered | Set appropriate stale times per endpoint |
| PERF-009 | No image caching strategy | P2 | Using `expo-image` (good) but no cache policy set | Configure Image cache policy |
| PERF-010 | Multiple re-renders on HomeScreen | P2 | Stats array recreated every render (not memoized) | Use `useMemo` for computed data |
| PERF-011 | Animated.Value instead of Reanimated | P3 | OnboardingScreen uses `Animated` from RN core, not Reanimated | Migrate to Reanimated for consistent 60fps |

---

## 8) Security & Privacy Audit

### 8.1 Critical Security Issues

| ID | Issue | Severity | Evidence | Impact | Fix |
|---|---|---|---|---|---|
| SEC-001 | **Hardcoded JWT secret** | **P0** | `middleware.ts`: `process.env.SESSION_SECRET \|\| "maternal-mind-secret-key"` | Attacker can forge any JWT | Remove fallback, require env var |
| SEC-002 | **Plaintext password in SecureStore** | **P0** | `auth.tsx`: `saveCredentials(email, password)` stores raw password | If device compromised, password exposed | Store only auth token, remove "Remember Me" password storage |
| SEC-003 | **HTTP API URL** | **P0** | `query-client.ts`: `return "http://185.252.233.186:5000"` | All data transmitted in cleartext including passwords | Enforce HTTPS |
| SEC-004 | **No rate limiting** | **P1** | No middleware for rate limiting on any endpoint | Brute force attacks on login, OTP, password reset | Add `express-rate-limit` middleware |
| SEC-005 | **CORS allows any origin** | **P1** | `server/index.ts`: echoes back any `Origin` header | CSRF attacks possible | Whitelist allowed origins |
| SEC-006 | **No token revocation** | **P2** | JWT tokens valid until expiry (7 days) even after password change | Compromised tokens usable for 7 days | Implement token blocklist or reduce expiry |
| SEC-007 | **No input sanitization** | **P2** | Content blocks rendered as-is, support email includes raw user input | Stored XSS possible in admin content, email injection | Sanitize all user inputs |
| SEC-008 | **No RBAC enforcement** | **P1** | `users.role` exists but no middleware checks it | Any authenticated user can access all endpoints | Add role-checking middleware |
| SEC-009 | **No request body size limit** | **P2** | `express.json()` has no `limit` option | DoS via large payloads | Add `{ limit: '10kb' }` |
| SEC-010 | **OTP brute force** | **P1** | No attempt limit on OTP verification endpoints | 6-digit OTP crackable in ~1M attempts | Add attempt counter + lockout |

### 8.2 Privacy Issues

| ID | Issue | Severity | Evidence | Fix |
|---|---|---|---|---|
| PRIV-001 | Password returned in user object | P1 | `storage.getUser()` returns full user including `password` hash | Strip `password` field in all user responses |
| PRIV-002 | No PII redaction in logs | P2 | Request logging includes full response bodies | Redact sensitive fields (email, name) from logs |
| PRIV-003 | No data deletion mechanism | P2 | No "delete my account" feature | Add account deletion endpoint (GDPR requirement) |
| PRIV-004 | No consent tracking | P2 | No record of ToS/Privacy policy acceptance | Track acceptance timestamps |

---

## 9) Backend/API Audit

### 9.1 API Design Issues

| ID | Issue | Severity | Evidence | Fix |
|---|---|---|---|---|
| API-001 | Inconsistent error response format | P2 | Some endpoints return `{ message }`, some return `{ error }` | Standardize on `{ message, code, details }` |
| API-002 | No API versioning | P2 | All routes at `/api/*` with no version prefix | Add `/api/v1/*` prefix |
| API-003 | Dual mounting of user routes | P2 | `app.use("/api/profile", userRoutes); app.use("/api", userRoutes);` — same router mounted twice | Clean up route mounting |
| API-004 | No pagination on list endpoints | P1 | `/api/books`, `/api/attempts` return all records | Add `limit`, `offset`, `cursor` params |
| API-005 | Quiz start uses GET for state change | P2 | `GET /api/quiz/start/:mode` — should be POST | Change to POST as it creates quiz state |
| API-006 | No request validation middleware | P1 | Only auth routes validate input with Zod | Add Zod validation to all mutation endpoints |
| API-007 | Topic navigation via `setParams` | P2 | TopicReader uses `navigation.setParams()` which doesn't trigger re-fetch | Navigate to new screen instance instead |

### 9.2 Data Model Issues

| ID | Issue | Severity | Evidence | Fix |
|---|---|---|---|---|
| DATA-001 | No MCQ tags/categories | P1 | MCQs only linked to topics, no cross-topic tagging | Add `tags` jsonb field or separate tags table |
| DATA-002 | No content block rich formatting | P2 | Content blocks are plain text, no markdown/HTML support | Add markdown rendering or rich content types |
| DATA-003 | No quiz attempt deduplication | P2 | Same quiz can be submitted multiple times | Add quiz session tracking |
| DATA-004 | No indexes on frequently queried columns | P1 | `bookmarks.userId`, `quizAttempts.userId`, `userProgress.userId` have no explicit indexes | Add composite indexes |
| DATA-005 | No soft delete | P2 | `onDelete: "cascade"` used everywhere | Add `deletedAt` for audit trail |

### 9.3 Missing Backend Features

| Feature | Priority | Effort |
|---|---|---|
| Full-text search (PostgreSQL tsvector) | P0 | 2-3 days |
| Rate limiting middleware | P0 | 1 day |
| Admin CRUD endpoints | P0 | 1-2 weeks |
| Pagination on all list endpoints | P1 | 2-3 days |
| Spaced repetition algorithm | P1 | 1 week |
| Content versioning (audit log) | P2 | 1 week |
| Bulk import/export endpoints | P2 | 1 week |
| Push notification endpoints | P2 | 3-5 days |

---

## 10) Admin Panel Audit

### Finding: Admin Panel Does Not Exist

**Severity: P0 — CRITICAL**

There is **no admin panel** in the codebase. The server has no admin routes, no admin authentication, and no content management endpoints. All content must currently be managed via direct database access.

### Required Admin Panel Features (Priority Order)

| Priority | Feature | Description |
|---|---|---|
| P0 | Content CRUD | Create/edit/delete books, chapters, topics, content blocks |
| P0 | MCQ Management | Create/edit/delete MCQs with explanations, difficulty, options |
| P0 | User Management | View users, change roles, subscription management |
| P1 | Content Preview | Preview how content renders on mobile |
| P1 | Bulk Import | CSV/JSON import for MCQs and content |
| P1 | Publishing Workflow | Draft → Review → Publish states |
| P1 | Analytics Dashboard | User stats, quiz performance, popular content |
| P2 | Content Versioning | History of changes with rollback |
| P2 | Audit Logs | Track all admin actions |
| P2 | Duplicate Detection | Find similar/duplicate MCQs |
| P3 | Scheduled Publishing | Set publish date/time |
| P3 | Content Validation | Check for missing explanations, broken images |

---

## 11) Priority Backlog (P0 → P3)

### P0 — Critical (Fix Immediately)

| ID | Area | Issue | Fix | Effort | Owner |
|---|---|---|---|---|---|
| SEC-001 | Security | Hardcoded JWT secret fallback | Remove fallback, require `SESSION_SECRET` env var | 15 min | BE |
| SEC-002 | Security | Plaintext password in SecureStore | Store only auth token for "Remember Me", not password | 1 hr | FE |
| SEC-003 | Security | HTTP API URL | Switch to HTTPS, configure SSL | 2 hrs | DevOps |
| TRUST-001 | Learning | No content attribution | Add `author`, `source`, `lastUpdated`, `references` fields to schema | 1 day | BE |
| NAV-002 | UX | Missing screens in RootStackNavigator | Register all screens in authenticated stack | 2 hrs | FE |
| PERF-002 | Performance | Search full table scan | Implement PostgreSQL full-text search | 2-3 days | BE |
| ADMIN-001 | Admin | No admin panel exists | Build admin panel with content CRUD | 2-3 weeks | Full |

### P1 — High (Fix This Sprint)

| ID | Area | Issue | Fix | Effort | Owner |
|---|---|---|---|---|---|
| SEC-004 | Security | No rate limiting | Add `express-rate-limit` on auth + sensitive endpoints | 1 day | BE |
| SEC-005 | Security | CORS allows any origin | Whitelist specific origins | 1 hr | BE |
| SEC-008 | Security | No RBAC enforcement | Add role-checking middleware, protect admin routes | 1 day | BE |
| SEC-010 | Security | OTP brute force | Add attempt counter + lockout after 5 failures | 4 hrs | BE |
| LEARN-001 | Learning | No distractor rationale | Add per-option explanations to MCQ schema | 1 day | BE/FE |
| LEARN-004 | Learning | Hardcoded 10 questions | Make question count configurable | 4 hrs | BE/FE |
| NAV-001 | UX | Hardcoded recommended topics | Connect to actual recent activity data | 4 hrs | FE |
| INT-001 | UI | Bookmark icon doesn't change state | Fix icon variant for bookmarked vs unbookmarked | 30 min | FE |
| STATE-003 | UX | Wrong query key on HomeScreen | Fix `/api/user/progress` → `/api/progress` | 15 min | FE |
| PERF-001 | Performance | N+1 queries in books endpoint | Rewrite with SQL JOINs | 1 day | BE |
| PRIV-001 | Privacy | Password in user response | Strip password field from all responses | 1 hr | BE |
| API-004 | Backend | No pagination | Add pagination to all list endpoints | 2-3 days | BE |
| UI-004 | UI | Inconsistent Text components | Replace all `<Text>` with `<ThemedText>` | 2 hrs | FE |
| DATA-004 | Backend | Missing database indexes | Add indexes on userId columns | 1 hr | BE |

### P2 — Medium (Fix This Month)

| ID | Area | Issue | Fix | Effort | Owner |
|---|---|---|---|---|---|
| UI-001 | UI | No light mode | Implement theme switching | 3-5 days | FE |
| LEARN-002 | Learning | No references in MCQs | Add citation fields to schema + UI | 2 days | Full |
| LEARN-003 | Learning | No difficulty filter in quiz | Expose difficulty selection in quiz settings | 1 day | FE |
| TRUST-002 | Learning | No "Last Updated" display | Show update timestamps on topics | 4 hrs | FE |
| TRUST-003 | Learning | No content error reporting | Add "Report Error" button on topics/MCQs | 1 day | Full |
| TRUST-004 | Learning | Disclaimer not in onboarding | Add disclaimer acceptance in onboarding flow | 4 hrs | FE |
| EXAM-001 | Learning | No exam simulation mode | Build timed exam mode with FCPS/MRCOG settings | 1 week | Full |
| EXAM-003 | Learning | No question flagging in quiz | Add flag/mark for review button | 1 day | FE |
| EXAM-004 | Learning | No quiz pause/resume | Persist quiz state to AsyncStorage | 2 days | FE |
| NAV-003 | UX | No deep linking | Configure linking config in NavigationContainer | 2 days | FE |
| PERF-008 | Performance | staleTime: Infinity | Set appropriate stale times per query | 2 hrs | FE |
| SEC-006 | Security | No token revocation | Add token blocklist or reduce JWT expiry to 1 day | 1 day | BE |
| PRIV-003 | Privacy | No account deletion | Add "Delete Account" endpoint + UI | 1 day | Full |
| API-002 | Backend | No API versioning | Prefix routes with `/api/v1/` | 2 hrs | BE |
| A11Y-001 | Accessibility | No accessibility labels | Add labels to all interactive elements | 3-5 days | FE |
| A11Y-002 | Accessibility | No dynamic type support | Implement font scaling | 2 days | FE |

### P3 — Low (Fix This Quarter)

| ID | Area | Issue | Fix | Effort | Owner |
|---|---|---|---|---|---|
| LEARN-005 | Learning | No spaced repetition | Implement SRS algorithm (SM-2 or similar) | 2 weeks | Full |
| LEARN-006 | Learning | No flashcard mode | Build flashcard UI + backend support | 1 week | Full |
| LEARN-007 | Learning | No confidence calibration | Add "confidence" rating per answer | 1 week | Full |
| UI-005 | UI | No shared element transitions | Implement with Reanimated 4 | 1 week | FE |
| PERF-011 | Performance | RN Animated in OnboardingScreen | Migrate to Reanimated | 2 hrs | FE |
| OFFLINE-001 | Feature | No offline support | Implement content downloading + SQLite cache | 3 weeks | Full |
| ANALYTICS-001 | Feature | No crash reporting | Integrate Sentry | 1 day | DevOps |
| I18N-001 | Feature | No localization | Add i18n support with Urdu translation | 2 weeks | Full |

---

## 12) Premium Upgrade Blueprint

### Phase 1: Foundation (Weeks 1-2)

**Goal:** Fix critical security, add admin panel MVP, fix broken UX flows

1. **Security hardening** (Days 1-2)
   - Remove JWT secret fallback
   - Switch to HTTPS
   - Remove plaintext password storage
   - Add rate limiting
   - Fix CORS
   
2. **Fix broken UX** (Days 3-4)
   - Fix RootStackNavigator screen registration
   - Fix HomeScreen query key
   - Fix bookmark icon state
   - Connect real data to "Continue Learning" section
   
3. **Admin Panel MVP** (Days 5-10)
   - Admin auth + RBAC middleware
   - CRUD for Books, Chapters, Topics, ContentBlocks, MCQs
   - Basic user listing
   - Build with React + Vite + TailwindCSS

### Phase 2: Learning Quality (Weeks 3-4)

**Goal:** Improve learning outcomes, add trust signals

1. **Content credibility** (Days 1-3)
   - Add attribution fields to schema
   - Display "Last Updated" on topics
   - Add "Report Error" mechanism
   - Show medical disclaimer during onboarding

2. **Quiz improvements** (Days 4-7)
   - Configurable question count
   - Difficulty filtering
   - Per-option explanations
   - Question flagging during quiz
   - Quiz pause/resume

3. **Progress enhancements** (Days 8-10)
   - Accuracy trend charts (use react-native-svg or victory-native)
   - Weak topic identification algorithm
   - Study streak calculation

### Phase 3: Performance & Polish (Weeks 5-6)

**Goal:** Achieve premium performance and polish

1. **Backend optimization** (Days 1-3)
   - Rewrite N+1 queries with JOINs
   - Add PostgreSQL full-text search
   - Add pagination everywhere
   - Add database indexes

2. **UI polish** (Days 4-7)
   - Light/dark mode toggle
   - Accessibility labels on all elements
   - Dynamic type support
   - Screen transition animations
   - Deep linking

3. **Reliability** (Days 8-10)
   - Add Sentry crash reporting
   - Implement token refresh flow
   - Auto-detect session expiry
   - Quiz data persistence

### Phase 4: Advanced Features (Weeks 7-12)

**Goal:** Achieve competitive feature parity with premium education apps

1. **Spaced repetition system** (Week 7-8)
2. **Exam simulation mode** (Week 8-9) 
3. **Offline support** (Week 9-10)
4. **Advanced analytics** (Week 10-11)
5. **Content versioning + editorial workflow** (Week 11-12)

### Design System Tokens to Standardize

```
Tokens needed:
├── Color/
│   ├── Primary (brand cyan)
│   ├── Semantic (success, warning, error, info)
│   ├── Surface (background levels 0-4)
│   ├── On-Surface (text on each surface)
│   └── Interactive (pressed, disabled, focused)
├── Typography/
│   ├── Display (hero, h1)
│   ├── Title (h2, h3, h4)
│   ├── Body (body, bodyMedium)
│   ├── Detail (small, caption, label)
│   └── Mono (code, stat)
├── Spacing/
│   └── 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 (✅ exists)
├── Radius/
│   └── xs, sm, md, lg, xl, 2xl, full (✅ exists)
├── Shadow/
│   └── elevation1-5, glow variants (✅ exists)
└── Motion/
    ├── duration: fast(150ms), normal(300ms), slow(500ms)
    ├── easing: spring configs (✅ partially exists)
    └── haptic: light, medium, heavy, success, error (✅ used)
```

### Quality Bar Checklist (Per Screen Release)

- [ ] All interactive elements have `accessibilityLabel`
- [ ] All text uses `ThemedText` component
- [ ] Loading state with skeleton loader
- [ ] Error state with retry button
- [ ] Empty state with guidance
- [ ] Pull-to-refresh where applicable
- [ ] Haptic feedback on actions
- [ ] Press animation on tappable elements
- [ ] Safe area handling (top, bottom, keyboard)
- [ ] Content doesn't overlap tab bar or header
- [ ] Works on small phones (320pt width)
- [ ] Works on large phones (428pt width)
- [ ] Works on tablets (768pt+ width)
- [ ] No hardcoded strings (ready for i18n)
- [ ] Test IDs on key elements
- [ ] Error boundaries around data-dependent sections

---

## 13) Appendices

### Appendix A: User Testing Task Scripts

**Task 1 — Find & Study**
> "You're preparing for your FCPS exam. Find notes on Postpartum Hemorrhage and study the key management steps."
- **Success criteria:** Reaches correct topic via Library or Search within 60 seconds, can read comfortably, bookmarks it
- **Metrics:** Time-to-task, # taps, confusion points

**Task 2 — Practice MCQs by Topic**
> "Do 10 MCQs on Hypertensive Disorders in Pregnancy and review the explanations for questions you got wrong."
- **Success criteria:** Completes quiz, sees score, reviews wrong answers with explanations
- **Metrics:** Completion rate, time, understanding of explanations

**Task 3 — Timed Exam Block**
> "Start a timed mixed quiz block to simulate exam conditions."
- **Success criteria:** Clear timer visibility, can submit, sees results
- **Metrics:** Timer awareness, submit confidence, results comprehension

**Task 4 — Weak Areas Review**
> "Find your weakest topic area and start a targeted practice session."
- **Success criteria:** Identifies weak topic from Progress tab, navigates to topic quiz
- **Metrics:** Can locate weakness, starts targeted practice

**Task 5 — Search**
> "Search for 'shoulder dystocia' and navigate to the topic."
- **Success criteria:** Finds relevant result, navigates successfully
- **Metrics:** Time-to-result, relevance of results

**Task 6 — Trust Verification**
> "You suspect an explanation for an MCQ answer is outdated. Try to report it."
- **Success criteria:** Finds report mechanism (currently: Help & Support only)
- **Metrics:** Discoverability, confidence in reporting

### Appendix B: Acceptance Criteria Templates

**For Security Fixes:**
```
GIVEN an attacker with knowledge of the codebase
WHEN they attempt to [exploit vector]
THEN the system must [prevention mechanism]
AND the attempt must be logged
AND the user must be notified if appropriate
```

**For Learning Features:**
```
GIVEN a student studying for [exam type]
WHEN they [action]
THEN they must see [learning outcome]
AND their progress must be [tracked/updated]
AND the data must persist across sessions
```

**For UI Components:**
```
GIVEN the component is rendered
THEN it must have accessibilityLabel
AND it must support dynamic type scaling
AND it must have proper press/focus states
AND it must handle loading/error/empty states
AND it must work on screen widths 320-428pt
```

### Appendix C: Database Schema Recommendations

**New tables needed:**
- `content_flags` — User reports on content errors
- `quiz_sessions` — Track active quiz state for pause/resume
- `spaced_repetition_cards` — SRS scheduling data
- `admin_audit_logs` — Track all admin actions
- `content_versions` — Version history for content blocks
- `tags` + `mcq_tags` — Flexible tagging system

**Schema modifications:**
- `mcqs`: Add `references`, `option_explanations` (jsonb), `tags` (jsonb)
- `topics`: Add `updatedAt`, `author`, `source`, `version`
- `content_blocks`: Add `format` (plain/markdown/html), `metadata` (jsonb)
- `users`: Add `deletedAt`, `lastLoginAt`, `loginAttempts`

---

*End of Audit Report*
