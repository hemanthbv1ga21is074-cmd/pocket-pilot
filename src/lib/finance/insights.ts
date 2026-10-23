import { getDaysInMonth, parseISODate } from './dates';
import type {
  ExpenseCategoryKey,
  PaymentMethodKey,
  RecurringPaymentRecord,
  TransactionRecord,
} from './types';

// ---------------------------------------------------------------------------
// 1. MULTI-ACCOUNT / WALLET PAYMENT MODES
// ---------------------------------------------------------------------------

export interface PaymentMethodMeta {
  key: PaymentMethodKey;
  label: string;
  shortLabel: string;
}

export const PAYMENT_METHODS: readonly PaymentMethodMeta[] = [
  { key: 'upi', label: 'UPI / Digital Wallet', shortLabel: 'UPI' },
  { key: 'bank', label: 'Bank Account (NEFT/IMPS)', shortLabel: 'Bank' },
  { key: 'credit_card', label: 'Credit Card', shortLabel: 'Card' },
  { key: 'cash', label: 'Cash', shortLabel: 'Cash' },
] as const;

export function getPaymentMethodLabel(method?: string | null): string {
  const found = PAYMENT_METHODS.find((m) => m.key === method);
  return found ? found.label : 'UPI / Digital Wallet';
}

export function getPaymentMethodShortLabel(method?: string | null): string {
  const found = PAYMENT_METHODS.find((m) => m.key === method);
  return found ? found.shortLabel : 'UPI';
}

export interface WalletBreakdownItem {
  method: PaymentMethodKey;
  label: string;
  shortLabel: string;
  incomeMinor: number;
  expenseMinor: number;
  netFlowMinor: number;
  txnCount: number;
  expenseSharePct: number;
}

export function computeWalletSummary(
  transactions: TransactionRecord[]
): WalletBreakdownItem[] {
  const totalExpenseMinor = transactions.reduce(
    (acc, t) => (t.type === 'expense' ? acc + t.amount_minor : acc),
    0
  );

  return PAYMENT_METHODS.map((meta) => {
    let incomeMinor = 0;
    let expenseMinor = 0;
    let txnCount = 0;

    for (const t of transactions) {
      const m: PaymentMethodKey =
        t.payment_method &&
        PAYMENT_METHODS.some((pm) => pm.key === t.payment_method)
          ? t.payment_method
          : t.type === 'income'
            ? 'bank'
            : 'upi';

      if (m === meta.key) {
        txnCount += 1;
        if (t.type === 'income') {
          incomeMinor += t.amount_minor;
        } else {
          expenseMinor += t.amount_minor;
        }
      }
    }

    const expenseSharePct =
      totalExpenseMinor > 0
        ? Number(((expenseMinor / totalExpenseMinor) * 100).toFixed(1))
        : 0;

    return {
      method: meta.key,
      label: meta.label,
      shortLabel: meta.shortLabel,
      incomeMinor,
      expenseMinor,
      netFlowMinor: incomeMinor - expenseMinor,
      txnCount,
      expenseSharePct,
    };
  });
}

// ---------------------------------------------------------------------------
// 2. SPLIT TRANSACTIONS & REIMBURSEMENTS ("FRIENDS OWE YOU")
// ---------------------------------------------------------------------------

export interface SplitReimbursementSummary {
  pendingReimbursementsMinor: number;
  pendingCount: number;
  settledReimbursementsMinor: number;
  settledCount: number;
  pendingTransactions: TransactionRecord[];
  settledTransactions: TransactionRecord[];
}

export function getPersonalShareMinor(txn: TransactionRecord): number {
  if (!txn.is_split || !txn.reimbursable_minor || txn.reimbursable_minor <= 0) {
    return txn.amount_minor;
  }
  return Math.max(0, txn.amount_minor - txn.reimbursable_minor);
}

