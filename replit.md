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

### January 28, 2026 (Latest)
- Complete Legal & Safety Screens:
  - TermsPrivacyScreen: Tabbed interface for Terms of Use and Privacy Policy content
  - DisclaimerScreen: Medical disclaimer emphasizing educational purpose, not medical advice
  - AboutScreen now links to legal screens via in-app navigation (chevron icons) and external links
- Edge State & Error Handling Screens:
  - OfflineScreen: Network troubleshooting tips with retry functionality
  - ErrorScreen: Generic server error display with retry and contact support options
  - MaintenanceScreen: Backend maintenance mode information screen
  - SessionExpiredModal: Re-login prompt modal for expired JWT sessions
- Network Status Integration:
  - NetworkProvider context for app-wide offline detection using @react-native-community/netinfo
  - AppNetworkWrapper displays OfflineScreen when offline, SessionExpiredModal when session expires
  - useNetworkStatus hook for component-level network status access
- Auth Context Enhancements:
  - Added isSessionExpired state and setSessionExpired/dismissSessionExpired methods
  - Session expiration integrates with AppNetworkWrapper for automatic modal display

### January 27, 2026
- Complete Subscription & Paywall System with 5 dedicated screens:
  - PaywallScreen: Premium benefits explanation with crown gradient header and 6 feature cards
  - PurchaseSuccessScreen: Animated confirmation with gradient check icon and unlocked features list
  - PurchaseFailedScreen: Error handling with troubleshooting tips, retry, and contact support options
  - RestorePurchasesScreen: Multi-state flow (idle/restoring/success/not_found/error) with animations
  - CheckoutProcessingScreen: Loading state during purchase with step indicators
  - SubscriptionScreen updated to navigate to success/failed screens after purchase
  - Navigation updated with modal/fullScreenModal presentation modes for paywall screens
  - RevenueCat integration handles both real packages and fallback plans on web

### January 27, 2026 (Earlier)
- Progress & Analytics screens with detailed quiz history tracking:
  - AttemptHistoryScreen: View all quiz attempts with mode filters (All/Topic/Mixed/Wrong)
  - AttemptDetailScreen: Question-by-question breakdown with correct/wrong indicators and explanations
  - TopicProgressDetailScreen: Topic-specific analytics with accuracy trend chart and recent attempts
  - Backend API routes: GET /api/attempts (with mode filter), GET /api/attempts/:attemptId, GET /api/progress/topic/:topicId
  - ProgressScreen now links to AttemptHistory ("View All") and TopicProgressDetail (clickable topic rows)
- Enhanced QuizPlayerScreen with navigation drawer and submit confirmation:
  - Question navigation drawer: Tap question counter to open drawer with all questions as numbered buttons
  - Color-coded question status: Green (answered), Gray (unanswered), Cyan (current)
  - Submit confirmation modal: Shows answered/unanswered count before final submission

### January 27, 2026 (Earlier)
- Enhanced Content Library with new features:
  - Premium/Free badges on books list with star/unlock icons
  - Locked/Premium markers on topics with lock icons and reduced opacity
  - Full-screen Image Viewer with pinch-to-zoom, pan gestures, and double-tap zoom
  - TopicReader images are now tappable to open in full-screen viewer
  - Search Screen with debounced input and filter chips (All/Books/Chapters/Topics)
  - Search button in Library header for quick access
  - Backend search API at `/api/search` for content search across books, chapters, and topics
  - LearnStackNavigator now includes TopicReader and Search screens

### January 27, 2026 (Earlier)
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