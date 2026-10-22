'use client';

import * as React from 'react';
import { Plus, Pencil, Trash2, AlertCircle, Calendar } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Select,
  Badge,
  Progress,
  Skeleton,
  EmptyState,
  Dialog,
} from '@/components/ui';
import {
  EXPENSE_CATEGORIES,
  evaluateMonthlyBudgets,
  computeRemainingMonthlyBudget,
  formatMoney,
  parseMoneyToMinor,
  minorToDecimalString,
  getTodayInTimezone,
  type BudgetRecord,
  type EvaluatedBudget,
  type ExpenseCategoryKey,
} from '@/lib/finance';
import {
  useProfile,
  useBudgets,
  useTransactionsRange,
  useUpsertBudget,
  useDeleteBudget,
} from '@/features/shared/use-finance-data';
import { CategoryIcon } from '@/features/shared/category-icon';

export default function BudgetsPage() {
  const { data: profile } = useProfile();
  const timezone = profile?.timezone || 'Asia/Kolkata';
  const currency = profile?.currency || 'INR';
  const warnPct = profile?.warn_pct ?? 80;
  const today = getTodayInTimezone(new Date(), timezone);

  const [selectedMonth, setSelectedMonth] = React.useState(() => today.slice(0, 7));

  const budgetsQuery = useBudgets();
  const txnsQuery = useTransactionsRange(
    `${selectedMonth}-01`,
    `${selectedMonth}-31`
  );

  const upsertMutation = useUpsertBudget();
  const deleteMutation = useDeleteBudget();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingBudget, setEditingBudget] = React.useState<BudgetRecord | null>(null);
  const [categoryInput, setCategoryInput] = React.useState<ExpenseCategoryKey>('food_dining');
  const [limitStr, setLimitStr] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);

  const [deletingBudget, setDeletingBudget] = React.useState<EvaluatedBudget | null>(null);

  const budgets = budgetsQuery.data ?? [];
  const monthTransactions = txnsQuery.data ?? [];

  const evaluatedBudgets = React.useMemo(
    () => evaluateMonthlyBudgets(budgets, monthTransactions, selectedMonth, warnPct),
    [budgets, monthTransactions, selectedMonth, warnPct]
  );

  const summary = React.useMemo(
    () =>
      computeRemainingMonthlyBudget(
        budgets,
        monthTransactions,
        selectedMonth,
        profile?.overall_monthly_budget_minor
      ),
    [budgets, monthTransactions, selectedMonth, profile?.overall_monthly_budget_minor]
  );

  // Category picker only offers categories without a budget (when creating)
  const availableCategories = React.useMemo(() => {
    const existingSet = new Set(budgets.map((b) => b.category));
    return EXPENSE_CATEGORIES.filter((c) => !existingSet.has(c.key));
  }, [budgets]);

  const openCreateDialog = () => {
    if (availableCategories.length === 0) return;
    setEditingBudget(null);
    setCategoryInput(availableCategories[0].key);
    setLimitStr('');
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (budget: EvaluatedBudget) => {
    setEditingBudget({
      id: budget.id,
      category: budget.category,
      limit_minor: budget.limitMinor,
    });
    setCategoryInput(budget.category);
    setLimitStr(minorToDecimalString(budget.limitMinor, false));
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = parseMoneyToMinor(limitStr);
    if (!parsed.ok) {
      setFormError(parsed.error);
      return;
    }

    await upsertMutation.mutateAsync({
      id: editingBudget?.id,
      category: categoryInput,
      limit_minor: parsed.minor,
    });

    setDialogOpen(false);
  };

  const isLoading = budgetsQuery.isLoading || txnsQuery.isLoading;
  const isError = budgetsQuery.isError || txnsQuery.isError;

  return (
    <div className="space-y-6">
      {/* Header & Month Picker */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-primary">Monthly Category Budgets</h2>
          <p className="text-sm text-muted">
            Monitor category limits for {selectedMonth}. Warning threshold is set to {warnPct}%.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex items-center">
            <Calendar
              className="pointer-events-none absolute left-3 h-4 w-4 text-muted"
              aria-hidden="true"
            />
            <label htmlFor="budget-month-picker" className="sr-only">
              Select budget month
            </label>
            <input
              id="budget-month-picker"
              type="month"
              aria-label="Budget month"
              value={selectedMonth}
              onChange={(e) => {
                if (e.target.value) setSelectedMonth(e.target.value);
              }}
              className="min-h-[44px] rounded-control border border-border bg-card pl-9 pr-3 py-2 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9E6B]"
            />
          </div>

          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            disabled={availableCategories.length === 0}
            onClick={openCreateDialog}
          >
            Create budget
          </Button>
        </div>
      </div>

      {/* Summary Strip (Total Limit, Spent, Remaining) */}
      <div
        data-testid="budget-summary-strip"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              {summary.mode === 'overall_cap'
                ? 'Overall monthly budget cap'
                : 'Total budgeted limits'}
            </CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {formatMoney(summary.totalLimitMinor, { currency })}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total spent ({selectedMonth})</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-expense">
              {formatMoney(summary.totalSpentMinor, { currency })}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Remaining monthly budget</CardDescription>
            <CardTitle
              className={`text-2xl font-bold tabular-nums ${
                summary.remainingMinor < 0 ? 'text-expense' : 'text-income'
              }`}
            >
              {formatMoney(summary.remainingMinor, { currency })}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Loading / Error / Empty / Budget Cards */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      )}

      {isError && (
        <EmptyState
          icon={<AlertCircle className="h-6 w-6 text-expense" />}
          title="Could not load budgets"
          description="An error occurred while fetching your monthly budgets."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                budgetsQuery.refetch();
                txnsQuery.refetch();
              }}
            >
              Retry
            </Button>
          }
        />
      )}

      {!isLoading && !isError && evaluatedBudgets.length === 0 && (
        <EmptyState
          title="No category budgets configured"
          description="Set a recurring monthly limit for expense categories like Food and Dining, Shopping, or Transport."
          action={
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={openCreateDialog}
            >
              Create your first budget
            </Button>
          }
        />
      )}

      {!isLoading && !isError && evaluatedBudgets.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {evaluatedBudgets.map((b) => (
            <Card
              key={b.id}
              data-testid={`budget-card-${b.category}`}
              className="flex flex-col justify-between"
            >
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-control bg-[#0E3B2C]/10 text-[#0E3B2C] dark:bg-white/10 dark:text-[#EDEBE4]">
                      <CategoryIcon category={b.category} className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{b.categoryLabel}</CardTitle>
                      <CardDescription className="tabular-nums">
                        Limit: {formatMoney(b.limitMinor, { currency })} / month
                      </CardDescription>
                    </div>
                  </div>

                  <Badge
                    variant={
                      b.status === 'exceeded'
                        ? 'expense'
                        : b.status === 'approaching' || b.status === 'reached'
                          ? 'warning'
                          : 'income'
                    }
                  >
                    {b.statusLabel} ({b.percentUsed.toFixed(1)}%)
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <Progress
                  value={b.percentUsed}
                  tone={b.status}
                  label={`${b.categoryLabel} budget utilization`}
                />

                <div className="flex items-center justify-between text-xs sm:text-sm tabular-nums">
                  <div>
                    <span className="text-muted">Spent: </span>
                    <strong className="text-primary">
                      {formatMoney(b.spentMinor, { currency })}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted">
                      {b.remainingMinor < 0 ? 'Over by: ' : 'Remaining: '}
                    </span>
                    <strong
                      className={
                        b.remainingMinor < 0 ? 'text-expense' : 'text-income'
                      }
                    >
                      {formatMoney(Math.abs(b.remainingMinor), { currency })}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 border-t border-border pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => openEditDialog(b)}
                  >
                    Edit limit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-expense"
                    leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => setDeletingBudget(b)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Budget Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingBudget ? `Edit ${ EXPENSE_CATEGORIES.find(c => c.key === editingBudget.category)?.label ?? '' } budget` : 'Create category budget'}
        description="Note: Editing a monthly category limit applies to all calendar months."
      >
        <form onSubmit={handleSaveBudget} className="space-y-4" noValidate>
          {!editingBudget && (
            <Select
              label="Expense category"
              value={categoryInput}
              onChange={(e) => setCategoryInput(e.target.value as ExpenseCategoryKey)}
              options={availableCategories.map((c) => ({
                value: c.key,
                label: c.label,
              }))}
              helperText="Only expense categories without an existing budget are shown."
            />
          )}

          <Input
            label="Monthly limit (INR)"
            prefixAddon="₹"
            placeholder="e.g. 10,000"
            value={limitStr}
            onChange={(e) => setLimitStr(e.target.value)}
            error={formError ?? undefined}
            helperText="Applies as a recurring monthly limit across all months."
            required
          />

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={upsertMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={upsertMutation.isPending}
            >
              {editingBudget ? 'Update limit' : 'Create budget'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Budget Confirmation Dialog */}
      <Dialog
        open={!!deletingBudget}
        onOpenChange={(open) => {
          if (!open) setDeletingBudget(null);
        }}
        title="Delete category budget?"
        description="This removes the monthly spending limit for this category. Your recorded transactions will not be affected."
      >
        {deletingBudget && (
          <div className="space-y-4">
            <p className="text-sm text-primary">
              Remove the{' '}
              <strong>
                {formatMoney(deletingBudget.limitMinor, { currency })}/month
              </strong>{' '}
              limit for <strong>{deletingBudget.categoryLabel}</strong>?
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                onClick={() => setDeletingBudget(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                isLoading={deleteMutation.isPending}
                onClick={async () => {
                  await deleteMutation.mutateAsync(deletingBudget.id);
                  setDeletingBudget(null);
                }}
              >
                Delete budget
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