export function computeSplitReimbursementSummary(
  transactions: TransactionRecord[]
): SplitReimbursementSummary {
  let pendingReimbursementsMinor = 0;
  let pendingCount = 0;
  let settledReimbursementsMinor = 0;
  let settledCount = 0;
  const pendingTransactions: TransactionRecord[] = [];
  const settledTransactions: TransactionRecord[] = [];

  for (const t of transactions) {
    const owed = Number(t.reimbursable_minor ?? 0);
    if (t.type === 'expense' && t.is_split && owed > 0) {
      if (t.is_reimbursed) {
        settledReimbursementsMinor += owed;
        settledCount += 1;
        settledTransactions.push(t);
      } else {
        pendingReimbursementsMinor += owed;
        pendingCount += 1;
        pendingTransactions.push(t);
      }
    }
  }

  return {
    pendingReimbursementsMinor,
    pendingCount,
    settledReimbursementsMinor,
    settledCount,
    pendingTransactions,
    settledTransactions,
  };
}

// ---------------------------------------------------------------------------
// 3. (#9) 50 / 30 / 20 NEEDS-WANTS-SAVINGS RULE ANALYZER
// ---------------------------------------------------------------------------

export const NEEDS_CATEGORIES: readonly ExpenseCategoryKey[] = [
  'housing_rent',
  'bills_utilities',
  'food_dining',
  'healthcare',
  'transport',
  'education',
] as const;

export const WANTS_CATEGORIES: readonly ExpenseCategoryKey[] = [
  'shopping',
  'entertainment',
  'subscriptions',
  'other_expense',
] as const;

export interface FiftyThirtyTwentyResult {
  incomeMinor: number;
  totalExpenseMinor: number;
  needsMinor: number;
  wantsMinor: number;
  savingsMinor: number;
  needsPctOfIncome: number;
  wantsPctOfIncome: number;
  savingsPctOfIncome: number;
  needsPctOfExpense: number;
  wantsPctOfExpense: number;
  targetNeedsMinor: number;
  targetWantsMinor: number;
  targetSavingsMinor: number;
  needsStatus: 'on_track' | 'over_target';
  wantsStatus: 'on_track' | 'over_target';
  savingsStatus: 'on_track' | 'below_target';
  hasIncome: boolean;
}

export function computeFiftyThirtyTwenty(
  transactions: TransactionRecord[]
): FiftyThirtyTwentyResult {
  let incomeMinor = 0;
  let needsMinor = 0;
  let wantsMinor = 0;

  const needsSet = new Set<string>(NEEDS_CATEGORIES);

  for (const t of transactions) {
    if (t.type === 'income') {
      incomeMinor += t.amount_minor;
    } else {
      if (needsSet.has(t.category)) {
        needsMinor += t.amount_minor;
      } else {
        wantsMinor += t.amount_minor;
      }
    }
  }

  const totalExpenseMinor = needsMinor + wantsMinor;
  const savingsMinor = Math.max(0, incomeMinor - totalExpenseMinor);
  const hasIncome = incomeMinor > 0;

  const needsPctOfIncome = hasIncome
    ? Number(((needsMinor / incomeMinor) * 100).toFixed(1))
    : 0;
  const wantsPctOfIncome = hasIncome
    ? Number(((wantsMinor / incomeMinor) * 100).toFixed(1))
    : 0;
  const savingsPctOfIncome = hasIncome
    ? Number(((savingsMinor / incomeMinor) * 100).toFixed(1))
    : 0;

  const needsPctOfExpense =
    totalExpenseMinor > 0
      ? Number(((needsMinor / totalExpenseMinor) * 100).toFixed(1))
      : 0;
  const wantsPctOfExpense =
    totalExpenseMinor > 0
      ? Number(((wantsMinor / totalExpenseMinor) * 100).toFixed(1))
      : 0;

  const targetNeedsMinor = Math.round(incomeMinor * 0.5);
  const targetWantsMinor = Math.round(incomeMinor * 0.3);
  const targetSavingsMinor = Math.round(incomeMinor * 0.2);

  return {
    incomeMinor,
    totalExpenseMinor,
    needsMinor,
    wantsMinor,
    savingsMinor,
    needsPctOfIncome,
    wantsPctOfIncome,
    savingsPctOfIncome,
    needsPctOfExpense,
    wantsPctOfExpense,
    targetNeedsMinor,
    targetWantsMinor,
    targetSavingsMinor,
    needsStatus: needsPctOfIncome <= 50 ? 'on_track' : 'over_target',
    wantsStatus: wantsPctOfIncome <= 30 ? 'on_track' : 'over_target',
    savingsStatus: savingsPctOfIncome >= 20 ? 'on_track' : 'below_target',
    hasIncome,
  };
}

