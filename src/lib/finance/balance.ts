import { getCategoryLabel } from './categories';
import type {
  BalanceResult,
  BalanceSummaryInput,
  ExpenseCategoryKey,
  TransactionRecord,
} from './types';

/**
 * Rule 1:
 * Total balance = starting balance + all income - all expenses.
 * Set aside = net goal contributions (withdrawals are negative).
 * Available to spend = Total - Set aside.
 */
export function computeBalance(input: BalanceSummaryInput): BalanceResult {
  const startingBalanceMinor = Math.round(input.startingBalanceMinor || 0);
  const totalIncomeMinor = Math.round(input.totalIncomeMinor || 0);
  const totalExpenseMinor = Math.round(input.totalExpenseMinor || 0);
  const setAsideMinor = Math.round(input.netGoalContributionsMinor || 0);

  const totalBalanceMinor = startingBalanceMinor + totalIncomeMinor - totalExpenseMinor;
  const availableToSpendMinor = totalBalanceMinor - setAsideMinor;

  return {
    startingBalanceMinor,
    totalIncomeMinor,
    totalExpenseMinor,
    totalBalanceMinor,
    setAsideMinor,
    availableToSpendMinor,
  };
}

export interface PeriodSummaryResult {
  incomeMinor: number;
  expenseMinor: number;
  netSavingsMinor: number;
  savingsRatePct: number | null;
  savingsRateFormatted: string;
}

/**
 * Rule 2:
 * Net savings = income - expenses (can be negative).
 * Savings rate = net savings / income, shown as "—" when income is 0.
 */
export function computePeriodSummary(
  transactions: ReadonlyArray<Pick<TransactionRecord, 'type' | 'amount_minor'>>
): PeriodSummaryResult {
  let incomeMinor = 0;
  let expenseMinor = 0;

  for (const txn of transactions) {
    if (txn.type === 'income') {
      incomeMinor += txn.amount_minor;
    } else if (txn.type === 'expense') {
      expenseMinor += txn.amount_minor;
    }
  }

  const netSavingsMinor = incomeMinor - expenseMinor;
  const savingsRatePct =
    incomeMinor === 0 ? null : (netSavingsMinor / incomeMinor) * 100;

  // Normalize -0.0%
  const normalizedRate =
    savingsRatePct !== null && Math.abs(savingsRatePct) < 0.005 ? 0 : savingsRatePct;

  const savingsRateFormatted =
    normalizedRate === null ? '—' : `${normalizedRate.toFixed(1)}%`;

  return {
    incomeMinor,
    expenseMinor,
    netSavingsMinor,
    savingsRatePct: normalizedRate,
    savingsRateFormatted,
  };
}

export interface PeriodComparisonResult {
  hasEarlierData: boolean;
  currentMinor: number;
  previousMinor: number;
  deltaMinor: number;
  percentChange: number | null;
  label: string;
}

/**
 * Rule 3:
 * If the previous period has no transactions or a zero base, show "No earlier data",
 * never Infinity or 100%.
 */
export function computePeriodComparison(
  currentMinor: number,
  previousMinor: number,
  previousTransactionCount = 1
): PeriodComparisonResult {
  const deltaMinor = currentMinor - previousMinor;

  if (previousTransactionCount <= 0 || previousMinor <= 0) {
    return {
      hasEarlierData: false,
      currentMinor,
      previousMinor,
      deltaMinor,
      percentChange: null,
      label: 'No earlier data',
    };
  }

  const rawPct = ((currentMinor - previousMinor) / previousMinor) * 100;
  const percentChange = Math.abs(rawPct) < 0.005 ? 0 : rawPct;
  const sign = percentChange > 0 ? '+' : '';

  return {
    hasEarlierData: true,
    currentMinor,
    previousMinor,
    deltaMinor,
    percentChange,
    label: `${sign}${percentChange.toFixed(1)}% vs previous period`,
  };
}

export interface CategoryBreakdownItem {
  category: ExpenseCategoryKey;
  label: string;
  amountMinor: number;
  percentage: number;
  count: number;
}

/**
 * Rule 3:
 * Computes expense breakdown by category.
 * Highest-spending category ties break alphabetically.
 */
export function computeCategoryBreakdown(
  transactions: ReadonlyArray<Pick<TransactionRecord, 'type' | 'category' | 'amount_minor'>>
): CategoryBreakdownItem[] {
  const totals = new Map<ExpenseCategoryKey, { amountMinor: number; count: number }>();
  let totalExpenseMinor = 0;

  for (const txn of transactions) {
    if (txn.type !== 'expense' || txn.amount_minor <= 0) continue;
    const cat = txn.category as ExpenseCategoryKey;
    const prev = totals.get(cat) ?? { amountMinor: 0, count: 0 };
    totals.set(cat, {
      amountMinor: prev.amountMinor + txn.amount_minor,
      count: prev.count + 1,
    });
    totalExpenseMinor += txn.amount_minor;
  }

  if (totalExpenseMinor === 0) {
    return [];
  }

  const items: CategoryBreakdownItem[] = Array.from(totals.entries()).map(
    ([category, { amountMinor, count }]) => ({
      category,
      label: getCategoryLabel(category),
      amountMinor,
      percentage: (amountMinor / totalExpenseMinor) * 100,
      count,
    })
  );

  items.sort((a, b) => {
    if (b.amountMinor !== a.amountMinor) {
      return b.amountMinor - a.amountMinor;
    }
    return a.label.localeCompare(b.label);
  });

  return items;
}

export function getHighestSpendingCategory(
  transactions: ReadonlyArray<Pick<TransactionRecord, 'type' | 'category' | 'amount_minor'>>
): CategoryBreakdownItem | null {
  const breakdown = computeCategoryBreakdown(transactions);
  return breakdown[0] ?? null;
}
