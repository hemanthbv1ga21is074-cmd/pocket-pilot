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
  evaluateMonthlyBudgets,
  buildOverviewChartData,
  transactionsToCsv,
  getCategoryLabel,
} from '@/lib/finance';
import { usePeriodParams } from '@/components/layout/period-selector';
import {
  useProfile,
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

  const [showTrendTable, setShowTrendTable] = React.useState(false);
  const [showSavingsTable, setShowSavingsTable] = React.useState(false);
  const [showBudgetTable, setShowBudgetTable] = React.useState(false);

  const allTransactions = allTxnsQuery.data ?? [];
  const budgets = budgetsQuery.data ?? [];

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