// ---------------------------------------------------------------------------
// 4. (#10) DAILY BURN RATE & END-OF-MONTH SPEND FORECAST
// ---------------------------------------------------------------------------

export interface BurnRateForecastResult {
  yearMonth: string;
  daysElapsed: number;
  daysInMonth: number;
  daysRemaining: number;
  spentSoFarMinor: number;
  dailyBurnRateMinor: number;
  projectedMonthEndMinor: number;
  monthlyBudgetLimitMinor: number | null;
  projectedDeltaMinor: number | null;
  safeDailyAllowanceMinor: number | null;
  exhaustionDay: number | null;
  willExceedBudget: boolean;
  status: 'safe' | 'caution' | 'over_pace' | 'no_budget';
}

export function computeBurnRateForecast(
  transactions: TransactionRecord[],
  today: string,
  monthlyBudgetLimitMinor: number | null
): BurnRateForecastResult {
  const { year, month, day } = parseISODate(today);
  const yearMonth = today.slice(0, 7);
  const totalDays = getDaysInMonth(year, month);
  const daysElapsed = Math.min(Math.max(day, 1), totalDays);
  const daysRemaining = Math.max(0, totalDays - daysElapsed);

  let spentSoFarMinor = 0;
  for (const t of transactions) {
    if (
      t.type === 'expense' &&
      t.txn_date.startsWith(yearMonth) &&
      t.txn_date <= today
    ) {
      spentSoFarMinor += t.amount_minor;
    }
  }

  const dailyBurnRateMinor = Math.round(spentSoFarMinor / daysElapsed);
  const projectedMonthEndMinor = Math.round(
    (spentSoFarMinor / daysElapsed) * totalDays
  );

  if (!monthlyBudgetLimitMinor || monthlyBudgetLimitMinor <= 0) {
    return {
      yearMonth,
      daysElapsed,
      daysInMonth: totalDays,
      daysRemaining,
      spentSoFarMinor,
      dailyBurnRateMinor,
      projectedMonthEndMinor,
      monthlyBudgetLimitMinor: null,
      projectedDeltaMinor: null,
      safeDailyAllowanceMinor: null,
      exhaustionDay: null,
      willExceedBudget: false,
      status: 'no_budget',
    };
  }

  const projectedDeltaMinor = monthlyBudgetLimitMinor - projectedMonthEndMinor;
  const safeDailyAllowanceMinor =
    daysRemaining > 0
      ? Math.max(
          0,
          Math.floor((monthlyBudgetLimitMinor - spentSoFarMinor) / daysRemaining)
        )
      : 0;
  const exhaustionDay =
    dailyBurnRateMinor > 0
      ? Math.ceil(monthlyBudgetLimitMinor / dailyBurnRateMinor)
      : null;
  const willExceedBudget = projectedMonthEndMinor > monthlyBudgetLimitMinor;

  let status: BurnRateForecastResult['status'] = 'safe';
  if (willExceedBudget) {
    status = 'over_pace';
  } else if (projectedMonthEndMinor >= monthlyBudgetLimitMinor * 0.9) {
    status = 'caution';
  }

  return {
    yearMonth,
    daysElapsed,
    daysInMonth: totalDays,
    daysRemaining,
    spentSoFarMinor,
    dailyBurnRateMinor,
    projectedMonthEndMinor,
    monthlyBudgetLimitMinor,
    projectedDeltaMinor,
    safeDailyAllowanceMinor,
    exhaustionDay,
    willExceedBudget,
    status,
  };
}

