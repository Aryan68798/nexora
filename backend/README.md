# Nexora Backend

Nexora is a modern property, space booking, and field service management API.

The backend is built with **Node.js** using modern **JavaScript (ES Modules)**, **Express 4.x**, **Prisma 7**, and **Supabase (PostgreSQL & Auth & Storage)**.

---

## 1. Tech Stack & Architecture

- **Runtime**: Node.js (v18+) with `"type": "module"` (pure ES modules, no TypeScript).
- **Web Framework**: Express 4.x with `asyncHandler` wrapper on all asynchronous route handlers.
- **ORM / Database**: Prisma 7 with PostgreSQL (Supabase).
- **Authentication**: Supabase Auth (Bearer JWT validation with local profile mapping and caching).
- **Validation**: Zod with strict schema validation (`.strict()`) on all request bodies.
- **Testing**: Vitest + Supertest for unit and integration testing.
- **Linting**: ESLint 9 (flat config, standard recommended rules).

---

## 2. Environment Setup

Create a `.env` file in `backend/` following `.env.example`:

```env
PORT=4000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres
SUPABASE_URL=https://[PROJECT-ID].supabase.co
SUPABASE_ANON_KEY=[ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]

PLATFORM_FEE_PERCENT=10
TAX_PERCENT=18
MIN_BOOKING_LEAD_MINUTES=30
FREE_CANCELLATION_HOURS=24
MAX_BOOKING_DAYS=30
```

---

## 3. Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with file watch mode (`node --watch src/server.js`) |
| `npm start` | Start production server (`node src/server.js`) |
| `npm test` | Run Vitest test suite (`vitest run`) |
| `npm run test:watch` | Run Vitest in interactive watch mode (`vitest`) |
| `npm run lint` | Run ESLint check (`eslint .`) |
| `npm run lint:fix` | Run ESLint with auto-fix (`eslint . --fix`) |
| `npm run user:set-role -- <email> <ROLE>` | Update user role (`CUSTOMER`, `OWNER`, `PROVIDER`, `ADMIN`) |
| `npm run admin:promote -- <email>` | Promote a user to `ADMIN` |
| `npm run seed:demo -- <owner-email>` | Seed demo properties, spaces, and media |
| `npm run storage:check` | Verify required Supabase storage buckets exist |
| `npm run smoke:auth` | Run authentication smoke test suite |
| `npm run smoke:catalog` | Run properties, spaces, and catalog smoke tests |
| `npm run smoke:bookings` | Run end-to-end booking, payment, and review smoke tests |

---

## 4. Key Rules & Conventions

- **Money & Pricing**: Handled strictly using `Prisma.Decimal` and `ROUND_HALF_UP` to 2 decimal places. Floating-point arithmetic on currency is strictly forbidden. Monetary amounts are returned as `"X.XX"` strings via `serialize.js`.
- **Database & Schema**: Schema and migrations are strictly managed; no `migrate dev`, `db push`, or `db pull`.
- **Response Format**: Standard JSON envelope:
  - Success: `{ "success": true, "data": ..., "meta"?: { ... } }`
  - Error: `{ "success": false, "error": { "code": string, "message": string, "details"?: any } }`
- **Security**: Never log authorization tokens, request headers, or secrets. Role authorization is strictly derived from the `profiles` table.
