import {
  addDaysISO,
  addMonthsToYearMonth,
  formatISODate,
  getDaysInMonth,
  getWeekBoundaries,
  parseISODate,
} from './dates';
import type { TransactionRecord } from './types';

export type OverviewChartMode = 'weekly' | 'monthly' | 'yearly';

export interface ChartBucket {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  incomeMinor: number;
  expenseMinor: number;
  netSavingsMinor: number;
  savingsRatePct: number | null;
  hasData: boolean;
}

export interface OverviewChartDataResult {
  mode: OverviewChartMode;
  buckets: ChartBucket[];
  bucketsWithDataCount: number;
  isDisabled: boolean;
  disabledReason: string | null;
}

const SHORT_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Rule 4:
 * Overview chart is independent of the period selector.
 * - Weekly = last 8 Monday-Sunday weeks
 * - Monthly = last 12 months
 * - Yearly = all calendar years with data
 * Zero-fill empty buckets.
 * Disable a view, with a tooltip, if fewer than 2 of its buckets contain data.
 */
export function buildOverviewChartData(
  transactions: ReadonlyArray<Pick<TransactionRecord, 'type' | 'amount_minor' | 'txn_date'>>,
  mode: OverviewChartMode,
  todayStr: string
): OverviewChartDataResult {
  if (mode === 'weekly') {
    const currentWeek = getWeekBoundaries(todayStr);
    const buckets: ChartBucket[] = [];

    for (let i = 7; i >= 0; i--) {
      const startDate = addDaysISO(currentWeek.start, -i * 7);
      const endDate = addDaysISO(startDate, 6);
      const startParts = parseISODate(startDate);
      const label = `${startParts.day} ${SHORT_MONTH_NAMES[startParts.month - 1]}`;

      let incomeMinor = 0;
      let expenseMinor = 0;
      let count = 0;

      for (const txn of transactions) {
        if (txn.txn_date >= startDate && txn.txn_date <= endDate) {
          count++;
          if (txn.type === 'income') incomeMinor += txn.amount_minor;
          else expenseMinor += txn.amount_minor;
        }
      }

      const netSavingsMinor = incomeMinor - expenseMinor;
      buckets.push({
        key: startDate,
        label,
        startDate,
        endDate,
        incomeMinor,
        expenseMinor,
        netSavingsMinor,
        savingsRatePct: incomeMinor > 0 ? (netSavingsMinor / incomeMinor) * 100 : null,
        hasData: count > 0,
      });
    }

    const bucketsWithDataCount = buckets.filter((b) => b.hasData).length;
    const isDisabled = bucketsWithDataCount < 2;
    return {
      mode,
      buckets,
      bucketsWithDataCount,
      isDisabled,
      disabledReason: isDisabled
        ? 'Need transactions in at least 2 of the last 8 weeks to compare weekly trends.'
        : null,
    };
  }

  if (mode === 'monthly') {
    const { year, month } = parseISODate(todayStr);
    const buckets: ChartBucket[] = [];

    for (let i = 11; i >= 0; i--) {
      const ym = addMonthsToYearMonth(year, month, -i);
      const key = `${String(ym.year).padStart(4, '0')}-${String(ym.month).padStart(2, '0')}`;
      const startDate = formatISODate(ym.year, ym.month, 1);
      const endDate = formatISODate(ym.year, ym.month, getDaysInMonth(ym.year, ym.month));
      const label = `${SHORT_MONTH_NAMES[ym.month - 1]} ${String(ym.year).slice(-2)}`;

      let incomeMinor = 0;
      let expenseMinor = 0;
      let count = 0;

      for (const txn of transactions) {
        if (txn.txn_date.startsWith(key)) {
          count++;
          if (txn.type === 'income') incomeMinor += txn.amount_minor;
          else expenseMinor += txn.amount_minor;
        }
      }

      const netSavingsMinor = incomeMinor - expenseMinor;
      buckets.push({
        key,
        label,
        startDate,
        endDate,
        incomeMinor,
        expenseMinor,
        netSavingsMinor,
        savingsRatePct: incomeMinor > 0 ? (netSavingsMinor / incomeMinor) * 100 : null,
        hasData: count > 0,
      });
    }

    const bucketsWithDataCount = buckets.filter((b) => b.hasData).length;
    const isDisabled = bucketsWithDataCount < 2;
    return {
      mode,
      buckets,
      bucketsWithDataCount,
      isDisabled,
      disabledReason: isDisabled
        ? 'Need transactions in at least 2 of the last 12 months to compare monthly trends.'
        : null,
    };
  }

  // Yearly = all calendar years with data (zero-filling any gaps between minYear and maxYear)
  const yearsWithData = new Set<number>();
  for (const txn of transactions) {
    const y = Number(txn.txn_date.slice(0, 4));
    if (Number.isFinite(y) && y > 1900) {
      yearsWithData.add(y);
    }
  }

  if (yearsWithData.size === 0) {
    return {
      mode: 'yearly',
      buckets: [],
      bucketsWithDataCount: 0,
      isDisabled: true,
      disabledReason: 'Need transactions in at least 2 calendar years to compare yearly trends.',
    };
  }

  const sortedYears = Array.from(yearsWithData).sort((a, b) => a - b);
  const minYear = sortedYears[0];
  const maxYear = sortedYears[sortedYears.length - 1];
  const buckets: ChartBucket[] = [];

  for (let y = minYear; y <= maxYear; y++) {
    const key = String(y);
    const startDate = formatISODate(y, 1, 1);
    const endDate = formatISODate(y, 12, 31);
    let incomeMinor = 0;
    let expenseMinor = 0;
    let count = 0;

    for (const txn of transactions) {
      if (txn.txn_date.startsWith(`${key}-`)) {
        count++;
        if (txn.type === 'income') incomeMinor += txn.amount_minor;
        else expenseMinor += txn.amount_minor;
      }
    }

    const netSavingsMinor = incomeMinor - expenseMinor;
    buckets.push({
      key,
      label: key,
      startDate,
      endDate,
      incomeMinor,
      expenseMinor,
      netSavingsMinor,
      savingsRatePct: incomeMinor > 0 ? (netSavingsMinor / incomeMinor) * 100 : null,
      hasData: count > 0,
    });
  }

  const bucketsWithDataCount = buckets.filter((b) => b.hasData).length;
  const isDisabled = bucketsWithDataCount < 2;

  return {
    mode: 'yearly',
    buckets,
    bucketsWithDataCount,
    isDisabled,
    disabledReason: isDisabled
      ? 'Need transactions in at least 2 calendar years to compare yearly trends.'
      : null,
  };
}
