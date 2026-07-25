# Maternal Mind — All-in-One Master Documentation & Feature Guide

> **Medical Education Platform for Obstetrics & Gynecology (OB-GYN)**  
> *Tailored for FCPS, MRCOG, and Post-Graduate Medical Examinations*

---

## 1. Executive Summary & Core Mission

**Maternal Mind** is a state-of-the-art, cross-platform medical education ecosystem specifically designed for OB-GYN doctors, post-graduate trainees, and medical students preparing for high-stakes certification examinations such as **FCPS (Part 1 & Part 2)** and **MRCOG (Parts 1, 2 & 3)**.

### Primary Purpose
Medical postgraduate exams in Obstetrics & Gynecology demand deep clinical synthesis, mastery of guidelines (e.g., RCOG, ACOG, NICE), and continuous self-assessment. Traditional study approaches rely on fragmented textbooks, bulky PDFs, and unstructured question banks. Maternal Mind solves this by providing:
- A **structured digital textbook hierarchy** (Books → Chapters → Topics → Content Blocks).
- An **integrated clinical MCQ practice engine** with detailed explanations.
- An automated **Spaced Repetition (SM-2 Algorithm)** revision system.
- An **offline-first mobile architecture** allowing doctors to study seamlessly in hospital wards, operating theatres, or areas with poor internet connectivity.

---

## 2. Technical Stack & Architecture Baseline

Maternal Mind is engineered as a high-performance, containerized, multi-platform solution:

```
                  ┌─────────────────────────────────────────┐
                  │          Maternal Mind System           │
                  └────────────────────┬────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌───────────────────────┐                             ┌───────────────────────┐
│   Mobile App (Expo)   │                             │  Admin Portal (React) │
│ - React Native 0.81.5 │                             │ - Vite + React 19     │
│ - TanStack Query v5   │                             │ - TailwindCSS         │
│ - Reanimated + Blur   │                             │ - Content & User CRUD │
└───────────┬───────────┘                             └───────────┬───────────┘
            │                                                     │
            │                  REST API (JSON)                    │
            └──────────────────────────┬──────────────────────────┘
                                       │
                                       ▼
                         ┌───────────────────────────┐
                         │   Express.js 5 API Server │
                         │ - TypeScript / Node.js    │
                         │ - Drizzle ORM             │
                         │ - Structured Logging      │
                         └─────────────┬─────────────┘
                                       │
                                       ▼
                         ┌───────────────────────────┐
                         │  PostgreSQL Database      │
                         │ - 11 Composite Indexes    │
                         │ - SM-2 Review Schedule    │
                         │ - Strict Foreign Keys     │
                         └───────────────────────────┘
```

| Component | Technology / Framework | Purpose & Highlight |
| :--- | :--- | :--- |
| **Mobile App** | React Native 0.81.5 + Expo SDK 54 | Mobile-first iOS & Android experience with native stack navigation. |
| **Admin Panel** | React 19 + Vite + TailwindCSS | Web dashboard for medical content editors, user management, and payment verification. |
| **Backend API** | Express.js 5 + TypeScript | RESTful JSON API server with strict input sanitization and zero-console structured logging. |
| **Database** | PostgreSQL + Drizzle ORM | Relational data persistence with composite indexing and optimized batch queries. |
| **Design System** | Glassmorphic Dark UI | Dark-themed glassmorphism with neon cyan accents, custom blur effects, and Inter typography. |
| **Containerization**| Docker Engine + Docker Compose | Containerized VPS setup behind Nginx Proxy Manager with SSL termination. |

---

## 3. Key Features & Comprehensive Functional Breakdown

### 📚 3.1. Structured Learning Library (Books, Chapters & Topics)
- **Hierarchical Knowledge Organization**: Content is organized logically into **Books** (e.g., Obstetrics, Gynecology, Reproductive Endocrinology), **Chapters**, and rich **Topics**.
- **Interactive Topic Reader**: Supports dynamic HTML formatting, high-resolution medical diagrams, and complex classification tables (e.g., PALM-COEIN for abnormal uterine bleeding).
- **Completion & Revision Toggles**: Medical trainees can mark topics as **"Completed"** or tap to **"Mark for Revision"**, keeping their progress tab and review schedule synchronized.
- **Content Attribution**: Transparency for medical accuracy, displaying authors, clinical guidelines source, reference links, and last updated timestamps.
- **Content Error Reporting**: Built-in "Report an Error" mechanism allowing users to submit typos or factual corrections directly to content admins.

### 🧪 3.2. Clinical Practice & MCQ Quiz Engine
- **Multiple Quiz Modes**:
  - **Topic-Specific Practice**: Test knowledge immediately after reading a topic.
  - **Mixed Practice**: Comprehensive quizzes pulling questions across multiple chapters.
  - **Wrong-Only Revision**: Re-evaluate previously missed questions to reinforce mastery.
