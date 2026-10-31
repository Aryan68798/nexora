# Nexora — Project Rules

## Product Overview
Nexora is a property management and space-booking web app. It is an assignment/demo project and must be complete, polished, and demo-ready.

### Four User Roles
- **OWNER**: Lists properties/spaces, manages inspections, maintenance, expenses, and income.
- **CUSTOMER**: Searches, books, pays, favorites, and reviews.
- **PROVIDER**: Receives maintenance jobs, posts updates, and completes work.
- **ADMIN**: Oversees platform operations and integrity.

### Special Feature: AI Harness
- Secure chat assistant using whitelisted scoped tools only.
- No direct database access.
- Write actions require explicit user confirmation.
- Every action is strictly logged.

---

## Technical Stack
- **Backend**: Node.js + Express (JavaScript, ES modules)
- **ORM**: Prisma
- **Database**: PostgreSQL on Supabase
- **Authentication**: Supabase Auth (passwords are never stored)
- **Storage**: Supabase Storage
- **Frontend**: React (.jsx) + Vite + Tailwind CSS, Framer Motion for animation (responsive and mobile-first)
- **Deployment**:
  - Frontend: Vercel
  - Backend: Render / Railway

Backend and frontend are written in JavaScript (ES modules, no TypeScript). The frontend uses React .jsx files.

---

## Working Rules

### 1. Inspect First
- Before changing anything, look at existing folders, `package.json` files, `.env.example`, `prisma` folder, and existing code.
- Reuse what exists. Do not rebuild or overwrite working code.

### 2. Secrets Management
- Never print, log, hardcode, or commit secrets (database password, service_role key, JWT secret, API keys, full connection strings).
- Only read secrets from environment variables.
- Confirm `.env` and `.env.*` (except `.env.example`) are in `.gitignore`.
- Keep `.env.example` updated with placeholder values only.

### 3. No Destructive Commands
- Never run:
  - `prisma migrate reset`
  - `prisma db push --force-reset`
  - `DROP` / `TRUNCATE` on existing data
  - Anything that deletes data
- Never modify Supabase's managed `auth` or `storage` schemas.
- If something destructive seems needed, STOP and ask the user.

### 4. Prisma Versioning
- Run `npx prisma -v` first.
  - **Prisma 7**: Connection settings live in `prisma.config.ts` (using `dotenv`); `directUrl` is NOT allowed in `schema.prisma`.
  - **Prisma 6 or earlier**: Use `url = env("DATABASE_URL")` and `directUrl = env("DIRECT_URL")` in `schema.prisma`.
- Do not upgrade or downgrade Prisma unless it is truly required, and inform the user first.

### 5. Database Migrations & Connections
- Migrations MUST use the DIRECT/session URL (port 5432), never the pooled 6543 URL.
- The app at runtime uses the pooled `DATABASE_URL`.

### 6. Authentication Model
- Supabase Auth + a `profiles` table where `profiles.id = auth.users.id`.
- No custom users, passwords, sessions, or login tables. Ever.

### 7. Code Quality & Standards
- Modern JavaScript (ES modules) with strict runtime validation.
- Clear folder structure (`routes`, `controllers`, `services`, `middleware`, `validators`, `utils`).
- Validate every request body with Zod.
- Consistent JSON API formats:
  - **Error format**: `{ "success": false, "error": { "code": string, "message": string, "details"?: any } }`
  - **Success format**: `{ "success": true, "data": ... }`
- Use proper HTTP status codes.
- Never leak stack traces to clients.

### 8. Financial Precision
- Money uses Prisma `Decimal`, never `Float`.
- All prices and totals are calculated on the server only.

### 9. Security
- Helmet enabled.
- CORS strictly limited to the frontend origin.
- Rate limiting implemented.
- Role-based authorization middleware.
- Ownership checks on every resource (e.g. an owner can only touch their own properties).

### 10. Frontend Design & UX
- Warm, premium, mobile-first design.
- **Colors**:
  - Background: `#FFF8F0`
  - Sections: `#FBEFE0`
  - Cards: `#FFFFFF` with soft warm shadows
  - Borders: `#F0DFCB`
  - Primary: `#C2571A` (hover `#A94814`)
  - Accent: `#E9A23B`
  - Success: `#4C8C5A`
  - Warning: `#D98E04`
  - Danger: `#B3362B`
  - Heading text: `#2B1D14`
  - Body text: `#6B5646`
- **Font**: Inter or Poppins.
- **Rounded corners**: 12–16px.
- **Touch targets**: Minimum 44px.
- **Breakpoints**: 360+, 768+, 1280+.
- **Accessibility**: WCAG AA contrast, visible focus rings, keyboard navigation.
- **States**: Every screen needs loading, empty, and error states.
- **Animations**: Smooth Framer Motion animations (page transitions, staggered lists, hover/press effects, skeleton loaders); respect `prefers-reduced-motion`.

### 11. Testing & Verification
- After each task, run the type check, build, and any tests.
- Fix what fails before reporting.

---

## Mandatory End-of-Task Report
Every task MUST end with a report containing:
- Files created/changed
- Commands run
- Pass/Fail for each step
- Any errors (with passwords/keys replaced by `***`)
- The exact next step the user should take