// ---------------------------------------------------------------------------
// 5. (#11) CASHFLOW CALENDAR HEATMAP & "NO-SPEND DAY" STREAK
// ---------------------------------------------------------------------------

export interface CalendarDayCell {
  date: string;
  dayOfMonth: number;
  weekdayIndex: number; // 0 = Mon .. 6 = Sun
  incomeMinor: number;
  expenseMinor: number;
  txnCount: number;
  isFuture: boolean;
  isToday: boolean;
  intensity: 0 | 1 | 2 | 3;
}

export interface MonthlyCalendarHeatmapResult {
  yearMonth: string;
  leadingEmptyCells: number;
  days: CalendarDayCell[];
  elapsedDaysCount: number;
  noSpendDaysCount: number;
  currentNoSpendStreak: number;
  longestNoSpendStreak: number;
  highestSpendDay: { date: string; expenseMinor: number } | null;
}

export function computeMonthlyCalendarHeatmap(
  transactions: TransactionRecord[],
  yearMonth: string,
  today: string
): MonthlyCalendarHeatmapResult {
  const [yStr, mStr] = yearMonth.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const totalDays = getDaysInMonth(year, month);

  const byDate = new Map<
    string,
    { incomeMinor: number; expenseMinor: number; txnCount: number }
  >();

  for (const t of transactions) {
    if (!t.txn_date.startsWith(yearMonth)) continue;
    const entry = byDate.get(t.txn_date) ?? {
      incomeMinor: 0,
      expenseMinor: 0,
      txnCount: 0,
    };
    entry.txnCount += 1;
    if (t.type === 'income') {
      entry.incomeMinor += t.amount_minor;
    } else {
      entry.expenseMinor += t.amount_minor;
    }
    byDate.set(t.txn_date, entry);
  }

  // Compute average active-day spend for intensity scaling
  let activeSpendSum = 0;
  let activeSpendDays = 0;
  for (const v of byDate.values()) {
    if (v.expenseMinor > 0) {
      activeSpendSum += v.expenseMinor;
      activeSpendDays += 1;
    }
  }
  const avgActiveSpendMinor =
    activeSpendDays > 0 ? activeSpendSum / activeSpendDays : 0;

  // Weekday of the 1st of the month (0 = Monday .. 6 = Sunday)
  const firstDateObj = new Date(Date.UTC(year, month - 1, 1));
  const leadingEmptyCells = (firstDateObj.getUTCDay() + 6) % 7;

  const days: CalendarDayCell[] = [];
  let elapsedDaysCount = 0;
  let noSpendDaysCount = 0;
  let currentNoSpendStreak = 0;
  let longestNoSpendStreak = 0;
  let runningStreak = 0;
  let highestSpendDay: { date: string; expenseMinor: number } | null = null;

  for (let d = 1; d <= totalDays; d++) {
    const dd = String(d).padStart(2, '0');
    const dateStr = `${yearMonth}-${dd}`;
    const dateObj = new Date(Date.UTC(year, month - 1, d));
    const weekdayIndex = (dateObj.getUTCDay() + 6) % 7;
    const entry = byDate.get(dateStr) ?? {
      incomeMinor: 0,
      expenseMinor: 0,
      txnCount: 0,
    };

    const isFuture = dateStr > today;
    const isToday = dateStr === today;

    let intensity: 0 | 1 | 2 | 3 = 0;
    if (entry.expenseMinor > 0) {
      if (avgActiveSpendMinor <= 0 || entry.expenseMinor <= avgActiveSpendMinor * 0.5) {
        intensity = 1;
      } else if (entry.expenseMinor <= avgActiveSpendMinor * 1.25) {
        intensity = 2;
      } else {
        intensity = 3;
      }
    }

    if (!isFuture) {
      elapsedDaysCount += 1;
      if (entry.expenseMinor === 0) {
        noSpendDaysCount += 1;
        runningStreak += 1;
        if (runningStreak > longestNoSpendStreak) {
          longestNoSpendStreak = runningStreak;
        }
      } else {
        runningStreak = 0;
        if (
          !highestSpendDay ||
          entry.expenseMinor > highestSpendDay.expenseMinor
        ) {
          highestSpendDay = { date: dateStr, expenseMinor: entry.expenseMinor };
        }
      }
    }

    days.push({
      date: dateStr,
      dayOfMonth: d,
      weekdayIndex,
      incomeMinor: entry.incomeMinor,
      expenseMinor: entry.expenseMinor,
      txnCount: entry.txnCount,
      isFuture,
      isToday,
      intensity,
    });
  }

  currentNoSpendStreak = runningStreak;

  return {
    yearMonth,
    leadingEmptyCells,
    days,
    elapsedDaysCount,
    noSpendDaysCount,
    currentNoSpendStreak,
    longestNoSpendStreak,
    highestSpendDay,
  };
}

