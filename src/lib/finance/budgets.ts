import { getCategoryLabel } from './categories';
import type {
  BudgetRecord,
  ExpenseCategoryKey,
  TransactionRecord,
} from './types';

export type BudgetStatus = 'normal' | 'approaching' | 'reached' | 'exceeded';

export interface EvaluatedBudget {
  id: string;
  category: ExpenseCategoryKey;
  categoryLabel: string;
  limitMinor: number;
  spentMinor: number;
  remainingMinor: number; // can be negative when exceeded
  percentUsed: number; // true percentage (can exceed 100)
  barPercent: number; // visually capped at 100
  status: BudgetStatus;
  statusLabel: string;
}

/**
 * Rule 5:
 * Percent used = spent / limit.
 * Below warn_pct is normal, from warn_pct up to under 100% is approaching,
 * exactly 100% is "Limit reached", and over 100% is exceeded.
 * The progress bar caps visually at 100% while the text shows the true percentage.
 */
export function evaluateBudgetStatus(
  spentMinor: number,
  limitMinor: number,
  warnPct = 80
): {
  percentUsed: number;
  barPercent: number;
  status: BudgetStatus;
  statusLabel: string;
} {
  if (limitMinor <= 0) {
    return {
      percentUsed: 0,
      barPercent: 0,
      status: 'normal',
      statusLabel: 'On track',
    };
  }

  const percentUsed = (spentMinor / limitMinor) * 100;
  const barPercent = Math.min(Math.max(percentUsed, 0), 100);

  if (spentMinor > limitMinor) {
    return {
      percentUsed,
      barPercent: 100,
      status: 'exceeded',
      statusLabel: 'Exceeded',
    };
  }

  if (spentMinor === limitMinor) {
    return {
      percentUsed: 100,
      barPercent: 100,
      status: 'reached',
      statusLabel: 'Limit reached',
    };
  }

  // Exact integer comparison for >= warnPct threshold while strictly under 100%
  if (spentMinor * 100 >= limitMinor * warnPct) {
    return {
      percentUsed,
      barPercent,
      status: 'approaching',
      statusLabel: 'Approaching limit',
    };
  }

  return {
    percentUsed,
    barPercent,
    status: 'normal',
    statusLabel: 'On track',
  };
}

/**
 * Evaluates all category budgets for a specific calendar month (YYYY-MM).
 */
export function evaluateMonthlyBudgets(
  budgets: ReadonlyArray<BudgetRecord>,
  transactions: ReadonlyArray<Pick<TransactionRecord, 'type' | 'category' | 'amount_minor' | 'txn_date'>>,
  yearMonth: string,
  warnPct = 80
): EvaluatedBudget[] {
  const spentByCategory = new Map<ExpenseCategoryKey, number>();

  for (const txn of transactions) {
    if (txn.type !== 'expense') continue;
    if (!txn.txn_date.startsWith(yearMonth)) continue;
    const cat = txn.category as ExpenseCategoryKey;
    spentByCategory.set(cat, (spentByCategory.get(cat) ?? 0) + txn.amount_minor);
  }

  return budgets
    .map((b) => {
      const spentMinor = spentByCategory.get(b.category) ?? 0;
      const remainingMinor = b.limit_minor - spentMinor;
      const evalResult = evaluateBudgetStatus(spentMinor, b.limit_minor, warnPct);

      return {
        id: b.id,
        category: b.category,
        categoryLabel: getCategoryLabel(b.category),
        limitMinor: b.limit_minor,
        spentMinor,
        remainingMinor,
        ...evalResult,
      };
    })
    .sort((a, b) => {
      if (b.percentUsed !== a.percentUsed) {
        return b.percentUsed - a.percentUsed;
      }
      return a.categoryLabel.localeCompare(b.categoryLabel);
    });
}

export interface RemainingMonthlyBudgetResult {
  hasBudget: boolean;
  mode: 'overall_cap' | 'category_sum' | 'none';
  totalLimitMinor: number;
  totalSpentMinor: number;
  remainingMinor: number;
  percentUsed: number;
}

/**
 * Rule 5:
 * "Remaining monthly budget" = the overall cap minus total expenses if a cap is set,
 * otherwise the sum of limits minus spending in budgeted categories only.
 */
export function computeRemainingMonthlyBudget(
  budgets: ReadonlyArray<BudgetRecord>,
  transactions: ReadonlyArray<Pick<TransactionRecord, 'type' | 'category' | 'amount_minor' | 'txn_date'>>,
  yearMonth: string,
  overallMonthlyBudgetMinor?: number | null
): RemainingMonthlyBudgetResult {
  const monthExpenses = transactions.filter(
    (t) => t.type === 'expense' && t.txn_date.startsWith(yearMonth)
  );

  if (overallMonthlyBudgetMinor != null && overallMonthlyBudgetMinor > 0) {
    const totalSpentMinor = monthExpenses.reduce((acc, t) => acc + t.amount_minor, 0);
    const remainingMinor = overallMonthlyBudgetMinor - totalSpentMinor;
    return {
      hasBudget: true,
      mode: 'overall_cap',
      totalLimitMinor: overallMonthlyBudgetMinor,
      totalSpentMinor,
      remainingMinor,
      percentUsed: (totalSpentMinor / overallMonthlyBudgetMinor) * 100,
    };
  }

  if (budgets.length === 0) {
    return {
      hasBudget: false,
      mode: 'none',
      totalLimitMinor: 0,
      totalSpentMinor: 0,
      remainingMinor: 0,
      percentUsed: 0,
    };
  }

  const budgetedCategories = new Set<string>(budgets.map((b) => b.category));
  const totalLimitMinor = budgets.reduce((acc, b) => acc + b.limit_minor, 0);
  const totalSpentMinor = monthExpenses
    .filter((t) => budgetedCategories.has(t.category))
    .reduce((acc, t) => acc + t.amount_minor, 0);
  const remainingMinor = totalLimitMinor - totalSpentMinor;

  return {
    hasBudget: true,
    mode: 'category_sum',
    totalLimitMinor,
    totalSpentMinor,
    remainingMinor,
    percentUsed: totalLimitMinor > 0 ? (totalSpentMinor / totalLimitMinor) * 100 : 0,
  };
}
