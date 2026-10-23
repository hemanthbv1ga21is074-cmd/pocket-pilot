'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Download,
  Table2,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Flame,
  ShieldCheck,
  CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Progress,
  Skeleton,
  EmptyState,
} from '@/components/ui';
import {
  formatMoney,
  formatDisplayDate,
  getTodayInTimezone,
  resolvePeriodRange,
  computePeriodSummary,
  computePeriodComparison,
  computeCategoryBreakdown,
  computeRemainingMonthlyBudget,
  computeFiftyThirtyTwenty,
  computeBurnRateForecast,
  computeMonthlyCalendarHeatmap,
  computeEmergencyRunway,
  evaluateMonthlyBudgets,
  buildOverviewChartData,
  transactionsToCsv,
  getCategoryLabel,
} from '@/lib/finance';
import { usePeriodParams } from '@/components/layout/period-selector';
import {
  useProfile,
  useBalanceSummary,
  useTransactionsRange,
  useBudgets,
} from '@/features/shared/use-finance-data';
import { CategoryIcon } from '@/features/shared/category-icon';

const CashflowBarChart = dynamic(
  () => import('@/features/overview/overview-charts').then((m) => m.CashflowBarChart),
  { ssr: false, loading: () => <Skeleton className="h-[280px] w-full" /> }
);

const MonthlySavingsRateChart = dynamic(
  () =>
    import('@/features/analytics/analytics-charts').then(
      (m) => m.MonthlySavingsRateChart
    ),
  { ssr: false, loading: () => <Skeleton className="h-[260px] w-full" /> }
);

const BudgetPerformanceChart = dynamic(
  () =>
    import('@/features/analytics/analytics-charts').then(
      (m) => m.BudgetPerformanceChart
    ),
  { ssr: false, loading: () => <Skeleton className="h-[260px] w-full" /> }
);