// ---------------------------------------------------------------------------
// 6. (#12) SUBSCRIPTION AUDIT & ANNUALIZED COST BREAKDOWN
// ---------------------------------------------------------------------------

export interface SubscriptionAuditItem {
  id: string;
  name: string;
  category: ExpenseCategoryKey;
  frequency: RecurringPaymentRecord['frequency'];
  scheduledAmountMinor: number;
  monthlyEquivalentMinor: number;
  annualEquivalentMinor: number;
  isSubscriptionCategory: boolean;
}

export interface SubscriptionAuditResult {
  activeRecurringCount: number;
  monthlyTotalMinor: number;
  annualTotalMinor: number;
  subscriptionsCount: number;
  subscriptionsMonthlyMinor: number;
  subscriptionsAnnualMinor: number;
  fixedBillsMonthlyMinor: number;
  fixedBillsAnnualMinor: number;
  items: SubscriptionAuditItem[];
}

export function computeSubscriptionAudit(
  payments: RecurringPaymentRecord[]
): SubscriptionAuditResult {
  const items: SubscriptionAuditItem[] = [];

  for (const p of payments) {
    if (p.frequency === 'once') continue;

    let monthlyEquivalentMinor = p.amount_minor;
    let annualEquivalentMinor = p.amount_minor * 12;

    if (p.frequency === 'weekly') {
      annualEquivalentMinor = p.amount_minor * 52;
      monthlyEquivalentMinor = Math.round(annualEquivalentMinor / 12);
    } else if (p.frequency === 'monthly') {
      monthlyEquivalentMinor = p.amount_minor;
      annualEquivalentMinor = p.amount_minor * 12;
    } else if (p.frequency === 'quarterly') {
      annualEquivalentMinor = p.amount_minor * 4;
      monthlyEquivalentMinor = Math.round(annualEquivalentMinor / 12);
    } else if (p.frequency === 'yearly') {
      annualEquivalentMinor = p.amount_minor;
      monthlyEquivalentMinor = Math.round(annualEquivalentMinor / 12);
    }

    items.push({
      id: p.id,
      name: p.name,
      category: p.category,
      frequency: p.frequency,
      scheduledAmountMinor: p.amount_minor,
      monthlyEquivalentMinor,
      annualEquivalentMinor,
      isSubscriptionCategory: p.category === 'subscriptions',
    });
  }

  items.sort((a, b) => {
    if (b.annualEquivalentMinor !== a.annualEquivalentMinor) {
      return b.annualEquivalentMinor - a.annualEquivalentMinor;
    }
    return a.name.localeCompare(b.name);
  });

  let monthlyTotalMinor = 0;
  let annualTotalMinor = 0;
  let subscriptionsCount = 0;
  let subscriptionsMonthlyMinor = 0;
  let subscriptionsAnnualMinor = 0;

  for (const item of items) {
    monthlyTotalMinor += item.monthlyEquivalentMinor;
    annualTotalMinor += item.annualEquivalentMinor;
    if (item.isSubscriptionCategory) {
      subscriptionsCount += 1;
      subscriptionsMonthlyMinor += item.monthlyEquivalentMinor;
      subscriptionsAnnualMinor += item.annualEquivalentMinor;
    }
  }

  return {
    activeRecurringCount: items.length,
    monthlyTotalMinor,
    annualTotalMinor,
    subscriptionsCount,
    subscriptionsMonthlyMinor,
    subscriptionsAnnualMinor,
    fixedBillsMonthlyMinor: monthlyTotalMinor - subscriptionsMonthlyMinor,
    fixedBillsAnnualMinor: annualTotalMinor - subscriptionsAnnualMinor,
    items,
  };
}