- **Full Quiz Player Suite**:
  - Timed quiz option with visual amber/red warning banners and haptic feedback at 60s and 30s.
  - **Question Navigation Drawer**: Jump to any question instantly with color-coded status badges (Green = Answered, Gray = Unanswered, Cyan = Current).
  - **Submit Confirmation Modal**: Summarizes answered vs unanswered questions to prevent accidental submission.
  - **Instant Explanations**: Post-quiz analysis provides step-by-step clinical explanations for every option.

### 🔄 3.3. Spaced Repetition System (SM-2 Algorithm)
- **SuperMemo-2 Integration**: Automatically schedules revision intervals based on user accuracy and perceived difficulty.
- **Spaced Review Screen**: Dedicated tab showing due reviews for the day, keeping retention rates at peak performance for long-term memory.
- **Automated Memory Guard**: Prevents burnout by spacing out review loads intelligently.

### ⚡ 3.4. Offline-First Architecture (Offline Sync Engine)
- **Zero-Block Navigation**: Users are **never blocked** by an offline screen. The entire navigation tree remains accessible offline using cached data.
- **TanStack Query Caching**: Automatic persistence of user progress, bookmarks, recent activity, and topic contents via `@react-native-async-storage/async-storage`.
- **Offline Mutation Queue**: Actions performed offline (such as bookmarking topics or completing modules) are queued with last-write-wins deduplication and automatically background-synced upon reconnecting.
- **Animated Offline Banner**: Slim amber banner notifying the user that they are viewing cached data without interrupting study flow.

### 💳 3.5. Manual Payment-Proof Subscription Engine
- **Flexible Subscription Packages**: Monthly, Quarterly, and Annual tiers defined dynamically by admins.
- **Local Payment Support**: Supports direct bank transfers and local mobile wallets (EasyPaisa, JazzCash, etc.).
- **In-App Payment Proof Upload**:
  1. User selects plan and views admin payment instructions.
  2. User transfers funds and uploads screenshot/receipt directly inside the app (`PaymentProofUploadScreen`).
  3. Real-time status tracking via `PendingApprovalScreen`.
- **Admin Verification Dashboard**: Admins inspect payment proof images and approve/reject subscriptions with single-click email notifications.

### ⚙️ 3.6. Security, Haptics & Sound System
- **Hardened Security**:
  - In-app **6-digit OTP password reset** and email verification.
  - **OTP Rate Lockout**: 5 failed attempts within 15 minutes triggers a strict 429 lockout.
  - Password strength enforcement (minimum 8 characters, uppercase, lowercase, numbers) with bcrypt cost factor 12.
- **Tactile & Sound Feedback**:
  - Global `FeedbackProvider` with haptic feedback and customized audio cues for taps, success, and error states.
  - Settings toggles allow users to independently mute sounds or disable haptics app-wide.

---

## 4. Admin Portal & Editorial Ecosystem

The Maternal Mind web admin dashboard (`/admin`) equips medical directors and system administrators with complete control:

1. **Content Management System (CMS)**: Create, edit, publish, and delete Books, Chapters, Topics, and MCQs.
2. **Manual Payment Management**: Review pending uploaded payment receipts, verify transactions, and grant active subscription access.
3. **Content Error Verification**: Review user-submitted content reports (typos, guideline updates) and update text live.
4. **User & Access Management**: View student accounts, change roles (admin/user), monitor subscription statuses, and inspect user engagement analytics.
5. **Announcements Engine**: Broadcast platform updates, exam countdowns, or promo banners directly to the mobile home screen.

---

## 5. Summary of User & Clinical Benefits

```
┌───────────────────────────────────────────────────────────────────────────┐
│                           BENEFITS HIGHLIGHT                              │
├─────────────────────────────────────┬─────────────────────────────────────┤
│ FOR POST-GRADUATE TRAINEES          │ FOR INSTITUTIONS & EDITORS          │
├─────────────────────────────────────┼─────────────────────────────────────┤
│ 🎯 Targeted Exam Preparation        │ ⚡ Rapid Content Publishing         │
│    Built around FCPS & MRCOG        │    Instant live updates to app      │
│    syllabi and clinical guidelines. │    without app store re-submits.    │
│                                     │                                     │
│ 📱 Hospital-Ready Offline Access    │ 🛡️ Strict Enterprise Security       │
│    Study during long hospital shifts│    RBAC permissions, audit logs,    │
│    without depending on Wi-Fi.      │    and encrypted user credentials.  │
│                                     │                                     │
│ 🧠 High-Retention Revision          │ 💰 Streamlined Payment Verification │
│    SM-2 Spaced Repetition ensures   │    Seamless local wallet payment    │
│    zero forgetting curve.           │    proof processing.                │
└─────────────────────────────────────┴─────────────────────────────────────┘
```

---

## 6. Project Roadmap & Future Vision

- **Urdu & Regional Localization (Q3)**: Multi-language interface option for localized medical education.
- **Sentry Crash Analytics (Q4)**: Enterprise crash reporting and continuous performance monitoring.
- **Mock Exam Simulation Center**: Full-length 3-hour exam simulation mode mimicking official FCPS/MRCOG exam center environments.
