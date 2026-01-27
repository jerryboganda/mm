# Maternal Mind

## Overview

Maternal Mind is an OB-GYN educational learning platform designed for medical students. It provides a mobile-first experience for studying obstetrics and gynecology content through a structured book/chapter/topic hierarchy and MCQ-based practice quizzes. The app features a premium dark-themed glassmorphism design with neon cyan accents, targeting a calm and professional atmosphere suitable for medical education.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework**: React Native with Expo SDK 54, using the new architecture
- **Navigation**: React Navigation v7 with bottom tabs and native stacks
  - Root stack navigator for authentication, onboarding, and modal screens
  - Bottom tab navigator with 5 main tabs: Home, Library, Quiz, Progress, Profile
  - HomeStackNavigator: Dashboard, Notifications, TopicReader
  - LearnStackNavigator: Library browsing (books → chapters → topics)
  - PracticeStackNavigator: Quiz modes and quiz player
  - ProgressStackNavigator: Analytics and progress tracking
  - ProfileStackNavigator: User profile and settings
- **State Management**: TanStack React Query for server state, React Context for auth state
- **Styling**: Custom design system with dark glassmorphism theme, using Expo Linear Gradient and Blur effects
- **Animation**: React Native Reanimated for smooth micro-interactions
- **Font**: Inter font family (Google Fonts) with multiple weights

### Backend Architecture

- **Framework**: Express.js (v5) with TypeScript
- **API Pattern**: RESTful JSON API under `/api` prefix
- **Authentication**: JWT-based with access tokens stored in Expo SecureStore (mobile) or localStorage (web)
- **Database ORM**: Drizzle ORM with PostgreSQL dialect

### Data Storage

- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` - shared between client and server
- **Key Tables**: users, books, chapters, topics, contentBlocks, mcqs, userProgress, bookmarks, quizAttempts
- **Token Storage**: Expo SecureStore for native platforms, localStorage for web

### Authentication Flow

- JWT-based authentication with Bearer token pattern
- Tokens stored securely per platform (SecureStore/localStorage)
- Auth context provider wraps the app and manages user state
- Protected routes redirect unauthenticated users to login

### Project Structure

```
client/           # React Native/Expo frontend
  components/     # Reusable UI components (Glass-themed)
  screens/        # Screen components
  navigation/     # Navigation configuration
  hooks/          # Custom hooks
  lib/            # Auth context and API client
  constants/      # Theme and design tokens

server/           # Express backend
  routes.ts       # API route definitions
  storage.ts      # Database access layer
  db.ts           # Drizzle/PostgreSQL connection

shared/           # Shared code between client/server
  schema.ts       # Drizzle database schema and Zod validators
```

### Build and Development

- **Dev Commands**: `npm run expo:dev` for mobile, `npm run server:dev` for backend
- **Production Build**: Uses custom build script for Expo static output
- **Path Aliases**: `@/` maps to client, `@shared/` maps to shared

## External Dependencies

### Database
- PostgreSQL via `DATABASE_URL` environment variable
- Drizzle ORM for type-safe database access

### Authentication
- bcryptjs for password hashing
- jsonwebtoken for JWT generation and verification
- `SESSION_SECRET` environment variable for JWT signing

### Key Frontend Libraries
- Expo SDK ecosystem (blur, haptics, linear-gradient, secure-store)
- React Navigation for routing
- TanStack React Query for data fetching
- React Native Reanimated for animations

### Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - JWT signing secret
- `EXPO_PUBLIC_DOMAIN` - API domain for client requests (includes :5000 port for Replit routing)

## Recent Changes

### January 27, 2026 (Latest)
- Implemented Main App Shell / Navigation with 5 tabs
  - Updated MainTabNavigator to 5 tabs: Home, Library, Quiz, Progress, Profile
  - Created HomeStackNavigator with Dashboard, Notifications, and TopicReader screens
  - Home Dashboard: Personalized greeting, notification bell, stat cards (Topics Read, Quizzes Done, Avg. Score, Study Streak), Continue Learning card, Recommended Topics section
  - NotificationsScreen: Professor announcements with type icons, read/unread status, pull-to-refresh
- Added EmailVerificationScreen with resend functionality
  - Backend route `/api/auth/resend-verification` for re-sending verification emails
  - 60-second cooldown between resend attempts
- Added complete Onboarding & Entry flow
  - Splash Screen: Uses expo-splash-screen with app logo during initialization
  - Welcome Screen: Entry point with "Get Started" and "I already have an account" buttons
  - Onboarding Carousel: 4-slide carousel explaining Learn, Practice, Track Progress, and Bookmark features
  - Permissions Prompt Screen: Requests notification permissions with rationale and benefits
  - Onboarding state persisted in AsyncStorage to only show once per device
- Implemented Forgot Password feature with email-based reset flow using Resend
  - Added ForgotPasswordScreen and ResetPasswordScreen
  - Backend API routes for password reset token generation and validation
  - Database table: password_reset_tokens for secure token storage
  - In dev mode, reset links are logged to console when RESEND_API_KEY not set
- Added RevenueCat subscription integration for in-app purchases
  - PurchasesProvider context wraps app for subscription state management
  - SubscriptionScreen handles real RevenueCat packages or fallback plans
  - Supports restore purchases functionality
  - Environment variables: EXPO_PUBLIC_REVENUECAT_API_KEY_IOS, EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID, EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID
- Fixed Wrong Questions quiz mode to properly track answers chronologically
  - Questions now tracked by latest answer - correctly answered questions removed from wrong pool
  - Quiz submission now passes mode and topicId for accurate attempt logging
  - Query invalidation when wrong questions are corrected
- Fixed Colors import issues across auth screens for consistent theming

### January 27, 2026 (Earlier)
- Fixed API communication between Expo web app (port 8081) and Express backend (port 5000)
- CORS configuration now allows Authorization header for authenticated API requests
- API URL construction preserves :5000 port suffix for proper Replit dev domain routing
- E2E tested: registration, login, content browsing (books/chapters/topics), practice tab, profile tab