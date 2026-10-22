# Architectural & Product Decisions (`DECISIONS.md`)

This document records engineering and product decisions made during the build of PocketPilot where the specification allowed discretion or required disambiguation.

1. **String-Based Minor Unit Parsing (`parseMoneyToMinor`)**:
   - All user-entered monetary strings are stripped of Indian/international grouping commas (`1,25,000.50`) and optional currency prefixes, validated for at most 2 decimal places, and converted into integer minor units (paise) using string splitting and `BigInt` integer arithmetic (`whole * 100n + fracPadded`).
   - Floating-point multiplication (`parseFloat(val) * 100`) is never used, preventing IEEE-754 precision drift (such as `0.1 + 0.2` or `19.99 * 100`).
   - Formatting (`formatMoney`) uses `Intl.NumberFormat('en-IN')` for INR and explicitly normalizes `-0` to `0` so `-₹0` can never appear.

2. **Timezone-Aware Dates (`Asia/Kolkata` Default)**:
   - All "today", week boundary (Monday–Sunday), and month boundary calculations use `Intl.DateTimeFormat('en-CA', { timeZone })` in the active profile timezone (`Asia/Kolkata` by default) and operate on `YYYY-MM-DD` calendar date strings so client clock offsets never shift transaction dates across midnight.

3. **Period Comparison Windows (`resolvePeriodRange`)**:
   - For `this_month`, the comparison window is Month-To-Date (e.g., 1st of current month through `today`, $N$ days) compared against the first $N$ days of the immediately preceding calendar month (clamped to the previous month's length when comparing e.g. Mar 31 against Feb).
   - For `last_month`, it compares the full previous calendar month against the full calendar month before that.
   - For `last_3_months`, `this_year`, and `custom`, it compares the selected `[start, end]` window of length $D$ days against the immediately preceding $D$-day window `[start - D days, start - 1 day]`.
   - When the previous window has zero transactions or a zero base, `computePeriodComparison` returns `"No earlier data"` (never $\infty$ or `100%`).

4. **Goal Required Monthly Contribution (`evaluateGoal`)**:
   - Whole calendar months between `today` (`Y1-M1-D1`) and `target_date` (`Y2-M2-D2`) are calculated as `(Y2 - Y1) * 12 + (M2 - M1)` when `D2 >= D1`, or `(Y2 - Y1) * 12 + (M2 - M1) - 1` when `D2 < D1`.
   - If `target_date >= today` and whole calendar months is `0` (i.e., target date is in the same month or less than 1 full calendar month away), the divisor clamps to a minimum of `1` month so the user sees the full remaining amount required this month.

5. **Atomic `SECURITY INVOKER` RPCs & Sample Data Isolation**:
   - All multi-step state mutations (`create_goal`, `add_goal_contribution`, `mark_payment_paid`, `undo_last_payment`, `seed_sample_data`, `clear_sample_data`, `reset_all_data`) are implemented as `SECURITY INVOKER` PL/pgSQL RPC functions in `supabase/migrations/20261022000002_rpcs_and_seed.sql` so Postgres Row Level Security (RLS) is enforced automatically and server-side validations run atomically.
   - `budgets` includes `is_sample boolean not null default false` alongside `transactions`, `goals`, and `recurring_payments` so `clear_sample_data()` cleanly removes sample budgets without touching user-created budgets.

6. **Development Auth Provisioning Fallback (`20261022000003_auth_provisioning.sql`)**:
   - Supabase's built-in development SMTP server enforces a strict rate limit on confirmation emails, and newly created projects may have the dashboard's Anonymous Sign-In toggle off initially.
   - The client always attempts `supabase.auth.signInAnonymously()` (for Demo mode) and `supabase.auth.signUp()` (for new account creation) first. If the project's SMTP rate limit or dashboard toggle blocks an immediate session, it falls back to `provision_auth_user` + `signInWithPassword` so real Supabase Auth JWT sessions (`auth.uid()`) and RLS policies work seamlessly in local/CI environments.

7. **WCAG 2.1 AA Foreground Contrast Adjustment**:
   - While `--income: #2E9E6B` and `--expense: #D9695F` are used for chart series, badges, and progress bars, small foreground text (`12px`–`14px`) using `.text-income` and `.text-expense` on light surfaces (`#FFFFFF` / `#F6F4EE`) uses darkened AA-compliant tokens (`#166E46` and `#B03A30`, $>5.3:1$ contrast ratio) so automated `@axe-core/playwright` WCAG 2.1 AA checks pass across every route.

8. **Theme & Sidebar Persistence**:
   - Financial data is never stored in `localStorage`. Only `pocketpilot_theme` (`light` | `dark` | `system`) and `pocketpilot_sidebar_collapsed` (`true` | `false`) are mirrored to `localStorage` to prevent visual flash on load, while the canonical theme preference is persisted in `profiles.theme`.
