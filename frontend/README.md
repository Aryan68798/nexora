# Nexora Frontend (Phase F1)

Handcrafted, premium React frontend for the Nexora hospitality and stewardship platform. Built with modern JavaScript (ES modules, React `.jsx`, strictly zero TypeScript), rich micro-interactions, responsive ergonomics, and Supabase authentication.

---

## Architecture & Technology Stack

- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS with custom editorial design tokens
- **Typography**: `@fontsource-variable/fraunces` (Editorial Display & Serif) and `@fontsource-variable/inter` (UI & Body Sans)
- **Animation**: `framer-motion` with `prefers-reduced-motion` fallbacks
- **State & Data Fetching**: `@tanstack/react-query`
- **Routing**: `react-router-dom` v7 with role-based route guards
- **Authentication**: `@supabase/supabase-js` (using publishable anon key only)
- **Validation**: `react-hook-form` + `zod`
- **Icons**: `lucide-react` (Strict zero emoji policy across the platform)
- **Testing**: `vitest` + `@testing-library/react` + `@testing-library/jest-dom`

---

## Design System Tokens

The Nexora visual identity is rooted in an earthy, warm architectural palette inspired by Indian stone masonry, sun-baked clay, and heritage retreats:

| Token | Hex / Value | Purpose |
|---|---|---|
| **Cream** | `#FAF7F2` | Primary canvas background |
| **Sand** | `#E8E0D5` | Card borders, subtle divider lines, soft fills |
| **Terracotta** | `#C85A32` | Primary brand accent, active states, key CTAs |
| **Terracotta Dark** | `#A84420` | Hover states, active pressed states |
| **Amber** | `#E8963E` | Warm gold highlights, attention badges |
| **Warm Ink** | `#2C221E` | High-contrast readable typography |
| **Breakpoints** | `360px`, `768px`, `1280px` | Mobile (compact), Tablet, Desktop |
| **Touch Targets** | `min-h-[44px]`, `min-w-[44px]` | Touch ergonomics on all mobile interactives |

---

## Security & Auth Model

1. **Zero Client Secret Keys**: The frontend utilizes *only* `VITE_SUPABASE_PUBLISHABLE_KEY`. The `service_role` secret key never appears in client code, environment files, or logs.
2. **Role Authority**: The user's role (`CUSTOMER`, `OWNER`, `PROVIDER`, `ADMIN`) is fetched exclusively from the verified backend endpoint `GET /api/auth/me`. JWT `user_metadata` is never used for authorization decisions.
3. **Route Guards**:
   - `ProtectedRoute`: Verifies active session and backend profile. Redirects to `/login` if unauthenticated.
   - `RoleRoute`: Enforces allowed role arrays (e.g. `['OWNER', 'ADMIN']`), displaying an accessible `ForbiddenView` (403) on mismatch.
   - `GuestRoute`: Redirects logged-in users directly to their role-specific dashboard.
   - `AccountDisabledView`: Intercepts deactivated accounts with friendly sign-out options.
4. **Rupee Accuracy**: All prices are formatted without floating point distortions via `formatINR()`. Numbers are formatted using Indian comma grouping (e.g., `₹12,34,567.50`).

---

## Directory Structure