export default function AnalyticsPage() {
  const { period, customFrom, customTo } = usePeriodParams();
  const { data: profile } = useProfile();
  const timezone = profile?.timezone || 'Asia/Kolkata';
  const currency = profile?.currency || 'INR';
  const warnPct = profile?.warn_pct ?? 80;
  const today = getTodayInTimezone(new Date(), timezone);

  const resolvedPeriod = resolvePeriodRange(period, today, customFrom, customTo);

  const allTxnsQuery = useTransactionsRange();
  const budgetsQuery = useBudgets();
  const balanceQuery = useBalanceSummary();

  const [showTrendTable, setShowTrendTable] = React.useState(false);
  const [showSavingsTable, setShowSavingsTable] = React.useState(false);
  const [showBudgetTable, setShowBudgetTable] = React.useState(false);

  const allTransactions = allTxnsQuery.data ?? [];
  const budgets = budgetsQuery.data ?? [];
  const balance = balanceQuery.data ?? {
    startingBalanceMinor: 0,
    totalIncomeMinor: 0,
    totalExpenseMinor: 0,
    totalBalanceMinor: 0,
    setAsideMinor: 0,
    availableToSpendMinor: 0,
  };

  const periodTransactions = React.useMemo(
    () =>
      allTransactions.filter(
        (t) => t.txn_date >= resolvedPeriod.start && t.txn_date <= resolvedPeriod.end
      ),
    [allTransactions, resolvedPeriod.start, resolvedPeriod.end]
  );

  const prevTransactions = React.useMemo(
    () =>
      allTransactions.filter(
        (t) =>
          t.txn_date >= resolvedPeriod.prevStart && t.txn_date <= resolvedPeriod.prevEnd
      ),
    [allTransactions, resolvedPeriod.prevStart, resolvedPeriod.prevEnd]
  );

  const currentSummary = React.useMemo(
    () => computePeriodSummary(periodTransactions),
    [periodTransactions]
  );
  const prevSummary = React.useMemo(
    () => computePeriodSummary(prevTransactions),
    [prevTransactions]
  );

  const incomeComparison = React.useMemo(
    () =>
      computePeriodComparison(
        currentSummary.incomeMinor,
        prevSummary.incomeMinor,
        prevTransactions.filter((t) => t.type === 'income').length
      ),
    [currentSummary.incomeMinor, prevSummary.incomeMinor, prevTransactions]
  );

  const expenseComparison = React.useMemo(
    () =>
      computePeriodComparison(
        currentSummary.expenseMinor,
        prevSummary.expenseMinor,
        prevTransactions.filter((t) => t.type === 'expense').length
      ),
    [currentSummary.expenseMinor, prevSummary.expenseMinor, prevTransactions]
  );

  const monthlyTrend = React.useMemo(
    () => buildOverviewChartData(allTransactions, 'monthly', today),
    [allTransactions, today]
  );

  const categoryBreakdown = React.useMemo(
    () => computeCategoryBreakdown(periodTransactions),
    [periodTransactions]
  );

  const budgetPerformance = React.useMemo(
    () =>
      evaluateMonthlyBudgets(
        budgets,
        allTransactions,
        resolvedPeriod.budgetYearMonth,
        warnPct
      ),
    [budgets, allTransactions, resolvedPeriod.budgetYearMonth, warnPct]
  );

  const remainingMonthlyBudget = React.useMemo(
    () =>
      computeRemainingMonthlyBudget(
        budgets,
        allTransactions,
        today.slice(0, 7),
        profile?.overall_monthly_budget_minor
      ),
    [budgets, allTransactions, today, profile?.overall_monthly_budget_minor]
  );

  const fiftyThirtyTwenty = React.useMemo(
    () => computeFiftyThirtyTwenty(periodTransactions),
    [periodTransactions]
  );

  const burnRateForecast = React.useMemo(
    () =>
      computeBurnRateForecast(
        allTransactions,
        today,
        remainingMonthlyBudget.hasBudget ? remainingMonthlyBudget.totalLimitMinor : null
      ),
    [allTransactions, today, remainingMonthlyBudget]
  );

  const calendarHeatmap = React.useMemo(
    () =>
      computeMonthlyCalendarHeatmap(
        allTransactions,
        resolvedPeriod.budgetYearMonth,
        today
      ),
    [allTransactions, resolvedPeriod.budgetYearMonth, today]
  );

  const emergencyRunway = React.useMemo(
    () =>
      computeEmergencyRunway(
        allTransactions,
        balance.availableToSpendMinor,
        balance.setAsideMinor
      ),
    [allTransactions, balance.availableToSpendMinor, balance.setAsideMinor]
  );

  const handleExportCsv = () => {
    const csvContent = transactionsToCsv(periodTransactions);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pocketpilot-analytics-${resolvedPeriod.start}-to-${resolvedPeriod.end}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${periodTransactions.length} transactions to CSV`);
  };

  const isLoading = allTxnsQuery.isLoading || budgetsQuery.isLoading;
  const isError = allTxnsQuery.isError || budgetsQuery.isError;

  if (isError) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-6 w-6 text-expense" />}
        title="Could not load analytics"
        description="Please retry loading your financial report."
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              allTxnsQuery.refetch();
              budgetsQuery.refetch();
            }}
          >
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Export CSV */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-primary">
            Financial Analytics — {resolvedPeriod.label}
          </h2>
          <p className="text-sm text-muted">
            Window: {formatDisplayDate(resolvedPeriod.start)} to{' '}
            {formatDisplayDate(resolvedPeriod.end)} (compared against{' '}
            {formatDisplayDate(resolvedPeriod.prevStart)} to{' '}
            {formatDisplayDate(resolvedPeriod.prevEnd)})
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Download className="h-4 w-4" />}
          onClick={handleExportCsv}
        >
          Export CSV ({periodTransactions.length})
        </Button>
      </div>

      {/* Period Comparison Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription>Period Income</CardDescription>
                <TrendingUp className="h-4 w-4 text-income" aria-hidden="true" />
              </div>
              <CardTitle className="text-2xl font-bold tabular-nums text-income">
                {formatMoney(currentSummary.incomeMinor, { currency })}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted">
              {incomeComparison.label}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription>Period Expenses</CardDescription>
                <TrendingDown className="h-4 w-4 text-expense" aria-hidden="true" />
              </div>
              <CardTitle className="text-2xl font-bold tabular-nums text-expense">
                {formatMoney(currentSummary.expenseMinor, { currency })}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted">
              {expenseComparison.label}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Period Net Savings & Rate</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums">
                {formatMoney(currentSummary.netSavingsMinor, { currency })}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between text-xs text-muted">
              <span>Savings rate:</span>
              <Badge
                variant={
                  currentSummary.netSavingsMinor >= 0 ? 'income' : 'expense'
                }
              >
                {currentSummary.savingsRateFormatted}
              </Badge>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Monthly Income & Expense Trend + Monthly Savings Rate */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Monthly Income & Expense Trend</CardTitle>
              <CardDescription>Last 12 calendar months</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              leftIcon={
                showTrendTable ? (
                  <BarChart3 className="h-4 w-4" />
                ) : (
                  <Table2 className="h-4 w-4" />
                )
              }
              onClick={() => setShowTrendTable((v) => !v)}
            >
              {showTrendTable ? 'Show chart' : 'View as table'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted">
              Summary: 12-month cashflow history ({monthlyTrend.bucketsWithDataCount}{' '}
              months with recorded transactions).
            </p>
            {allTransactions.length === 0 ? (
              <EmptyState
                title="No monthly trend data"
                description="Record transactions to see your 12-month income and expense trajectory."
              />
            ) : showTrendTable ? (
              <div className="overflow-x-auto rounded-control border border-border max-h-72">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-page/60 font-semibold text-muted">
                    <tr>
                      <th className="px-3 py-2">Month</th>
                      <th className="px-3 py-2 text-right">Income</th>
                      <th className="px-3 py-2 text-right">Expenses</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {monthlyTrend.buckets.map((b) => (
                      <tr key={b.key}>
                        <td className="px-3 py-2 font-medium">{b.label}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-income">
                          {formatMoney(b.incomeMinor, { currency })}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-expense">
                          {formatMoney(b.expenseMinor, { currency })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <CashflowBarChart buckets={monthlyTrend.buckets} currency={currency} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Monthly Savings Rate</CardTitle>
              <CardDescription>Net savings as a % of monthly income</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              leftIcon={
                showSavingsTable ? (
                  <BarChart3 className="h-4 w-4" />
                ) : (
                  <Table2 className="h-4 w-4" />
                )
              }
              onClick={() => setShowSavingsTable((v) => !v)}
            >
              {showSavingsTable ? 'Show chart' : 'View as table'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted">
              Summary: Monthly savings rate across the last 12 calendar months.
            </p>
            {allTransactions.length === 0 ? (
              <EmptyState
                title="No savings rate history"
                description="Add income and expense records to track your monthly savings efficiency."
              />
            ) : showSavingsTable ? (
              <div className="overflow-x-auto rounded-control border border-border max-h-72">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-page/60 font-semibold text-muted">
                    <tr>
                      <th className="px-3 py-2">Month</th>
                      <th className="px-3 py-2 text-right">Net Savings</th>
                      <th className="px-3 py-2 text-right">Savings Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {monthlyTrend.buckets.map((b) => (
                      <tr key={b.key}>
                        <td className="px-3 py-2 font-medium">{b.label}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatMoney(b.netSavingsMinor, { currency })}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {b.savingsRatePct === null
                            ? '—'
                            : `${b.savingsRatePct.toFixed(1)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <MonthlySavingsRateChart buckets={monthlyTrend.buckets} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* #9: 50 / 30 / 20 Needs-Wants-Savings Rule Analyzer */}
      <Card data-testid="fifty-thirty-twenty-card">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>50 / 30 / 20 Rule Analyzer ({resolvedPeriod.label})</CardTitle>
              <CardDescription>
                Compares your actual Needs, Wants, and Savings split against the classic 50% / 30% / 20% benchmark
              </CardDescription>
            </div>
            {!fiftyThirtyTwenty.hasIncome && (
              <Badge variant="warning">Record income to benchmark against 50/30/20</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Needs (50%) */}
            <div className="rounded-control border border-border bg-page/50 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-primary">
                  Needs (Target ≤ 50%)
                </span>
                <Badge
                  variant={
                    fiftyThirtyTwenty.needsStatus === 'on_track' ? 'success' : 'warning'
                  }
                >
                  {fiftyThirtyTwenty.hasIncome
                    ? `${fiftyThirtyTwenty.needsPctOfIncome.toFixed(1)}% of income`
                    : `${fiftyThirtyTwenty.needsPctOfExpense.toFixed(1)}% of spend`}
                </Badge>
              </div>
              <p className="text-xl font-bold tabular-nums text-primary">
                {formatMoney(fiftyThirtyTwenty.needsMinor, { currency })}
              </p>
              <Progress
                value={
                  fiftyThirtyTwenty.hasIncome
                    ? Math.min(100, (fiftyThirtyTwenty.needsPctOfIncome / 50) * 100)
                    : fiftyThirtyTwenty.needsPctOfExpense
                }
                tone={
                  fiftyThirtyTwenty.needsStatus === 'on_track' ? 'normal' : 'approaching'
                }
                label="Needs share against 50% benchmark"
              />
              <p className="text-xs text-muted">
                Rent, utilities, groceries, healthcare, transport & education.
                {fiftyThirtyTwenty.hasIncome && (
                  <>
                    {' '}
                    50% target:{' '}
                    <strong className="text-primary tabular-nums">
                      {formatMoney(fiftyThirtyTwenty.targetNeedsMinor, { currency })}
                    </strong>
                  </>
                )}
              </p>
            </div>

            {/* Wants (30%) */}
            <div className="rounded-control border border-border bg-page/50 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-primary">
                  Wants (Target ≤ 30%)
                </span>
                <Badge
                  variant={
                    fiftyThirtyTwenty.wantsStatus === 'on_track' ? 'success' : 'expense'
                  }
                >
                  {fiftyThirtyTwenty.hasIncome
                    ? `${fiftyThirtyTwenty.wantsPctOfIncome.toFixed(1)}% of income`
                    : `${fiftyThirtyTwenty.wantsPctOfExpense.toFixed(1)}% of spend`}
                </Badge>
              </div>
              <p className="text-xl font-bold tabular-nums text-primary">
                {formatMoney(fiftyThirtyTwenty.wantsMinor, { currency })}
              </p>
              <Progress
                value={
                  fiftyThirtyTwenty.hasIncome
                    ? Math.min(100, (fiftyThirtyTwenty.wantsPctOfIncome / 30) * 100)
                    : fiftyThirtyTwenty.wantsPctOfExpense
                }
                tone={
                  fiftyThirtyTwenty.wantsStatus === 'on_track' ? 'normal' : 'exceeded'
                }
                label="Wants share against 30% benchmark"
              />
              <p className="text-xs text-muted">
                Shopping, entertainment, subscriptions & discretionary items.
                {fiftyThirtyTwenty.hasIncome && (
                  <>
                    {' '}
                    30% target:{' '}
                    <strong className="text-primary tabular-nums">
                      {formatMoney(fiftyThirtyTwenty.targetWantsMinor, { currency })}
                    </strong>
                  </>
                )}
              </p>
            </div>

            {/* Savings (20%) */}
            <div className="rounded-control border border-border bg-page/50 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-primary">
                  Savings (Target ≥ 20%)
                </span>
                <Badge
                  variant={
                    fiftyThirtyTwenty.savingsStatus === 'on_track' ? 'income' : 'warning'
                  }
                >
                  {fiftyThirtyTwenty.hasIncome
                    ? `${fiftyThirtyTwenty.savingsPctOfIncome.toFixed(1)}% of income`
                    : '—'}
                </Badge>
              </div>
              <p className="text-xl font-bold tabular-nums text-income">
                {formatMoney(fiftyThirtyTwenty.savingsMinor, { currency })}
              </p>
              <Progress
                value={
                  fiftyThirtyTwenty.hasIncome
                    ? Math.min(100, (fiftyThirtyTwenty.savingsPctOfIncome / 20) * 100)
                    : 0
                }
                tone="normal"
                label="Savings rate against 20% benchmark"
              />
              <p className="text-xs text-muted">
                Net unspent cashflow retained from period income.
                {fiftyThirtyTwenty.hasIncome && (
                  <>
                    {' '}
                    20% target:{' '}
                    <strong className="text-primary tabular-nums">
                      {formatMoney(fiftyThirtyTwenty.targetSavingsMinor, { currency })}
                    </strong>
                  </>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* #10 Daily Burn Rate & EOM Forecast + #13 Emergency Fund Runway */}
      <div
        data-testid="burn-rate-runway-grid"
        className="grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  Daily Burn Rate & End-of-Month Forecast ({burnRateForecast.yearMonth})
                </CardTitle>
                <CardDescription>
                  Day {burnRateForecast.daysElapsed} of {burnRateForecast.daysInMonth} (
                  {burnRateForecast.daysRemaining} days remaining this month)
                </CardDescription>
              </div>
              <Flame className="h-5 w-5 text-expense" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 rounded-control border border-border bg-page/50 p-3.5">
              <div>
                <p className="text-xs text-muted">Current daily burn rate</p>
                <p className="text-lg font-bold tabular-nums text-primary">
                  {formatMoney(burnRateForecast.dailyBurnRateMinor, { currency })}/day
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted">Projected month-end spend</p>
                <p
                  className={`text-lg font-bold tabular-nums ${
                    burnRateForecast.willExceedBudget ? 'text-expense' : 'text-primary'
                  }`}
                >
                  {formatMoney(burnRateForecast.projectedMonthEndMinor, { currency })}
                </p>
              </div>
            </div>

            {burnRateForecast.monthlyBudgetLimitMinor !== null ? (
              <div className="space-y-2 text-xs text-muted">
                <div className="flex items-center justify-between">
                  <span>Monthly budget limit:</span>
                  <span className="font-semibold tabular-nums text-primary">
                    {formatMoney(burnRateForecast.monthlyBudgetLimitMinor, { currency })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Safe daily allowance for remaining {burnRateForecast.daysRemaining}d:</span>
                  <span className="font-semibold tabular-nums text-income">
                    {formatMoney(burnRateForecast.safeDailyAllowanceMinor ?? 0, { currency })}/day
                  </span>
                </div>
                <p className="pt-1 text-primary font-medium">
                  {burnRateForecast.willExceedBudget && burnRateForecast.exhaustionDay
                    ? `Warning: At your current pace, you will exhaust your monthly budget around day ${burnRateForecast.exhaustionDay}.`
                    : `On track: Your current pace projects ${formatMoney(
                        Math.abs(burnRateForecast.projectedDeltaMinor ?? 0),
                        { currency }
                      )} under your monthly budget.`}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted">
                Set a monthly budget on the{' '}
                <Link href="/budgets" className="font-semibold text-[#14533D] underline dark:text-[#45B883]">
                  Budgets page
                </Link>{' '}
                to unlock safe daily allowance and budget exhaustion alerts.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Emergency Fund Runway (Months of Survival)</CardTitle>
                <CardDescription>
                  How long your total balance covers essential living expenses (Needs)
                </CardDescription>
              </div>
              <ShieldCheck className="h-5 w-5 text-income" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 rounded-control border border-border bg-page/50 p-3.5">
              <div>
                <p className="text-xs text-muted">Estimated survival runway</p>
                <p className="text-lg font-bold tabular-nums text-income">
                  {emergencyRunway.runwayMonths !== null
                    ? `${emergencyRunway.runwayMonths} months (~${emergencyRunway.runwayDays} days)`
                    : 'No expenses yet'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted">Avg essential expenses / mo</p>
                <p className="text-lg font-bold tabular-nums text-primary">
                  {formatMoney(emergencyRunway.avgMonthlyEssentialMinor, { currency })}
                </p>
              </div>
            </div>

            {emergencyRunway.runwayMonths !== null && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Progress toward 6-month safety benchmark:</span>
                  <span className="font-semibold tabular-nums text-primary">
                    {emergencyRunway.progressToSixMonthsPct.toFixed(0)}% (Target:{' '}
                    {formatMoney(emergencyRunway.sixMonthTargetMinor, { currency })})
                  </span>
                </div>
                <Progress
                  value={emergencyRunway.progressToSixMonthsPct}
                  tone={
                    emergencyRunway.status === 'strong'
                      ? 'normal'
                      : emergencyRunway.status === 'moderate'
                        ? 'approaching'
                        : 'exceeded'
                  }
                  label="Emergency fund 6-month target progress"
                />
                <p className="text-xs text-muted">
                  3-month starter target:{' '}
                  <strong className="text-primary tabular-nums">
                    {formatMoney(emergencyRunway.threeMonthTargetMinor, { currency })}
                  </strong>{' '}
                  • Total liquid reserve:{' '}
                  <strong className="text-primary tabular-nums">
                    {formatMoney(emergencyRunway.totalLiquidReserveMinor, { currency })}
                  </strong>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* #11: Cashflow Calendar Heatmap & No-Spend Day Streak */}
      <Card data-testid="calendar-heatmap-card">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="inline-flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-[#14533D] dark:text-[#45B883]" />
              Cashflow Calendar Heatmap & No-Spend Streak ({calendarHeatmap.yearMonth})
            </CardTitle>
            <CardDescription>
              Daily spending intensity and no-spend discipline across {calendarHeatmap.yearMonth}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="income">
              No-spend days: {calendarHeatmap.noSpendDaysCount} /{' '}
              {calendarHeatmap.elapsedDaysCount}
            </Badge>
            <Badge variant="success">
              Current streak: {calendarHeatmap.currentNoSpendStreak}d (Best:{' '}
              {calendarHeatmap.longestNoSpendStreak}d)
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-muted">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: calendarHeatmap.leadingEmptyCells }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="min-h-[56px] rounded-control bg-transparent"
              />
            ))}

            {calendarHeatmap.days.map((cell) => {
              let bgClass =
                'border-border bg-card text-primary';
              let statusLabel = 'No spend';

              if (cell.isFuture) {
                bgClass = 'border-border/50 bg-page/40 text-muted opacity-55';
                statusLabel = 'Upcoming';
              } else if (cell.intensity === 0) {
                bgClass =
                  'border-income/30 bg-income/10 text-primary';
                statusLabel = '₹0 spend';
              } else if (cell.intensity === 1) {
                bgClass =
                  'border-[#D9A441]/40 bg-[#D9A441]/10 text-primary';
                statusLabel = 'Low';
              } else if (cell.intensity === 2) {
                bgClass =
                  'border-expense/40 bg-expense/10 text-primary';
                statusLabel = 'Medium';
              } else if (cell.intensity === 3) {
                bgClass =
                  'border-expense bg-expense/20 text-primary font-semibold';
                statusLabel = 'High';
              }

              return (
                <div
                  key={cell.date}
                  title={`${cell.date}: Spent ${formatMoney(cell.expenseMinor, {
                    currency,
                  })} • Income ${formatMoney(cell.incomeMinor, { currency })}`}
                  className={`flex min-h-[60px] flex-col justify-between rounded-control border p-2 text-xs transition-colors ${bgClass} ${
                    cell.isToday ? 'ring-2 ring-[#14533D] dark:ring-[#45B883]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold tabular-nums">{cell.dayOfMonth}</span>
                    {cell.incomeMinor > 0 && (
                      <span className="h-2 w-2 rounded-full bg-income" title="Income received" />
                    )}
                  </div>
                  <div className="mt-1 truncate text-[10px] tabular-nums">
                    {cell.isFuture
                      ? '—'
                      : cell.expenseMinor > 0
                        ? formatMoney(cell.expenseMinor, { currency })
                        : statusLabel}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm border border-income/40 bg-income/15" />
                No-spend day (₹0)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm border border-[#D9A441]/50 bg-[#D9A441]/15" />
                Low spend
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm border border-expense/50 bg-expense/15" />
                Medium spend
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm border border-expense bg-expense/30" />
                High spend
              </span>
            </div>
            {calendarHeatmap.highestSpendDay && (
              <span>
                Peak spend day:{' '}
                <strong className="text-primary">
                  {formatDisplayDate(calendarHeatmap.highestSpendDay.date)}
                </strong>{' '}
                (
                <span className="tabular-nums text-expense font-semibold">
                  {formatMoney(calendarHeatmap.highestSpendDay.expenseMinor, {
                    currency,
                  })}
                </span>
                )
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Spending Categories + Budget Performance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Spending Categories ({resolvedPeriod.label})</CardTitle>
            <CardDescription>
              Ranked by total spending (ties broken alphabetically)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length === 0 ? (
              <EmptyState
                title="No expenses in selected period"
                description="Record an expense or broaden the date filter to view category rankings."
              />
            ) : (
              <div className="space-y-4">
                {categoryBreakdown.map((cat) => (
                  <div key={cat.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-2 font-medium text-primary">
                        <CategoryIcon category={cat.category} className="h-4 w-4 text-muted" />
                        {cat.label}
                        <span className="text-xs text-muted">({cat.count})</span>
                      </span>
                      <span className="font-semibold tabular-nums text-primary">
                        {formatMoney(cat.amountMinor, { currency })} (
                        {cat.percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <Progress
                      value={cat.percentage}
                      tone="normal"
                      label={`${cat.label} share of expenses`}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>
                Budget Performance ({resolvedPeriod.budgetYearMonth})
              </CardTitle>
              <CardDescription>
                Monthly limit vs actual spending per budgeted category
              </CardDescription>
            </div>
            {budgetPerformance.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Table2 className="h-4 w-4" />}
                onClick={() => setShowBudgetTable((v) => !v)}
              >
                {showBudgetTable ? 'Show chart' : 'View as table'}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {budgetPerformance.length === 0 ? (
              <EmptyState
                title="No budgets configured"
                description="Configure category limits on the Budgets page to compare limits against actual monthly spend."
                action={
                  <Link href="/budgets">
                    <Button variant="outline" size="sm">
                      Configure budgets
                    </Button>
                  </Link>
                }
              />
            ) : (
              <>
                <p className="text-xs text-muted">
                  Summary: Comparing {budgetPerformance.length} budgeted categories for{' '}
                  {resolvedPeriod.budgetYearMonth}.
                </p>
                {showBudgetTable ? (
                  <div className="overflow-x-auto rounded-control border border-border">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border bg-page/60 font-semibold text-muted">
                        <tr>
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2 text-right">Limit</th>
                          <th className="px-3 py-2 text-right">Spent</th>
                          <th className="px-3 py-2 text-right">Used</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {budgetPerformance.map((b) => (
                          <tr key={b.id}>
                            <td className="px-3 py-2 font-medium">{b.categoryLabel}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatMoney(b.limitMinor, { currency })}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatMoney(b.spentMinor, { currency })}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {b.percentUsed.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <BudgetPerformanceChart
                    budgets={budgetPerformance}
                    currency={currency}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transaction History Report for Period */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Transaction History Report ({resolvedPeriod.label})</CardTitle>
            <CardDescription>
              Showing {periodTransactions.length} transactions in the selected period
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={handleExportCsv}
          >
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {periodTransactions.length === 0 ? (
            <EmptyState
              title="No transactions in this period"
              description="Adjust the global period selector in the top bar or record a transaction."
            />
          ) : (
            <div className="overflow-x-auto rounded-control border border-border max-h-96">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-border bg-page/60 font-semibold text-muted">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Description</th>
                    <th className="px-4 py-2.5">Category</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {periodTransactions.slice(0, 50).map((txn) => (
                    <tr key={txn.id}>
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted">
                        {formatDisplayDate(txn.txn_date)}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-primary">
                        {txn.description}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                        {getCategoryLabel(txn.category)}
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums ${
                          txn.type === 'income' ? 'text-income' : 'text-expense'
                        }`}
                      >
                        {formatMoney(
                          txn.type === 'income' ? txn.amount_minor : -txn.amount_minor,
                          { currency, showPlusSign: true }
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
