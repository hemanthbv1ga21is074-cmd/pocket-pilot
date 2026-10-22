'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Plus,
  Calculator,
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Table2,
  BarChart3,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
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
  getHighestSpendingCategory,
  computeRemainingMonthlyBudget,
  evaluateGoal,
  buildOverviewChartData,
  getCategoryLabel,
  type OverviewChartMode,
  type TxnType,
} from '@/lib/finance';
import { usePeriodParams } from '@/components/layout/period-selector';
import {
  useProfile,
  useBalanceSummary,
  useTransactionsRange,
  useBudgets,
  useGoals,
} from '@/features/shared/use-finance-data';
import { CategoryIcon } from '@/features/shared/category-icon';
import { TransactionDialog } from '@/features/transactions/transaction-dialog';

const CashflowBarChart = dynamic(
  () => import('@/features/overview/overview-charts').then((m) => m.CashflowBarChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[280px] w-full" />,
  }
);

const CategoryDonutChart = dynamic(
  () => import('@/features/overview/overview-charts').then((m) => m.CategoryDonutChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[260px] w-full" />,
  }
);

export default function OverviewPage() {
  const { period, customFrom, customTo } = usePeriodParams();
  const { data: profile } = useProfile();
  const timezone = profile?.timezone || 'Asia/Kolkata';
  const currency = profile?.currency || 'INR';
  const today = getTodayInTimezone(new Date(), timezone);

  const resolvedPeriod = resolvePeriodRange(period, today, customFrom, customTo);

  const balanceQuery = useBalanceSummary();
  const allTxnsQuery = useTransactionsRange();
  const budgetsQuery = useBudgets();
  const goalsQuery = useGoals();

  const [chartMode, setChartMode] = React.useState<OverviewChartMode>('monthly');
  const [showCashflowTable, setShowCashflowTable] = React.useState(false);
  const [showDonutTable, setShowDonutTable] = React.useState(false);
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);

  const [txnDialogOpen, setTxnDialogOpen] = React.useState(false);
  const [txnDialogType, setTxnDialogType] = React.useState<TxnType>('expense');

  const allTransactions = allTxnsQuery.data ?? [];

  // Filter transactions for the active period and previous comparison period
  const periodTransactions = React.useMemo(
    () =>
      allTransactions.filter(
        (t) => t.txn_date >= resolvedPeriod.start && t.txn_date <= resolvedPeriod.end
      ),
    [allTransactions, resolvedPeriod.start, resolvedPeriod.end]
  );

  const prevPeriodTransactions = React.useMemo(
    () =>
      allTransactions.filter(
        (t) =>
          t.txn_date >= resolvedPeriod.prevStart && t.txn_date <= resolvedPeriod.prevEnd
      ),
    [allTransactions, resolvedPeriod.prevStart, resolvedPeriod.prevEnd]
  );

  const periodSummary = React.useMemo(
    () => computePeriodSummary(periodTransactions),
    [periodTransactions]
  );

  const prevSummary = React.useMemo(
    () => computePeriodSummary(prevPeriodTransactions),
    [prevPeriodTransactions]
  );

  const expenseComparison = React.useMemo(
    () =>
      computePeriodComparison(
        periodSummary.expenseMinor,
        prevSummary.expenseMinor,
        prevPeriodTransactions.filter((t) => t.type === 'expense').length
      ),
    [periodSummary.expenseMinor, prevSummary.expenseMinor, prevPeriodTransactions]
  );

  const categoryBreakdown = React.useMemo(
    () => computeCategoryBreakdown(periodTransactions),
    [periodTransactions]
  );

  const highestCategory = React.useMemo(
    () => getHighestSpendingCategory(periodTransactions),
    [periodTransactions]
  );

  // Default selected donut category to top category when available
  React.useEffect(() => {
    if (categoryBreakdown.length > 0) {
      if (
        !selectedCategory ||
        !categoryBreakdown.some((c) => c.category === selectedCategory)
      ) {
        setSelectedCategory(categoryBreakdown[0].category);
      }
    } else {
      setSelectedCategory(null);
    }
  }, [categoryBreakdown, selectedCategory]);

  const selectedCategoryTransactions = React.useMemo(() => {
    if (!selectedCategory) return [];
    return periodTransactions
      .filter((t) => t.type === 'expense' && t.category === selectedCategory)
      .slice(0, 5);
  }, [periodTransactions, selectedCategory]);

  // Overview chart data (Weekly / Monthly / Yearly — independent of period selector, Rule 4)
  const weeklyChart = React.useMemo(
    () => buildOverviewChartData(allTransactions, 'weekly', today),
    [allTransactions, today]
  );
  const monthlyChart = React.useMemo(
    () => buildOverviewChartData(allTransactions, 'monthly', today),
    [allTransactions, today]
  );
  const yearlyChart = React.useMemo(
    () => buildOverviewChartData(allTransactions, 'yearly', today),
    [allTransactions, today]
  );

  const activeChartData =
    chartMode === 'weekly'
      ? weeklyChart
      : chartMode === 'yearly'
        ? yearlyChart
        : monthlyChart;

  // Remaining monthly budget for the month containing the period's end date (Rule 5)
  const remainingMonthlyBudget = React.useMemo(
    () =>
      computeRemainingMonthlyBudget(
        budgetsQuery.data ?? [],
        allTransactions,
        resolvedPeriod.budgetYearMonth,
        profile?.overall_monthly_budget_minor
      ),
    [
      budgetsQuery.data,
      allTransactions,
      resolvedPeriod.budgetYearMonth,
      profile?.overall_monthly_budget_minor,
    ]
  );

  // Evaluated goals preview
  const evaluatedGoals = React.useMemo(() => {
    const goals = goalsQuery.data?.goals ?? [];
    const contributions = goalsQuery.data?.contributions ?? [];
    return goals.map((g) => evaluateGoal(g, contributions, today));
  }, [goalsQuery.data, today]);

  // Recent 6 transactions (all-time latest 6)
  const recentTransactions = React.useMemo(
    () => allTransactions.slice(0, 6),
    [allTransactions]
  );

  const isLoading =
    balanceQuery.isLoading ||
    allTxnsQuery.isLoading ||
    budgetsQuery.isLoading ||
    goalsQuery.isLoading;

  const isError = balanceQuery.isError || allTxnsQuery.isError;

  if (isError) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-6 w-6 text-expense" />}
        title="Unable to load dashboard data"
        description="Please check your connection and try refreshing your workspace."
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              balanceQuery.refetch();
              allTxnsQuery.refetch();
            }}
          >
            Retry
          </Button>
        }
      />
    );
  }

  const balance = balanceQuery.data ?? {
    startingBalanceMinor: 0,
    totalIncomeMinor: 0,
    totalExpenseMinor: 0,
    totalBalanceMinor: 0,
    setAsideMinor: 0,
    availableToSpendMinor: 0,
  };

  return (
    <div className="space-y-6">
      {/* Period Context & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            Period:{' '}
            <span className="font-semibold text-primary">{resolvedPeriod.label}</span> (
            {formatDisplayDate(resolvedPeriod.start)} –{' '}
            {formatDisplayDate(resolvedPeriod.end)})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setTxnDialogType('income');
              setTxnDialogOpen(true);
            }}
          >
            Add income
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setTxnDialogType('expense');
              setTxnDialogOpen(true);
            }}
          >
            Add expense
          </Button>
          <Link href="/affordability">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Calculator className="h-4 w-4" />}
            >
              Can I afford it?
            </Button>
          </Link>
        </div>
      </div>

      {/* 4 Primary Summary Cards (Rules 1 & 2) */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total available balance (Always as of today) */}
          <Card className="border-l-4 border-l-[#14533D]" data-testid="card-available-balance">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="font-medium">
                  Total available balance
                </CardDescription>
                <Wallet
                  className="h-4 w-4 text-[#14533D] dark:text-[#45B883]"
                  aria-hidden="true"
                />
              </div>
              <CardTitle
                data-testid="available-to-spend-value"
                className="text-2xl font-bold tabular-nums"
              >
                {formatMoney(balance.availableToSpendMinor, { currency })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-muted">
              <div className="flex justify-between">
                <span>Total balance:</span>
                <span className="font-semibold tabular-nums text-primary">
                  {formatMoney(balance.totalBalanceMinor, { currency })}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Set aside in goals:</span>
                <span className="font-semibold tabular-nums text-primary">
                  {formatMoney(balance.setAsideMinor, { currency })}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Income (Selected Period) */}
          <Card data-testid="card-period-income">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="font-medium">
                  Income ({resolvedPeriod.label})
                </CardDescription>
                <TrendingUp className="h-4 w-4 text-income" aria-hidden="true" />
              </div>
              <CardTitle className="text-2xl font-bold tabular-nums text-income">
                {formatMoney(periodSummary.incomeMinor, { currency })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="income">
                {periodTransactions.filter((t) => t.type === 'income').length} income records
              </Badge>
            </CardContent>
          </Card>

          {/* Card 3: Expenses (Selected Period) */}
          <Card data-testid="card-period-expenses">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="font-medium">
                  Expenses ({resolvedPeriod.label})
                </CardDescription>
                <TrendingDown className="h-4 w-4 text-expense" aria-hidden="true" />
              </div>
              <CardTitle className="text-2xl font-bold tabular-nums text-expense">
                {formatMoney(periodSummary.expenseMinor, { currency })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="expense">
                {periodTransactions.filter((t) => t.type === 'expense').length} expense records
              </Badge>
            </CardContent>
          </Card>

          {/* Card 4: Net savings & Savings rate (Selected Period) */}
          <Card data-testid="card-net-savings">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="font-medium">
                  Net savings ({resolvedPeriod.label})
                </CardDescription>
                <PiggyBank
                  className="h-4 w-4 text-[#14533D] dark:text-[#45B883]"
                  aria-hidden="true"
                />
              </div>
              <CardTitle
                className={`text-2xl font-bold tabular-nums ${
                  periodSummary.netSavingsMinor < 0 ? 'text-expense' : 'text-primary'
                }`}
              >
                {formatMoney(periodSummary.netSavingsMinor, { currency })}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between text-xs text-muted">
              <span>Savings rate:</span>
              <span
                data-testid="overview-savings-rate"
                className="font-semibold tabular-nums text-primary"
              >
                {periodSummary.savingsRateFormatted}
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Row 2: Income vs Expenses Chart (Independent of period selector) + Deterministic Insights */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Income vs Expenses</CardTitle>
              <CardDescription>
                Cashflow comparison across {chartMode} buckets (independent of period filter)
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Chart horizon toggle"
                className="inline-flex rounded-control border border-border bg-page p-1"
              >
                {(
                  [
                    { key: 'weekly', label: 'Weekly', data: weeklyChart },
                    { key: 'monthly', label: 'Monthly', data: monthlyChart },
                    { key: 'yearly', label: 'Yearly', data: yearlyChart },
                  ] as const
                ).map((tab) => {
                  const disabled = tab.data.isDisabled && tab.key !== chartMode;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      disabled={disabled}
                      title={tab.data.disabledReason ?? `View ${tab.label} trend`}
                      onClick={() => setChartMode(tab.key)}
                      className={`min-h-[36px] rounded-[8px] px-3 py-1 text-xs font-medium transition-colors ${
                        chartMode === tab.key
                          ? 'bg-[#14533D] text-white'
                          : 'text-muted hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                leftIcon={
                  showCashflowTable ? (
                    <BarChart3 className="h-4 w-4" />
                  ) : (
                    <Table2 className="h-4 w-4" />
                  )
                }
                onClick={() => setShowCashflowTable((v) => !v)}
              >
                {showCashflowTable ? 'Show chart' : 'View as table'}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Accessible Text Summary (Section 9) */}
            <p className="text-xs text-muted">
              Summary: Showing {activeChartData.buckets.length} {chartMode} buckets (
              {activeChartData.bucketsWithDataCount} with recorded transactions).
            </p>

            {allTransactions.length === 0 ? (
              <EmptyState
                title="No cashflow history yet"
                description="Add income or expense transactions to populate your cashflow trend chart."
              />
            ) : showCashflowTable ? (
              <div className="overflow-x-auto rounded-control border border-border">
                <table
                  aria-label="Income vs Expenses table"
                  className="w-full text-left text-xs sm:text-sm"
                >
                  <thead className="border-b border-border bg-page/60 font-semibold text-muted">
                    <tr>
                      <th className="px-3 py-2.5">Bucket</th>
                      <th className="px-3 py-2.5 text-right">Income</th>
                      <th className="px-3 py-2.5 text-right">Expenses</th>
                      <th className="px-3 py-2.5 text-right">Net Savings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {activeChartData.buckets.map((b) => (
                      <tr key={b.key}>
                        <td className="px-3 py-2 font-medium text-primary">{b.label}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-income">
                          {formatMoney(b.incomeMinor, { currency })}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-expense">
                          {formatMoney(b.expenseMinor, { currency })}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {formatMoney(b.netSavingsMinor, { currency })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <CashflowBarChart buckets={activeChartData.buckets} currency={currency} />
            )}
          </CardContent>
        </Card>

        {/* Deterministic Insights Panel */}
        <Card data-testid="insights-panel">
          <CardHeader>
            <CardTitle>Deterministic Insights</CardTitle>
            <CardDescription>
              Calculated directly from your records for {resolvedPeriod.label}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 1. Highest spending category */}
            <div className="rounded-control border border-border p-3.5">
              <p className="text-xs text-muted">Highest spending category</p>
              {highestCategory ? (
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                    <CategoryIcon category={highestCategory.category} className="h-4 w-4 text-expense" />
                    {highestCategory.label}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-expense">
                    {formatMoney(highestCategory.amountMinor, { currency })} (
                    {highestCategory.percentage.toFixed(0)}%)
                  </span>
                </div>
              ) : (
                <p className="mt-1 text-sm font-medium text-muted">
                  No expenses recorded in this period
                </p>
              )}
            </div>

            {/* 2. Change vs previous period */}
            <div className="rounded-control border border-border p-3.5">
              <p className="text-xs text-muted">
                Spending vs previous window ({resolvedPeriod.prevStart} to{' '}
                {resolvedPeriod.prevEnd})
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-primary">
                  {expenseComparison.label}
                </span>
                {expenseComparison.hasEarlierData && (
                  <Badge
                    variant={expenseComparison.deltaMinor <= 0 ? 'income' : 'expense'}
                  >
                    {formatMoney(expenseComparison.deltaMinor, {
                      currency,
                      showPlusSign: true,
                    })}
                  </Badge>
                )}
              </div>
            </div>

            {/* 3. Remaining monthly budget */}
            <div className="rounded-control border border-border p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">
                  Remaining budget ({resolvedPeriod.budgetYearMonth})
                </span>
                {remainingMonthlyBudget.hasBudget ? (
                  <span className="font-semibold tabular-nums text-primary">
                    {formatMoney(remainingMonthlyBudget.remainingMinor, { currency })}
                  </span>
                ) : (
                  <Link href="/budgets" className="font-medium text-[#14533D] hover:underline dark:text-[#45B883]">
                    Set a budget
                  </Link>
                )}
              </div>
              {remainingMonthlyBudget.hasBudget ? (
                <>
                  <Progress
                    value={remainingMonthlyBudget.percentUsed}
                    tone={
                      remainingMonthlyBudget.percentUsed > 100
                        ? 'exceeded'
                        : remainingMonthlyBudget.percentUsed >= (profile?.warn_pct ?? 80)
                          ? 'approaching'
                          : 'normal'
                    }
                    label="Monthly budget utilization"
                  />
                  <p className="text-[11px] text-muted tabular-nums">
                    {formatMoney(remainingMonthlyBudget.totalSpentMinor, { currency })} spent
                    of {formatMoney(remainingMonthlyBudget.totalLimitMinor, { currency })} (
                    {remainingMonthlyBudget.percentUsed.toFixed(1)}%)
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted">
                  No monthly cap or category limits configured yet.
                </p>
              )}
            </div>

            {/* 4. Period Savings Rate */}
            <div className="rounded-control border border-border p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted">Savings rate ({resolvedPeriod.label})</p>
                <p className="mt-0.5 text-sm font-semibold text-primary">
                  {periodSummary.incomeMinor === 0
                    ? 'No income recorded in period'
                    : periodSummary.netSavingsMinor >= 0
                      ? 'Positive net cashflow'
                      : 'Expenses exceeded income'}
                </p>
              </div>
              <span className="text-lg font-bold tabular-nums text-primary">
                {periodSummary.savingsRateFormatted}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Expenses by Category Donut + Drilldown Panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Expenses by Category</CardTitle>
              <CardDescription>
                Click a slice or row to inspect transactions in {resolvedPeriod.label}
              </CardDescription>
            </div>
            {categoryBreakdown.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Table2 className="h-4 w-4" />}
                onClick={() => setShowDonutTable((v) => !v)}
              >
                {showDonutTable ? 'Show donut' : 'View as table'}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {categoryBreakdown.length === 0 ? (
              <EmptyState
                title="No expenses in this period"
                description="Record an expense or switch the period selector to see category distribution."
              />
            ) : (
              <>
                <p className="text-xs text-muted">
                  Summary: {categoryBreakdown.length} active expense categories totaling{' '}
                  {formatMoney(periodSummary.expenseMinor, { currency })}.
                </p>

                {showDonutTable ? (
                  <div className="overflow-x-auto rounded-control border border-border">
                    <table
                      aria-label="Category breakdown table"
                      className="w-full text-left text-xs sm:text-sm"
                    >
                      <thead className="border-b border-border bg-page/60 font-semibold text-muted">
                        <tr>
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2 text-right">Spent</th>
                          <th className="px-3 py-2 text-right">Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {categoryBreakdown.map((item) => (
                          <tr
                            key={item.category}
                            onClick={() => setSelectedCategory(item.category)}
                            className="cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                          >
                            <td className="px-3 py-2 font-medium text-primary">
                              {item.label}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatMoney(item.amountMinor, { currency })}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {item.percentage.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <CategoryDonutChart
                    items={categoryBreakdown}
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                    currency={currency}
                  />
                )}

                {/* Interactive Category Selector Pills + Drilldown */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {categoryBreakdown.map((item) => (
                    <button
                      key={item.category}
                      type="button"
                      onClick={() => setSelectedCategory(item.category)}
                      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        selectedCategory === item.category
                          ? 'border-[#14533D] bg-[#14533D] text-white'
                          : 'border-border bg-card text-primary hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <CategoryIcon category={item.category} className="h-3.5 w-3.5" />
                      <span>{item.label}</span>
                      <span className="tabular-nums opacity-80">
                        ({item.percentage.toFixed(0)}%)
                      </span>
                    </button>
                  ))}
                </div>

                {selectedCategory && (
                  <div className="rounded-control border border-border bg-page/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-primary">
                        {getCategoryLabel(selectedCategory)} transactions
                      </h4>
                      <Link
                        href={`/transactions?category=${selectedCategory}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#14533D] hover:underline dark:text-[#45B883]"
                      >
                        View all <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                    <ul className="divide-y divide-border text-sm">
                      {selectedCategoryTransactions.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center justify-between py-2 gap-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-primary">
                              {t.description}
                            </p>
                            <p className="text-xs text-muted">
                              {formatDisplayDate(t.txn_date)}
                            </p>
                          </div>
                          <span className="font-semibold tabular-nums text-expense shrink-0">
                            {formatMoney(t.amount_minor, { currency })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions (Last 6) & Savings Goal Preview */}
        <div className="space-y-6">
          {/* Recent 6 Transactions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Last 6 recorded entries</CardDescription>
              </div>
              <Link href="/transactions">
                <Button
                  variant="ghost"
                  size="sm"
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  View all
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentTransactions.length === 0 ? (
                <EmptyState
                  title="No transactions yet"
                  description="Your 6 most recent income and expense entries will appear here."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {recentTransactions.map((txn) => (
                    <li
                      key={txn.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0E3B2C]/10 text-[#0E3B2C] dark:bg-white/10 dark:text-[#EDEBE4]">
                          <CategoryIcon category={txn.category} className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-primary">
                            {txn.description}
                          </p>
                          <p className="text-xs text-muted">
                            {getCategoryLabel(txn.category)} •{' '}
                            {formatDisplayDate(txn.txn_date)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 text-sm font-semibold tabular-nums ${
                          txn.type === 'income' ? 'text-income' : 'text-expense'
                        }`}
                      >
                        {formatMoney(
                          txn.type === 'income' ? txn.amount_minor : -txn.amount_minor,
                          { currency, showPlusSign: true }
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Savings Goal Preview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Savings Goals</CardTitle>
                <CardDescription>Progress toward your active milestones</CardDescription>
              </div>
              <Link href="/goals">
                <Button
                  variant="ghost"
                  size="sm"
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Manage goals
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {evaluatedGoals.length === 0 ? (
                <EmptyState
                  title="No savings goals configured"
                  description="Create a goal to set aside funds from your available balance."
                  action={
                    <Link href="/goals">
                      <Button variant="outline" size="sm">
                        Create goal
                      </Button>
                    </Link>
                  }
                />
              ) : (
                evaluatedGoals.slice(0, 3).map((g) => (
                  <div
                    key={g.id}
                    className="rounded-control border border-border p-4 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm text-primary">{g.name}</p>
                        <p className="text-xs text-muted">
                          {g.targetDate
                            ? `Target date: ${formatDisplayDate(g.targetDate)}`
                            : 'No target date'}
                        </p>
                      </div>
                      <Badge
                        variant={
                          g.state === 'reached'
                            ? 'success'
                            : g.state === 'past_due'
                              ? 'warning'
                              : 'income'
                        }
                      >
                        {g.progressPct.toFixed(0)}%
                      </Badge>
                    </div>
                    <Progress
                      value={g.progressPct}
                      tone={g.state === 'past_due' ? 'approaching' : 'normal'}
                      label={`${g.name} progress`}
                    />
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-muted tabular-nums">
                      <span>
                        Saved:{' '}
                        <strong className="text-primary">
                          {formatMoney(g.savedMinor, { currency })}
                        </strong>{' '}
                        / {formatMoney(g.targetMinor, { currency })}
                      </span>
                      <span>
                        Remaining:{' '}
                        <strong className="text-primary">
                          {formatMoney(g.remainingMinor, { currency })}
                        </strong>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <TransactionDialog
        open={txnDialogOpen}
        onOpenChange={setTxnDialogOpen}
        initialType={txnDialogType}
        timezone={timezone}
      />
    </div>
  );
}