```
frontend/
├── src/
│   ├── api/
│   │   └── client.js             # apiRequest wrapper, ApiError class, 401 redirect handling
│   ├── components/
│   │   ├── feedback/
│   │   │   └── ErrorBoundary.jsx # React class error boundary with retry UI
│   │   ├── layout/
│   │   │   ├── AppLayout.jsx     # Desktop sidebar + mobile bottom nav + notification bell
│   │   │   └── PublicLayout.jsx  # Sticky brand navbar + structured footer
│   │   └── ui/                   # 30+ UI primitives with min 44px targets & accessible ARIA
│   │       ├── Avatar.jsx
│   │       ├── Badge.jsx
│   │       ├── Breadcrumbs.jsx
│   │       ├── Button.jsx
│   │       ├── Card.jsx
│   │       ├── Checkbox.jsx
│   │       ├── ConfirmDialog.jsx
│   │       ├── DateTime.jsx
│   │       ├── Drawer.jsx
│   │       ├── DropdownMenu.jsx
│   │       ├── EmptyState.jsx
│   │       ├── ErrorState.jsx
│   │       ├── FormField.jsx
│   │       ├── IconButton.jsx
│   │       ├── Input.jsx
│   │       ├── Modal.jsx
│   │       ├── Pagination.jsx
│   │       ├── PasswordInput.jsx
│   │       ├── Price.jsx
│   │       ├── Radio.jsx
│   │       ├── Rating.jsx
│   │       ├── Select.jsx
│   │       ├── Skeleton.jsx
│   │       ├── Spinner.jsx
│   │       ├── StatusBadge.jsx
│   │       ├── Stepper.jsx
│   │       ├── Switch.jsx
│   │       ├── Tabs.jsx
│   │       ├── Textarea.jsx
│   │       ├── Toast.jsx
│   │       ├── Tooltip.jsx
│   │       └── index.js          # Barrel export
│   ├── features/
│   │   └── auth/
│   │       ├── AuthContext.jsx   # Supabase session + /api/auth/me profile sync
│   │       └── useAuth.js
│   ├── lib/
│   │   ├── motion.jsx            # Motion primitives (PageTransition, Reveal, Magnetic, CountUp)
│   │   ├── supabase.js           # Supabase browser client
│   │   └── utils.js              # cn(), formatINR(), formatKolkata()
│   ├── pages/
│   │   ├── account/
│   │   │   └── ProfilePage.jsx   # Profile edit & avatar upload (/api/auth/me/avatar)
│   │   ├── auth/
│   │   │   ├── LoginPage.jsx     # Split-screen editorial login
│   │   │   ├── SignupPage.jsx    # Role selection stepper + password strength meter
│   │   │   └── ResetPasswordPage.jsx
│   │   ├── ComingSoonPage.jsx    # Upcoming phase placeholder
│   │   ├── DesignSystemPage.jsx  # Visual component review (/design)
│   │   ├── LandingPage.jsx       # Editorial hero, live counters, pillars
│   │   └── NotFoundPage.jsx      # Handcrafted 404
│   ├── routes/
│   │   ├── guards.jsx            # ProtectedRoute, RoleRoute, GuestRoute
│   │   └── index.jsx             # App routes tree
│   ├── styles/
│   │   └── index.css             # Tailwind imports, font variables, textures, focus rings
│   └── test/
│       ├── apiError.test.js      # ApiError & fetch wrapper tests
│       ├── guards.test.jsx       # Route guard helper tests
│       ├── price.test.jsx        # formatINR & Price component tests
│       ├── setup.js              # Vitest setup & polyfills
│       └── statusBadge.test.jsx  # StatusBadge domain mapping tests
├── eslint.config.js
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.js
```

---

## Development & Verification Commands

All commands should be executed from the `frontend/` directory:

```bash
# Start development server on port 5173
npm run dev

# Run unit and component test suite (Vitest)
npm test

# Run ESLint validation
npm run lint

# Run production build
npm run build
```

---

## Visual Design System Review

Visit the `/design` route in your browser to inspect every component in the system in all variants, sizes, and interactive states:
- Color swatches & typography scale
- Button variants, sizes, and states (loading, disabled)
- Text inputs, password toggle, textarea, select, switch, checkbox, radio group
- Status badges for booking, payment, maintenance, inspection, and space domains
- Price formatting with Indian numbering and zero float distortion
- Interactive and read-only star ratings
- Asia/Kolkata formatted date and time
- Modals, drawers, confirm dialogs, tooltips, dropdown menus
- Breadcrumbs, steppers, pagination, empty states, error recovery states, and skeletons
