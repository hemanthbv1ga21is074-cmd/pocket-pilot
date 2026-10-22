import { describe, expect, it } from 'vitest';
import {
  computeBalance,
  computePeriodSummary,
  computePeriodComparison,
  computeCategoryBreakdown,
  getHighestSpendingCategory,
  evaluateBudgetStatus,
  evaluateMonthlyBudgets,
  computeRemainingMonthlyBudget,
  evaluateGoal,
  validateGoalContribution,
  computeNextDueDate,
  evaluatePaymentStatus,
  evaluateAllPayments,
  evaluateAffordability,
  parseMoneyToMinor,
  formatMoney,
  minorToDecimalString,
  escapeCsvCell,
  transactionsToCsv,
  UTF8_BOM,
  getTodayInTimezone,
  getWeekBoundaries,
  getMonthBoundaries,
  resolvePeriodRange,
  isFutureDate,
  buildOverviewChartData,
  isCategoryValidForType,
  resolveCategoryOnTypeChange,
} from '@/lib/finance';

describe('src/lib/finance — Authoritative Business Rules Unit Suite', () => {
  describe('1. Balance calculations (with and without goals)', () => {
    it('computes total balance and available to spend without goals', () => {
      const res = computeBalance({
        startingBalanceMinor: 50000_00,
        totalIncomeMinor: 120000_00,
        totalExpenseMinor: 45000_00,
        netGoalContributionsMinor: 0,
      });

      expect(res.totalBalanceMinor).toBe(125000_00);
      expect(res.setAsideMinor).toBe(0);
      expect(res.availableToSpendMinor).toBe(125000_00);
    });

    it('computes total balance, set aside, and available to spend with goal contributions & withdrawals', () => {
      // Net goal contributions = 30,000 contributed - 5,000 withdrawn = 25,000
      const res = computeBalance({
        startingBalanceMinor: 20000_00,
        totalIncomeMinor: 80000_00,
        totalExpenseMinor: 35000_00,
        netGoalContributionsMinor: 25000_00,
      });

      expect(res.totalBalanceMinor).toBe(65000_00);
      expect(res.setAsideMinor).toBe(25000_00);
      expect(res.availableToSpendMinor).toBe(40000_00);
    });
  });

  describe('2. Period summary & savings rate (including zero income)', () => {
    it('returns "—" and null savingsRatePct when income is 0', () => {
      const summary = computePeriodSummary([
        { type: 'expense', amount_minor: 1500_00 },
        { type: 'expense', amount_minor: 2500_00 },
      ]);

      expect(summary.incomeMinor).toBe(0);
      expect(summary.expenseMinor).toBe(4000_00);
      expect(summary.netSavingsMinor).toBe(-4000_00);
      expect(summary.savingsRatePct).toBeNull();
      expect(summary.savingsRateFormatted).toBe('—');
    });

    it('computes positive and negative savings rate when income > 0', () => {
      const pos = computePeriodSummary([
        { type: 'income', amount_minor: 100000_00 },
        { type: 'expense', amount_minor: 65000_00 },
      ]);
      expect(pos.netSavingsMinor).toBe(35000_00);
      expect(pos.savingsRatePct).toBeCloseTo(35.0, 2);
      expect(pos.savingsRateFormatted).toBe('35.0%');

      const neg = computePeriodSummary([
        { type: 'income', amount_minor: 50000_00 },
        { type: 'expense', amount_minor: 60000_00 },
      ]);
      expect(neg.netSavingsMinor).toBe(-10000_00);
      expect(neg.savingsRatePct).toBeCloseTo(-20.0, 2);
      expect(neg.savingsRateFormatted).toBe('-20.0%');
    });
  });

  describe('3. Comparisons (zero base, no earlier data, month-to-date, tie-breaking)', () => {
    it('returns "No earlier data" when previous base is 0 or has no transactions (never Infinity or 100%)', () => {
      const zeroBase = computePeriodComparison(25000_00, 0, 0);
      expect(zeroBase.hasEarlierData).toBe(false);
      expect(zeroBase.percentChange).toBeNull();
      expect(zeroBase.label).toBe('No earlier data');

      const zeroAmountWithTxns = computePeriodComparison(10000_00, 0, 2);
      expect(zeroAmountWithTxns.hasEarlierData).toBe(false);
      expect(zeroAmountWithTxns.percentChange).toBeNull();
      expect(zeroAmountWithTxns.label).toBe('No earlier data');
    });

    it('computes exact percentage change when previous period has non-zero data', () => {
      const comp = computePeriodComparison(12000_00, 10000_00, 3);
      expect(comp.hasEarlierData).toBe(true);
      expect(comp.percentChange).toBeCloseTo(20, 2);
      expect(comp.deltaMinor).toBe(2000_00);
      expect(comp.label).toBe('+20.0% vs previous period');
    });

    it('resolves month-to-date comparison window for "this_month"', () => {
      // May 15, 2026 -> compares May 1..15 with Apr 1..15
      const mayMid = resolvePeriodRange('this_month', '2026-05-15');
      expect(mayMid.start).toBe('2026-05-01');
      expect(mayMid.end).toBe('2026-05-15');
      expect(mayMid.prevStart).toBe('2026-04-01');
      expect(mayMid.prevEnd).toBe('2026-04-15');

      // Mar 31, 2026 -> clamps previous month end to Feb 28, 2026
      const marEnd = resolvePeriodRange('this_month', '2026-03-31');
      expect(marEnd.start).toBe('2026-03-01');
      expect(marEnd.end).toBe('2026-03-31');
      expect(marEnd.prevStart).toBe('2026-02-01');
      expect(marEnd.prevEnd).toBe('2026-02-28');
    });

    it('breaks highest-spending category ties alphabetically and returns null when no expenses exist', () => {
      expect(
        getHighestSpendingCategory([{ type: 'income', category: 'salary', amount_minor: 50000_00 }])
      ).toBeNull();

      const tied = computeCategoryBreakdown([
        { type: 'expense', category: 'transport', amount_minor: 5000_00 },
        { type: 'expense', category: 'food_dining', amount_minor: 5000_00 },
        { type: 'expense', category: 'shopping', amount_minor: 3000_00 },
      ]);
      // "Food and Dining" comes before "Transport" alphabetically
      expect(tied[0].category).toBe('food_dining');
      expect(tied[1].category).toBe('transport');
      expect(getHighestSpendingCategory([
        { type: 'expense', category: 'transport', amount_minor: 5000_00 },
        { type: 'expense', category: 'food_dining', amount_minor: 5000_00 },
      ])?.category).toBe('food_dining');
    });
  });

  describe('4. Budget thresholds at 79%, 80%, 99%, 100%, and 101% & remaining monthly budget', () => {
    const limit = 100_00; // ₹100.00 = 10,000 paise, warn_pct = 80

    it('evaluates 79% as normal', () => {
      const r79 = evaluateBudgetStatus(79_00, limit, 80);
      expect(r79.percentUsed).toBe(79);
      expect(r79.barPercent).toBe(79);
      expect(r79.status).toBe('normal');
      expect(r79.statusLabel).toBe('On track');
    });

    it('evaluates 80% and 99% as approaching', () => {
      const r80 = evaluateBudgetStatus(80_00, limit, 80);
      expect(r80.percentUsed).toBe(80);
      expect(r80.barPercent).toBe(80);
      expect(r80.status).toBe('approaching');
      expect(r80.statusLabel).toBe('Approaching limit');

      const r99 = evaluateBudgetStatus(99_00, limit, 80);
      expect(r99.percentUsed).toBe(99);
      expect(r99.barPercent).toBe(99);
      expect(r99.status).toBe('approaching');
      expect(r99.statusLabel).toBe('Approaching limit');
    });

    it('evaluates 100% as reached ("Limit reached")', () => {
      const r100 = evaluateBudgetStatus(100_00, limit, 80);
      expect(r100.percentUsed).toBe(100);
      expect(r100.barPercent).toBe(100);
      expect(r100.status).toBe('reached');
      expect(r100.statusLabel).toBe('Limit reached');
    });

    it('evaluates 101% as exceeded while capping visual bar at 100%', () => {
      const r101 = evaluateBudgetStatus(101_00, limit, 80);
      expect(r101.percentUsed).toBe(101);
      expect(r101.barPercent).toBe(100);
      expect(r101.status).toBe('exceeded');
      expect(r101.statusLabel).toBe('Exceeded');
    });

    it('computes Remaining monthly budget with and without overall cap', () => {
      const budgets = [
        { id: 'b1', category: 'food_dining' as const, limit_minor: 10000_00 },
        { id: 'b2', category: 'transport' as const, limit_minor: 5000_00 },
      ];
      const txns = [
        { type: 'expense' as const, category: 'food_dining' as const, amount_minor: 6000_00, txn_date: '2026-10-05' },
        { type: 'expense' as const, category: 'shopping' as const, amount_minor: 4000_00, txn_date: '2026-10-10' }, // unbudgeted category
      ];

      // Without overall cap: sum of limits (15,000) minus spending in budgeted categories only (6,000) = 9,000
      const withoutCap = computeRemainingMonthlyBudget(budgets, txns, '2026-10', null);
      expect(withoutCap.mode).toBe('category_sum');
      expect(withoutCap.totalLimitMinor).toBe(15000_00);
      expect(withoutCap.totalSpentMinor).toBe(6000_00);
      expect(withoutCap.remainingMinor).toBe(9000_00);

      // With overall cap (25,000): overall cap minus ALL expenses (6,000 + 4,000 = 10,000) = 15,000
      const withCap = computeRemainingMonthlyBudget(budgets, txns, '2026-10', 25000_00);
      expect(withCap.mode).toBe('overall_cap');
      expect(withCap.totalLimitMinor).toBe(25000_00);
      expect(withCap.totalSpentMinor).toBe(10000_00);
      expect(withCap.remainingMinor).toBe(15000_00);

      const monthlyCards = evaluateMonthlyBudgets(budgets, txns, '2026-10', 80);
      expect(monthlyCards).toHaveLength(2);
    });
  });

  describe('5. Goal monthly requirements (past date, same month, reached, no date) & validation', () => {
    const baseGoal = {
      id: 'g1',
      name: 'Emergency Fund',
      target_minor: 100000_00,
    };

    it('handles reached goal state', () => {
      const res = evaluateGoal(
        { ...baseGoal, target_date: '2026-12-31' },
        [{ goal_id: 'g1', amount_minor: 100000_00 }],
        '2026-10-15'
      );
      expect(res.state).toBe('reached');
      expect(res.stateLabel).toBe('Goal reached');
      expect(res.remainingMinor).toBe(0);
      expect(res.progressPct).toBe(100);
      expect(res.requiredMonthlyMinor).toBeNull();
    });

    it('handles past target date ("Target date passed", shows remaining, no monthly figure)', () => {
      const res = evaluateGoal(
        { ...baseGoal, target_date: '2026-09-01' },
        [{ goal_id: 'g1', amount_minor: 40000_00 }],
        '2026-10-15'
      );
      expect(res.state).toBe('past_due');
      expect(res.stateLabel).toBe('Target date passed');
      expect(res.remainingMinor).toBe(60000_00);
      expect(res.requiredMonthlyMinor).toBeNull();
    });

    it('handles no target date ("No target date")', () => {
      const res = evaluateGoal(
        { ...baseGoal, target_date: null },
        [{ goal_id: 'g1', amount_minor: 25000_00 }],
        '2026-10-15'
      );
      expect(res.state).toBe('no_date');
      expect(res.stateLabel).toBe('No target date');
      expect(res.remainingMinor).toBe(75000_00);
      expect(res.requiredMonthlyMinor).toBeNull();
    });

    it('handles same-month target date (clamps divisor to minimum 1 month)', () => {
      const res = evaluateGoal(
        { ...baseGoal, target_date: '2026-10-28' },
        [{ goal_id: 'g1', amount_minor: 30000_00 }],
        '2026-10-15'
      );
      expect(res.state).toBe('active');
      expect(res.monthsRemaining).toBe(1);
      expect(res.requiredMonthlyMinor).toBe(70000_00);
    });

    it('rounds up required monthly contribution across multiple whole calendar months', () => {
      // Remaining = 100,000 paise (₹1,000), 3 whole months -> ceil(100000 / 3) = 33334 paise
      const res = evaluateGoal(
        { id: 'g2', name: 'Trip', target_minor: 1000_00, target_date: '2027-01-20' },
        [],
        '2026-10-15'
      );
      expect(res.monthsRemaining).toBe(3);
      expect(res.requiredMonthlyMinor).toBe(33334);
    });

    it('validates positive contributions against Available to spend and withdrawals against saved amount', () => {
      expect(validateGoalContribution(5000_00, 4000_00, 10000_00).ok).toBe(false);
      expect(validateGoalContribution(4000_00, 4000_00, 10000_00).ok).toBe(true);
      expect(validateGoalContribution(-12000_00, 4000_00, 10000_00).ok).toBe(false);
      expect(validateGoalContribution(-10000_00, 4000_00, 10000_00).ok).toBe(true);
    });
  });

  describe('6. Recurrence (Jan 31 -> Feb -> Mar, leap years, weekly, yearly Feb 29) & statuses', () => {
    it('advances monthly payment anchored on 31st: Jan 31 -> Feb 28 -> Mar 31 (non-leap year)', () => {
      const feb = computeNextDueDate('2026-01-31', 'monthly', 31);
      expect(feb).toBe('2026-02-28');
      const mar = computeNextDueDate(feb, 'monthly', 31);
      expect(mar).toBe('2026-03-31');
      const apr = computeNextDueDate(mar, 'monthly', 31);
      expect(apr).toBe('2026-04-30');
    });

    it('advances monthly payment anchored on 31st in leap year: Jan 31 -> Feb 29 -> Mar 31', () => {
      const febLeap = computeNextDueDate('2024-01-31', 'monthly', 31);
      expect(febLeap).toBe('2024-02-29');
      const marLeap = computeNextDueDate(febLeap, 'monthly', 31);
      expect(marLeap).toBe('2024-03-31');
    });

    it('advances weekly payments by exactly 7 calendar days across month/year boundaries', () => {
      expect(computeNextDueDate('2026-12-28', 'weekly', 28)).toBe('2027-01-04');
    });

    it('advances yearly payment anchored on Feb 29 (2024-02-29 -> 2025-02-28, and restores 29 on leap year)', () => {
      const nextNonLeap = computeNextDueDate('2024-02-29', 'yearly', 29);
      expect(nextNonLeap).toBe('2025-02-28');
      const leap2028 = computeNextDueDate('2027-02-28', 'yearly', 29);
      expect(leap2028).toBe('2028-02-29');
    });

    it('derives Overdue, Due soon (<=7 days), Upcoming (>7 days), and Paid statuses', () => {
      const today = '2026-10-15';
      expect(
        evaluatePaymentStatus({ frequency: 'monthly', is_paid: false, next_due_date: '2026-10-14' }, today)
          .status
      ).toBe('overdue');
      expect(
        evaluatePaymentStatus({ frequency: 'monthly', is_paid: false, next_due_date: '2026-10-15' }, today)
          .status
      ).toBe('due_soon');
      expect(
        evaluatePaymentStatus({ frequency: 'monthly', is_paid: false, next_due_date: '2026-10-22' }, today)
          .status
      ).toBe('due_soon');
      expect(
        evaluatePaymentStatus({ frequency: 'monthly', is_paid: false, next_due_date: '2026-10-23' }, today)
          .status
      ).toBe('upcoming');
      expect(
        evaluatePaymentStatus({ frequency: 'once', is_paid: true, next_due_date: '2026-10-01' }, today)
          .status
      ).toBe('paid');

      const grouped = evaluateAllPayments(
        [
          {
            id: 'p1',
            name: 'Broadband',
            amount_minor: 999_00,
            category: 'bills_utilities',
            frequency: 'monthly',
            next_due_date: '2026-10-12',
            anchor_day: 12,
            is_paid: false,
          },
          {
            id: 'p2',
            name: 'Netflix',
            amount_minor: 649_00,
            category: 'subscriptions',
            frequency: 'monthly',
            next_due_date: '2026-10-18',
            anchor_day: 18,
            is_paid: false,
          },
        ],
        today
      );
      expect(grouped.reminders).toHaveLength(2);
    });
  });

  describe('7. Affordability outcomes and exact boundaries', () => {
    it('returns Comfortable when remaining >= reserve (including exact equality boundary)', () => {
      const exactBoundary = evaluateAffordability({
        balanceMinor: 50000_00,
        purchaseMinor: 30000_00,
        reserveMinor: 20000_00,
      });
      expect(exactBoundary.outcome).toBe('comfortable');
      expect(exactBoundary.remainingMinor).toBe(20000_00);
      expect(exactBoundary.shortfallMinor).toBe(0);
    });

    it('returns Dips into reserve when 0 <= remaining < reserve (including 0 remaining boundary)', () => {
      const dips = evaluateAffordability({
        balanceMinor: 50000_00,
        purchaseMinor: 35000_00,
        reserveMinor: 20000_00,
      });
      expect(dips.outcome).toBe('dips_into_reserve');
      expect(dips.remainingMinor).toBe(15000_00);
      expect(dips.shortfallMinor).toBe(5000_00);

      const zeroRemaining = evaluateAffordability({
        balanceMinor: 50000_00,
        purchaseMinor: 50000_00,
        reserveMinor: 10000_00,
      });
      expect(zeroRemaining.outcome).toBe('dips_into_reserve');
      expect(zeroRemaining.remainingMinor).toBe(0);
      expect(zeroRemaining.shortfallMinor).toBe(10000_00);
    });

    it('returns Exceeds balance when remaining < 0', () => {
      const exceeds = evaluateAffordability({
        balanceMinor: 50000_00,
        purchaseMinor: 50000_01,
        reserveMinor: 10000_00,
      });
      expect(exceeds.outcome).toBe('exceeds_balance');
      expect(exceeds.remainingMinor).toBe(-1);
      expect(exceeds.shortfallMinor).toBe(1);
    });
  });

  describe('8. Money parsing (0.1, 0.2, 1,25,000.50) and formatting (never "-0")', () => {
    it('parses 0.1, 0.2, and 1,25,000.50 without floating point drift', () => {
      const p1 = parseMoneyToMinor('0.1');
      const p2 = parseMoneyToMinor('0.2');
      const p3 = parseMoneyToMinor('1,25,000.50');
      const p4 = parseMoneyToMinor('19.99');

      expect(p1).toEqual({ ok: true, minor: 10 });
      expect(p2).toEqual({ ok: true, minor: 20 });
      if (p1.ok && p2.ok) {
        expect(p1.minor + p2.minor).toBe(30); // Exact 30 paise
      }
      expect(p3).toEqual({ ok: true, minor: 12500050 });
      expect(p4).toEqual({ ok: true, minor: 1999 });
    });

    it('rejects >2 decimals, zero (by default), negative, and > ₹10 crore', () => {
      expect(parseMoneyToMinor('0').ok).toBe(false);
      expect(parseMoneyToMinor('10.123').ok).toBe(false);
      expect(parseMoneyToMinor('-50').ok).toBe(false);
      expect(parseMoneyToMinor('100000000.01').ok).toBe(false); // > 10 crore
      expect(parseMoneyToMinor('100000000.00')).toEqual({
        ok: true,
        minor: 10_000_000_000,
      });
    });

    it('formats INR with en-IN grouping and never displays "-0"', () => {
      expect(formatMoney(125000_00)).toBe('₹1,25,000');
      expect(formatMoney(125000_50)).toBe('₹1,25,000.50');
      expect(formatMoney(-1250_00)).toBe('-₹1,250');
      expect(formatMoney(-0)).toBe('₹0');
      expect(formatMoney(0)).toBe('₹0');
      expect(minorToDecimalString(12500050)).toBe('125000.50');
    });
  });

  describe('9. CSV escaping and formula injection protection', () => {
    it('prefixes cells starting with =, +, -, or @ with an apostrophe and applies RFC-4180 quotes', () => {
      expect(escapeCsvCell('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(escapeCsvCell('+12345')).toBe("'+12345");
      expect(escapeCsvCell('-12345')).toBe("'-12345");
      expect(escapeCsvCell('@cmd')).toBe("'@cmd");
      expect(escapeCsvCell('Dinner, "Team"')).toBe('"Dinner, ""Team"""');
      expect(escapeCsvCell('=1+1, "injected"')).toBe('"\'=1+1, ""injected"""');
    });

    it('generates UTF-8 BOM CSV with expected headers and escaped rows', () => {
      const csv = transactionsToCsv([
        {
          txn_date: '2026-10-10',
          type: 'expense',
          category: 'food_dining',
          description: '=cmd|"/c calc"!A0',
          amount_minor: 125050,
          notes: 'Lunch, "special"',
        },
      ]);

      expect(csv.startsWith(UTF8_BOM)).toBe(true);
      const lines = csv.slice(1).split('\r\n');
      expect(lines[0]).toBe('Date,Type,Category,Description,Amount,Notes');
      expect(lines[1]).toBe(
        '2026-10-10,expense,Food and Dining,"\'=cmd|""/c calc""!A0",1250.50,"Lunch, ""special"""'
      );
    });
  });

  describe('10. Week and month boundaries in Asia/Kolkata around midnight', () => {
    it('resolves Asia/Kolkata date accurately across UTC/IST midnight transition', () => {
      // 2026-05-31T18:29:59Z is 2026-05-31 23:59:59 IST (Sunday, May 31)
      const justBeforeMidnightIST = new Date('2026-05-31T18:29:59.000Z');
      const dateBefore = getTodayInTimezone(justBeforeMidnightIST, 'Asia/Kolkata');
      expect(dateBefore).toBe('2026-05-31');

      // 2026-05-31T18:30:01Z is 2026-06-01 00:00:01 IST (Monday, June 1)
      const justAfterMidnightIST = new Date('2026-05-31T18:30:01.000Z');
      const dateAfter = getTodayInTimezone(justAfterMidnightIST, 'Asia/Kolkata');
      expect(dateAfter).toBe('2026-06-01');

      // Week boundaries: 2026-05-31 (Sunday) belongs to Mon May 25 .. Sun May 31
      expect(getWeekBoundaries(dateBefore)).toEqual({
        start: '2026-05-25',
        end: '2026-05-31',
      });

      // Week boundaries: 2026-06-01 (Monday) starts new week Mon Jun 01 .. Sun Jun 07
      expect(getWeekBoundaries(dateAfter)).toEqual({
        start: '2026-06-01',
        end: '2026-06-07',
      });

      // Month boundaries flip from May to June at IST midnight
      expect(getMonthBoundaries(dateBefore)).toEqual({
        start: '2026-05-01',
        end: '2026-05-31',
        yearMonth: '2026-05',
      });
      expect(getMonthBoundaries(dateAfter)).toEqual({
        start: '2026-06-01',
        end: '2026-06-30',
        yearMonth: '2026-06',
      });

      expect(isFutureDate('2026-06-02', dateAfter)).toBe(true);
      expect(isFutureDate('2026-06-01', dateAfter)).toBe(false);
    });

    it('builds Overview chart buckets and disables views with fewer than 2 populated buckets', () => {
      const singleTxn = [
        { type: 'expense' as const, amount_minor: 500_00, txn_date: '2026-10-15' },
      ];
      const weekly1 = buildOverviewChartData(singleTxn, 'weekly', '2026-10-15');
      expect(weekly1.buckets).toHaveLength(8);
      expect(weekly1.isDisabled).toBe(true);

      const twoWeeks = [
        { type: 'expense' as const, amount_minor: 500_00, txn_date: '2026-10-15' },
        { type: 'income' as const, amount_minor: 2000_00, txn_date: '2026-10-05' },
      ];
      const weekly2 = buildOverviewChartData(twoWeeks, 'weekly', '2026-10-15');
      expect(weekly2.isDisabled).toBe(false);

      expect(isCategoryValidForType('salary', 'income')).toBe(true);
      expect(isCategoryValidForType('salary', 'expense')).toBe(false);
      expect(resolveCategoryOnTypeChange('salary', 'expense')).toBe('food_dining');
    });
  });
});
