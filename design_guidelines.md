# Maternal Mind - OB-GYN Learning Platform Design Guidelines

## Brand Identity

**Core Concept**: "Secure Precision" - combining the cleanliness of medical software with the engagement of modern consumer apps.

**Visual Style**: Dark-themed Glassmorphism with heavy use of semi-transparent layers, background blurs, and glowing accents to establish depth and hierarchy.

**Atmosphere**: Calm, focused, and professional. The app should feel like a premium educational tool designed for medical professionals.

**Memorable Element**: Neon cyan glow effects (#11a4d4) on interactive elements against deep teal backgrounds create an unforgettable medical-tech aesthetic.

---

## Navigation Architecture

### Root Navigation: Tab Navigation (4 tabs)
- **Learn** - Browse content library (books → chapters → topics)
- **Practice** - MCQ quiz modes and practice sessions
- **Progress** - Dashboard with analytics and attempt history
- **Profile** - User settings, subscription status, bookmarks

**Floating Action Button**: Primary action button for "Start Quiz" or "Continue Learning" positioned above the tab bar, centered.

### Authentication Flow (Stack-Only)
- Welcome/Onboarding (3 screens with glassmorphic cards)
- Login (email/password + Apple Sign-In + Google Sign-In)
- Sign Up (name, email, password with floating labels)
- OTP Verification (if email verification enabled)

---

## Screen-by-Screen Specifications

### 1. Login Screen
**Purpose**: Authenticate students into the app
**Layout**:
- Header: None (full-screen auth experience)
- Content: Scrollable form with ambient background orbs (blur-[120px])
- Safe Area: top: insets.top + 48px, bottom: insets.bottom + 24px

**Components**:
- Logo mark (centered at top)
- Glass input fields (email, password) with floating labels
- Primary cyan button "Sign In" with neon glow shadow
- Ghost buttons for "Forgot Password" and "Don't have an account?"
- SSO buttons (Apple, Google) with glass card styling
- Mesh gradient overlay for depth

### 2. Learn Tab (Content Library)
**Purpose**: Browse educational content hierarchy
**Layout**:
- Header: Custom transparent with search icon (right) and profile avatar (left)
- Content: ScrollView with glass cards for each book
- Safe Area: top: headerHeight + 24px, bottom: tabBarHeight + 24px

**Components**:
- Glass cards for books (bg-white/5, border-white/10, backdrop-blur-sm)
- Each card shows: book title, chapter count, progress bar (cyan)
- Hover effect: bg-white/10 with cyan border glow
- Section headers: uppercase with tracking-widest

### 3. Topic Content Reader
**Purpose**: View structured learning content
**Layout**:
- Header: Transparent with back button (left), bookmark icon (right)
- Content: Scrollable content blocks
- Safe Area: top: headerHeight + 16px, bottom: insets.bottom + 80px
- Floating: "Next Topic" button at bottom with drop shadow

**Components**:
- Content blocks: text (Inter Regular 16px), images, note cards (bg-purple-500/10)
- Headings: Inter Bold with tracking-tight
- Images: rounded-xl with subtle border
- Navigation: Previous/Next topic buttons (glass style)

### 4. Practice Tab (MCQ Hub)
**Purpose**: Access quiz modes
**Layout**:
- Header: Default navigation header with "Practice" title
- Content: Grid of glass cards for quiz modes
- Safe Area: top: 24px, bottom: tabBarHeight + 24px

**Components**:
- Mode cards: "Topic Quiz", "Mixed Quiz", "Wrong Questions Only"
- Each card: icon (Material Symbols), title, description, glow on active
- Difficulty filter chips (Easy/Medium/Hard) with cyan active state

### 5. Quiz Player
**Purpose**: Take MCQ assessment
**Layout**:
- Header: Custom header with progress bar, timer (if timed mode), exit button
- Content: Non-scrollable question view
- Safe Area: top: headerHeight + 16px, bottom: insets.bottom + 24px
- Floating: "Submit" or "Next" button at bottom

**Components**:
- Question number indicator (e.g., "5 / 20") with progress dots
- Question text card (glass background, large text)
- Option buttons (A, B, C, D) as glass cards with radio button indicators
- Selected state: cyan border with animate-pulse
- Timer display: monospace font with warning color when < 10 seconds

### 6. Quiz Results
**Purpose**: Review performance
**Layout**:
- Header: None (full-screen results)
- Content: Scrollable with score hero section at top
- Safe Area: top: insets.top + 48px, bottom: insets.bottom + 24px

**Components**:
- Circular score indicator (large, centered) with radial gradient glow
- Stats cards: Correct (green-500), Wrong (red-500), Accuracy (cyan)
- Answer review list: expandable glass cards showing question, selected answer, correct answer, explanation
- CTA buttons: "Review Wrong", "Retry Quiz", "Back to Practice"

### 7. Progress Dashboard
**Purpose**: Track learning metrics
**Layout**:
- Header: Default with "Your Progress" title
- Content: Scrollable dashboard sections
- Safe Area: top: 24px, bottom: tabBarHeight + 24px

**Components**:
- Hero stat cards (Total Attempts, Avg Accuracy, Topics Completed)
- Topic accuracy chart (horizontal bar chart with cyan fills)
- Recent attempts timeline (glass cards with date, score, mode)
- Empty state: Illustration with "No attempts yet. Start practicing!"

### 8. Profile Tab
**Purpose**: Manage account and settings
**Layout**:
- Header: Transparent
- Content: Scrollable settings sections
- Safe Area: top: headerHeight + 24px, bottom: tabBarHeight + 24px

**Components**:
- User avatar (circular, generated) with name and email
- Subscription status card (prominent glass card with plan name, renewal date)
- Settings sections: Account, Notifications, Appearance (theme toggle), About
- Logout button (ghost style) at bottom

### 9. Subscription Paywall (Modal)
**Purpose**: Display plans and initiate purchase
**Layout**:
- Presented as native modal (slides up from bottom)
- Content: Scrollable plan cards
- Safe Area: top: 24px, bottom: insets.bottom + 24px

**Components**:
- Plan comparison cards (Monthly, Quarterly, Yearly) with "Best Value" badge
- Each plan shows: price, billing cycle, features list (checkmarks)
- Primary button "Subscribe" with neon glow
- "Restore Purchases" link at bottom
- Privacy policy and terms links (small, muted text)

---

## Color Palette

**Primary**:
- Neon Cyan: #11a4d4 (buttons, active states, glows)
- Deep Teal: #0c7fa6 (hover states, borders)

**Backgrounds**:
- Void Dark: #101d22 (main background)
- Surface Dark: #152228 (input fields, lower surfaces)
- Glass White: rgba(255,255,255,0.05) to 0.1 (card backgrounds)

**Semantic**:
- Success: #22c55e (Tailwind green-500)
- Warning: #eab308 (Tailwind yellow-500)
- Error: #ef4444 (Tailwind red-500)
- Info: #3b82f6 (Tailwind blue-500)
- Purple: #a855f7 (Tailwind purple-500, for science/research accents)

**Text**:
- Primary: rgba(255,255,255,0.95)
- Secondary: rgba(255,255,255,0.7)
- Muted: rgba(255,255,255,0.4)

---

## Typography

**Typeface**: Inter (Google Fonts)

**Type Scale**:
- Heading 1: 32px, Light (300), tracking-tight
- Heading 2: 24px, SemiBold (600), tracking-tight
- Heading 3: 20px, Medium (500)
- Body: 16px, Regular (400), line-height 24px
- Caption: 14px, Regular (400)
- Label: 12px, Medium (500), uppercase, tracking-widest
- Code/Monospace: 16px, font-mono (for OTP, timer)

---

## Assets to Generate

1. **app-icon.png** - App icon for device home screen. Medical cross symbol with cyan glow on deep teal background.

2. **splash-icon.png** - Launch screen logo. "Maternal Mind" wordmark with subtle glow effect.

3. **empty-content.png** - Empty state for content library when no books available. Illustration of open textbook with cyan accent lines. **WHERE USED**: Learn tab initial state.

4. **empty-attempts.png** - Empty state for progress dashboard. Illustration of rising graph bars with neon glow. **WHERE USED**: Progress tab when no quiz attempts yet.

5. **empty-bookmarks.png** - Empty state for bookmarks. Illustration of bookmark icon with subtle sparkle. **WHERE USED**: Profile > Bookmarks section.

6. **quiz-success.png** - Celebration illustration for high scores (>80%). Abstract medical symbols with cyan burst effect. **WHERE USED**: Quiz results screen.

7. **onboarding-1.png** - Onboarding illustration showing content browsing. **WHERE USED**: Welcome screen 1.

8. **onboarding-2.png** - Onboarding illustration showing MCQ practice. **WHERE USED**: Welcome screen 2.

9. **onboarding-3.png** - Onboarding illustration showing progress tracking. **WHERE USED**: Welcome screen 3.

10. **default-avatar.png** - Default user avatar with medical theme. **WHERE USED**: Profile tab, header avatar.

All illustrations should use the Maternal Mind color palette (deep teal, neon cyan, purple accents) and maintain a minimal, modern medical aesthetic with subtle glow effects.