// ---------------------------------------------------------------------------
// 7. (#13) EMERGENCY FUND RUNWAY ("MONTHS OF SURVIVAL" METER)
// ---------------------------------------------------------------------------

export interface EmergencyRunwayResult {
  avgMonthlyEssentialMinor: number;
  totalLiquidReserveMinor: number;
  availableToSpendMinor: number;
  setAsideMinor: number;
  runwayMonths: number | null;
  runwayDays: number | null;
  threeMonthTargetMinor: number;
  sixMonthTargetMinor: number;
  progressToSixMonthsPct: number;
  activeMonthsAnalyzed: number;
  status: 'strong' | 'moderate' | 'building' | 'no_expenses';
}

export function computeEmergencyRunway(
  allTransactions: TransactionRecord[],
  availableToSpendMinor: number,
  setAsideMinor: number
): EmergencyRunwayResult {
  const needsSet = new Set<string>(NEEDS_CATEGORIES);
  const expenseMonths = new Set<string>();
  let totalEssentialMinor = 0;

  for (const t of allTransactions) {
    if (t.type === 'expense') {
      expenseMonths.add(t.txn_date.slice(0, 7));
      if (needsSet.has(t.category)) {
        totalEssentialMinor += t.amount_minor;
      }
    }
  }

  const activeMonthsAnalyzed = Math.max(1, expenseMonths.size);
  const avgMonthlyEssentialMinor =
    expenseMonths.size > 0
      ? Math.round(totalEssentialMinor / activeMonthsAnalyzed)
      : 0;

  const totalLiquidReserveMinor = Math.max(
    0,
    availableToSpendMinor + setAsideMinor
  );

  if (avgMonthlyEssentialMinor <= 0) {
    return {
      avgMonthlyEssentialMinor: 0,
      totalLiquidReserveMinor,
      availableToSpendMinor,
      setAsideMinor,
      runwayMonths: null,
      runwayDays: null,
      threeMonthTargetMinor: 0,
      sixMonthTargetMinor: 0,
      progressToSixMonthsPct: 0,
      activeMonthsAnalyzed: 0,
      status: 'no_expenses',
    };
  }

  const rawMonths = totalLiquidReserveMinor / avgMonthlyEssentialMinor;
  const runwayMonths = Number(rawMonths.toFixed(1));
  const runwayDays = Math.round(rawMonths * 30);
  const threeMonthTargetMinor = avgMonthlyEssentialMinor * 3;
  const sixMonthTargetMinor = avgMonthlyEssentialMinor * 6;
  const progressToSixMonthsPct = Math.min(
    100,
    Number(((totalLiquidReserveMinor / sixMonthTargetMinor) * 100).toFixed(1))
  );

  let status: EmergencyRunwayResult['status'] = 'building';
  if (runwayMonths >= 6) {
    status = 'strong';
  } else if (runwayMonths >= 3) {
    status = 'moderate';
  }

  return {
    avgMonthlyEssentialMinor,
    totalLiquidReserveMinor,
    availableToSpendMinor,
    setAsideMinor,
    runwayMonths,
    runwayDays,
    threeMonthTargetMinor,
    sixMonthTargetMinor,
    progressToSixMonthsPct,
    activeMonthsAnalyzed,
    status,
  };
}
