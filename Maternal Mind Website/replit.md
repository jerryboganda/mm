# Maternal Mind - Marketing Website

## Overview

Maternal Mind is a premium marketing website for an OB-GYN medical education platform targeting postgraduate doctors preparing for MRCOG (Parts 1-3), FCPS, and other OB-GYN training pathways. The website serves as a conversion-optimized landing experience that communicates trust, clinical seriousness, and premium quality. It drives users to download the app, join a waitlist, request institutional access, or sign in.

The site is a full-stack TypeScript application with a React frontend and Express backend. It follows a "medical-tech luxury" design system featuring dark glassmorphism with neon cyan glow accents.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework**: React 18 with TypeScript, built using Vite
- **Routing**: Wouter (lightweight client-side router) — not React Router
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with a custom dark glassmorphism design system
- **UI Components**: shadcn/ui (new-york style) with Radix UI primitives, customized to match the dark theme
- **Animations**: Framer Motion for scroll reveals, transitions, and interactive elements
- **SEO**: react-helmet-async for per-page meta tags
- **Font**: Inter (Google Fonts) for body text, JetBrains Mono for monospace elements
- **Icons**: Lucide React and react-icons

**Design System**: The entire UI follows a strict "Secure Precision" brand concept:
- Primary neon cyan: `#11a4d4` with glow effects
- Background void dark: `#101d22`, surface dark: `#152228`
- Glass cards with `bg-white/5`, `border-white/10`, `backdrop-blur`
- Custom CSS classes: `.glass`, `.neon-border`, `.neon-glow`, `.neon-text-glow`, `.bg-void`
- Never use bright colors or chaotic motion — maintain calm/clinical tone

**Path Aliases**:
- `@/*` → `./client/src/*`
- `@shared/*` → `./shared/*`
- `@assets` → `./attached_assets/`

**Pages**: Home, Features, How It Works, Pricing, Institutions, About, Support, Legal (Terms/Privacy/Disclaimer), Resources (with dynamic slugs for MRCOG Part 1/2/3, FCPS, MCQs), Media Kit, 404

### Backend Architecture

- **Framework**: Express 5 on Node.js with TypeScript (runs via tsx in dev, esbuild bundle in production)
- **API Pattern**: RESTful JSON endpoints under `/api/` prefix
- **Endpoints**:
  - `POST /api/waitlist` — email waitlist signup
  - `POST /api/contact` — contact form submission
  - `POST /api/institutional-request` — institutional access request form
- **Validation**: Zod schemas (generated via drizzle-zod from the DB schema), with `zod-validation-error` for readable error messages
- **Storage**: Currently uses in-memory storage (`MemStorage` class) implementing an `IStorage` interface. This is designed to be swapped to a database-backed implementation.
- **Dev Server**: Vite middleware is used in development for HMR; in production, the built static files are served from `dist/public`

### Data Storage

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` — shared between frontend and backend
- **Tables**:
  - `users` — id (UUID), username (unique), password
  - `waitlist_entries` — id (UUID), email, created_at
  - `contact_messages` — id (UUID), name, email, subject, message, created_at
  - `institutional_requests` — id (UUID), name, institution, role, email, cohort_size, message, created_at
- **Migrations**: Drizzle Kit with `drizzle-kit push` command, output to `./migrations/`
- **Database URL**: Requires `DATABASE_URL` environment variable (PostgreSQL connection string)
- **Current State**: The storage layer uses in-memory Maps (MemStorage). The Drizzle schema is defined but a DatabaseStorage implementation connecting to PostgreSQL should be created when the database is provisioned.

### Build System

- **Dev**: `tsx server/index.ts` with Vite dev middleware for HMR
- **Build**: Custom `script/build.ts` that runs Vite build for the client and esbuild for the server, outputting to `dist/`
- **Production**: `node dist/index.cjs`
- **Schema Push**: `drizzle-kit push` for database schema management

### Key Architectural Decisions

1. **Shared Schema**: The database schema in `shared/schema.ts` is shared between client and server, enabling type-safe API contracts and validation reuse via Zod schemas derived from Drizzle table definitions.

2. **Storage Interface Pattern**: The `IStorage` interface in `server/storage.ts` abstracts data access. Currently implemented with in-memory maps (`MemStorage`), it's designed to be replaced with a PostgreSQL-backed implementation using Drizzle ORM without changing route handlers.

3. **SPA with Server-Side Routing Fallback**: The client is a single-page app. In production, all non-API routes fall through to `index.html`. In development, Vite handles this with its middleware.

4. **Component Architecture**: Custom glass-morphism components (`GlassCard`, `NeonButton`, `GhostButton`, `BackgroundOrbs`, `ScrollReveal`, `SectionLabel`) in `glass-components.tsx` wrap the design system, sitting alongside standard shadcn/ui components.

## External Dependencies

- **Database**: PostgreSQL (required, connection via `DATABASE_URL` environment variable)
- **Fonts**: Google Fonts (Inter, JetBrains Mono) — loaded via CDN in `index.html`
- **Replit Plugins**: `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner` (dev only)
- **No external APIs or auth services are currently integrated** — the app is a marketing/landing site with form submissions stored locally
- **Session Store**: `connect-pg-simple` is listed as a dependency (for future session management with PostgreSQL) but not currently wired up