# PocketPilot

**“Take control of your money. Plan your next move.”**

PocketPilot is a responsive personal-finance web application designed for students, young professionals, and freelancers. It combines a deterministic, pure TypeScript financial calculation engine (`src/lib/finance`) with a PostgreSQL + Row Level Security (RLS) backend powered by Supabase.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript (Strict)
- **Styling**: Tailwind CSS with semantic Light & Dark CSS custom property tokens and `next/font` (`Inter` with `tabular-nums`)
- **Database & Auth**: Supabase (`@supabase/supabase-js`, `@supabase/ssr`) with PostgreSQL Row Level Security (RLS) and `SECURITY INVOKER` atomic PL/pgSQL RPCs
- **State & Caching**: TanStack Query v5 (`@tanstack/react-query`)
- **Charts & Icons**: Recharts (lazy-loaded with accessible table toggles), `lucide-react`, `sonner` toasts
- **Testing**: Vitest (unit tests), Playwright + `@axe-core/playwright` (end-to-end & WCAG 2.1 AA accessibility checks), and `tsx` (live 2-user RLS verification script)

---

## Local Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Copy `.env.example` to `.env.local` and fill in your Supabase project credentials:
   ```bash
   cp .env.example .env.local
   ```

3. **Apply Supabase migrations**:
   Apply the SQL migrations in `supabase/migrations/` in chronological order:
   - `supabase/migrations/20261022000001_schema_and_rls.sql`
   - `supabase/migrations/20261022000002_rpcs_and_seed.sql`
   - `supabase/migrations/20261022000003_auth_provisioning.sql`
   - `supabase/migrations/20261023000004_accounts_and_splits.sql`

   Using the Supabase CLI:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   *(Or paste each migration file into the Supabase Dashboard SQL Editor in order.)*

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Required | Exposure | Description |
| :--- | :---: | :---: | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public (Browser & Server) | Your Supabase Project URL (`https://<project-ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public (Browser & Server) | Your Supabase public `anon` / `publishable` key (`sb_publishable_...` or `eyJ...`) |

> **Security Note**: Never commit `.env.local` or any service-role secret key. The browser and server only ever use the public key with Postgres Row Level Security (RLS) enforcing per-user isolation on every table.

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Next.js development server at `http://localhost:3000` |
| `npm run build` | Creates an optimized production build |
| `npm run start` | Runs the compiled production server |
| `npm run typecheck` | Runs `tsc --noEmit` strict TypeScript verification |
| `npm run lint` | Runs ESLint across `src/` and `tests/` |
| `npm run test` | Runs the Vitest unit test suite for `src/lib/finance` |
| `npm run test:rls` | Runs `scripts/test-rls.ts` proving 2-user RLS isolation across all 6 tables |
| `npm run test:e2e` | Runs the full Playwright E2E + `@axe-core/playwright` accessibility test suite |

---

## Supabase Configuration Steps

1. Create a new Supabase project at [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. In **Authentication → Providers → Email**, ensure Email sign-in is enabled.
3. In **Authentication → Settings**, enable **Allow anonymous sign-ins** (used by the *"Try demo"* button on `/login`).
4. In **Authentication → URL Configuration**, set **Site URL** to `http://localhost:3000` (or your production domain) and add `http://localhost:3000/**` and `http://localhost:3000/reset-password` to **Redirect URLs**.
5. Apply the migrations in `supabase/migrations/` and run `npm run test:rls` to verify RLS isolation.

---

## Architecture

```
src/
├── app/
│   ├── (app)/               # Authenticated routes wrapped in AuthenticatedShell
│   │   ├── overview/        # Dashboard cards, cashflow chart, category donut, insights
│   │   ├── transactions/    # Paginated ledger, search, filters, sort, CSV export, CRUD
│   │   ├── budgets/         # Monthly category budgets, month picker, summary strip
│   │   ├── goals/           # Savings goals, contribute/withdraw dialogs, history
│   │   ├── payments/        # Upcoming, Overdue, and Paid tabs, Mark paid & Undo
│   │   ├── analytics/       # Multi-month trends, savings rate, category & budget reports
│   │   ├── affordability/   # "Can I Afford It?" calculator
│   │   └── settings/        # Profile, theme, CSV/JSON export, sample data, RESET
│   ├── login/               # Email sign-in, sign-up, and "Try demo"
│   └── reset-password/      # Password recovery flow
├── components/
│   ├── layout/              # Responsive AppShell, PeriodSelector, ThemeProvider
│   └── ui/                  # Accessible primitives (Button, Card, Dialog, Input, etc.)
├── features/                # Feature modules & TanStack Query hooks (use-finance-data.ts)
└── lib/
    ├── finance/             # Pure, framework-free deterministic calculation module
    └── supabase/            # Typed browser/server Supabase clients & generated schema types
```

---

## Summary of Authoritative Calculation Rules (`src/lib/finance`)

1. **Minor Units (`money.ts`)**: All monetary amounts are stored as integer minor units (paise for INR). User inputs are parsed via string splitting and `BigInt` integer arithmetic (`parseMoneyToMinor`)—never floating-point multiplication. Formatted values use `Intl.NumberFormat('en-IN')` and normalize `-0` to `₹0`.
2. **Balance (`balance.ts`)**:
   - $\text{Total Balance} = \text{Starting Balance} + \sum \text{Income} - \sum \text{Expenses}$
   - $\text{Set Aside} = \sum \text{Goal Contributions}$ (withdrawals are negative)
   - $\text{Available to Spend} = \text{Total Balance} - \text{Set Aside}$
3. **Period Summary & Comparisons (`balance.ts`, `dates.ts`)**:
   - $\text{Net Savings} = \text{Income} - \text{Expenses}$; $\text{Savings Rate} = \text{Net Savings} \div \text{Income}$ (displayed as `"—"` when income is $0$).
   - `"This month"` compares Month-to-Date ($N$ days) against the first $N$ days of the previous calendar month. Zero base or no prior transactions displays `"No earlier data"`.
   - Category spending ties break alphabetically.
4. **Overview Chart (`charts.ts`)**: Independent of the global period selector (`Weekly` = last 8 Mon–Sun weeks, `Monthly` = last 12 months, `Yearly` = all calendar years with data). Views with fewer than 2 populated buckets are disabled with an explanatory tooltip.
5. **Budgets (`budgets.ts`)**: Evaluated per calendar month. Below `warn_pct` is `On track`, `warn_pct` to `<100%` is `Approaching limit`, `100%` is `Limit reached`, and `>100%` is `Exceeded` (progress bar caps visually at 100%).
6. **Savings Goals (`goals.ts`)**: Required monthly contribution = $\lceil (\text{Target} - \text{Saved}) \div \max(\text{Whole Calendar Months}, 1) \rceil$. Positive contributions cannot exceed `Available to spend`; withdrawals cannot exceed `Saved`.
7. **Recurring Payments (`payments.ts`)**: Monthly/quarterly/yearly bills advance from their `anchor_day` (e.g., `anchor_day = 31` advances `Jan 31 → Feb 28/29 → Mar 31`). Marking paid inserts a linked expense transaction; Undo deletes that transaction and restores the previous due date.
8. **Affordability (`affordability.ts`)**: $\text{Remaining} = \text{Balance} - \text{Purchase}$. Outcomes: `Comfortable` ($\text{Remaining} \ge \text{Reserve}$), `Dips into reserve` ($0 \le \text{Remaining} < \text{Reserve}$), `Exceeds balance` ($\text{Remaining} < 0$).
9. **CSV Export (`csv.ts`)**: UTF-8 with BOM (`\uFEFF`), RFC-4180 quoting, and single-quote (`'`) prefixing for cells beginning with `=`, `+`, `-`, or `@`.
10. **Advanced Deterministic Intelligence (`insights.ts`)**:
   - **Multi-Account / Wallet Breakdown**: Tracks spend and net cashflow across `UPI / Digital Wallet`, `Bank Account`, `Credit Card`, and `Cash`.
   - **Split Bills & Reimbursements**: Tracks shared expenses (`is_split`, `split_with`, `reimbursable_minor`, `is_reimbursed`), personal share vs. amount owed back by friends, and one-click settlement.
   - **50 / 30 / 20 Rule Analyzer**: Benchmarks period expenses and savings against the classic `50% Needs / 30% Wants / 20% Savings` rule.
   - **Daily Burn Rate & End-of-Month Forecast**: Projects month-end spend from daily velocity, computes safe daily allowance for remaining days, and warns of budget exhaustion day.
   - **Cashflow Calendar Heatmap & No-Spend Streak**: Maps daily spend intensity across the calendar month and tracks consecutive ₹0-spend days.
   - **Subscription & Recurring Audit**: Normalizes weekly/monthly/quarterly/yearly recurring bills into monthly and 12-month annualized commitments.
   - **Emergency Fund Survival Runway**: Calculates how many months and days of essential living expenses (`Needs`) your liquid reserve covers against 3-month and 6-month benchmarks.

---

## Known Limitations

- **In-App Reminders Only**: Payment due-soon and overdue notifications are displayed exclusively inside the top-bar notification bell; email and push notifications are intentionally out of scope.
- **Display Currency Formatting Only**: Changing the currency preference in Settings updates the display symbol and `Intl.NumberFormat` locale without performing foreign-exchange conversion on stored minor-unit amounts.
- **No AI / LLM Features**: All insights and projections are 100% deterministic mathematical calculations computed from stored database records.
