'use client';

import * as React from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  RotateCcw,
  CalendarClock,
  AlertCircle,
} from 'lucide-react';
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
  Skeleton,
  EmptyState,
  Dialog,
} from '@/components/ui';
import {
  EXPENSE_CATEGORIES,
  evaluateAllPayments,
  formatMoney,
  formatDisplayDate,
  parseMoneyToMinor,
  minorToDecimalString,
  getTodayInTimezone,
  parseISODate,
  isValidISODate,
  isFutureDate,
  getCategoryLabel,
  type EvaluatedPayment,
  type ExpenseCategoryKey,
  type PaymentFrequency,
} from '@/lib/finance';
import {
  useProfile,
  useRecurringPayments,
  useCreatePayment,
  useUpdatePayment,
  useDeletePayment,
  useMarkPaymentPaid,
  useUndoLastPayment,
} from '@/features/shared/use-finance-data';
import { CategoryIcon } from '@/features/shared/category-icon';

type PaymentTab = 'upcoming' | 'overdue' | 'paid';

const FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  once: 'One-time',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export default function PaymentsPage() {
  const { data: profile } = useProfile();
  const timezone = profile?.timezone || 'Asia/Kolkata';
  const currency = profile?.currency || 'INR';
  const today = getTodayInTimezone(new Date(), timezone);

  const paymentsQuery = useRecurringPayments();

  const createMutation = useCreatePayment();
  const updateMutation = useUpdatePayment();
  const deleteMutation = useDeletePayment();
  const markPaidMutation = useMarkPaymentPaid();
  const undoMutation = useUndoLastPayment();

  const [activeTab, setActiveTab] = React.useState<PaymentTab>('upcoming');

  // Create / Edit Dialog State
  const [formDialogOpen, setFormDialogOpen] = React.useState(false);
  const [editingPayment, setEditingPayment] = React.useState<EvaluatedPayment | null>(
    null
  );
  const [nameInput, setNameInput] = React.useState('');
  const [amountStr, setAmountStr] = React.useState('');
  const [categoryInput, setCategoryInput] =
    React.useState<ExpenseCategoryKey>('bills_utilities');
  const [frequencyInput, setFrequencyInput] =
    React.useState<PaymentFrequency>('monthly');
  const [dueDateInput, setDueDateInput] = React.useState(today);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Mark Paid Dialog State
  const [markingPayment, setMarkingPayment] = React.useState<EvaluatedPayment | null>(
    null
  );
  const [paidDateInput, setPaidDateInput] = React.useState(today);
  const [paidAmountStr, setPaidAmountStr] = React.useState('');
  const [markPaidError, setMarkPaidError] = React.useState<string | null>(null);

  // Delete Confirmation State
  const [deletingPayment, setDeletingPayment] = React.useState<EvaluatedPayment | null>(
    null
  );

  const rawPayments = paymentsQuery.data?.payments ?? [];
  const paidTransactions = paymentsQuery.data?.paidTransactions ?? [];

  const evaluated = React.useMemo(
    () => evaluateAllPayments(rawPayments, today),
    [rawPayments, today]
  );

  const openCreateDialog = () => {
    setEditingPayment(null);
    setNameInput('');
    setAmountStr('');
    setCategoryInput('bills_utilities');
    setFrequencyInput('monthly');
    setDueDateInput(today);
    setFormError(null);
    setFormDialogOpen(true);
  };

  const openEditDialog = (payment: EvaluatedPayment) => {
    setEditingPayment(payment);
    setNameInput(payment.name);
    setAmountStr(minorToDecimalString(payment.amount_minor, false));
    setCategoryInput(payment.category);
    setFrequencyInput(payment.frequency);
    setDueDateInput(payment.next_due_date);
    setFormError(null);
    setFormDialogOpen(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = nameInput.trim();
    if (!cleanName || cleanName.length > 80) {
      setFormError('Payment name is required (1–80 characters)');
      return;
    }

    const parsedAmount = parseMoneyToMinor(amountStr);
    if (!parsedAmount.ok) {
      setFormError(parsedAmount.error);
      return;
    }

    if (!dueDateInput || !isValidISODate(dueDateInput)) {
      setFormError('Enter a valid due date (YYYY-MM-DD)');
      return;
    }

    const anchorDay = parseISODate(dueDateInput).day;

    if (editingPayment) {
      await updateMutation.mutateAsync({
        id: editingPayment.id,
        name: cleanName,
        amount_minor: parsedAmount.minor,
        category: categoryInput,
        frequency: frequencyInput,
        next_due_date: dueDateInput,
        anchor_day: anchorDay,
      });
    } else {
      await createMutation.mutateAsync({
        name: cleanName,
        amount_minor: parsedAmount.minor,
        category: categoryInput,
        frequency: frequencyInput,
        next_due_date: dueDateInput,
        anchor_day: anchorDay,
      });
    }

    setFormDialogOpen(false);
  };

  const openMarkPaidDialog = (payment: EvaluatedPayment) => {
    setMarkingPayment(payment);
    setPaidDateInput(today);
    setPaidAmountStr(minorToDecimalString(payment.amount_minor, false));
    setMarkPaidError(null);
  };

  const handleConfirmMarkPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!markingPayment) return;
    setMarkPaidError(null);

    const parsedAmount = parseMoneyToMinor(paidAmountStr);
    if (!parsedAmount.ok) {
      setMarkPaidError(parsedAmount.error);
      return;
    }

    if (!paidDateInput || !isValidISODate(paidDateInput)) {
      setMarkPaidError('Enter a valid payment date');
      return;
    }

    if (isFutureDate(paidDateInput, today)) {
      setMarkPaidError('Paid date cannot be in the future');
      return;
    }

    await markPaidMutation.mutateAsync({
      payment_id: markingPayment.id,
      paid_on: paidDateInput,
      amount_minor: parsedAmount.minor,
    });

    setMarkingPayment(null);
  };

  const renderDueIndicator = (p: EvaluatedPayment) => {
    if (p.status === 'paid') return 'Paid';
    if (p.daysUntilDue < 0) {
      const daysAgo = Math.abs(p.daysUntilDue);
      return `Overdue by ${daysAgo} ${daysAgo === 1 ? 'day' : 'days'}`;
    }
    if (p.daysUntilDue === 0) return 'Due today';
    if (p.daysUntilDue === 1) return 'Due tomorrow';
    return `Due in ${p.daysUntilDue} days`;
  };

  const renderPaymentCard = (p: EvaluatedPayment) => {
    const canUndo = !!p.last_paid_txn_id || !!p.due_date_before_last_payment;
    return (
      <Card
        key={p.id}
        data-testid={`payment-card-${p.id}`}
        className="flex flex-col justify-between"
      >
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-control bg-[#0E3B2C]/10 text-[#0E3B2C] dark:bg-white/10 dark:text-[#EDEBE4]">
                <CategoryIcon category={p.category} className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">{p.name}</CardTitle>
                <CardDescription>
                  {getCategoryLabel(p.category)} • {FREQUENCY_LABELS[p.frequency]}
                </CardDescription>
              </div>
            </div>

            <Badge
              variant={
                p.status === 'overdue'
                  ? 'expense'
                  : p.status === 'due_soon'
                    ? 'warning'
                    : p.status === 'paid'
                      ? 'success'
                      : 'default'
              }
            >
              {p.statusLabel}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-baseline justify-between rounded-control border border-border bg-page/50 p-3">
            <div>
              <p className="text-xs text-muted">Next due date</p>
              <p className="text-sm font-semibold text-primary">
                {formatDisplayDate(p.next_due_date)}
              </p>
              <p className="text-xs text-muted mt-0.5">{renderDueIndicator(p)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted">Scheduled amount</p>
              <p className="text-lg font-bold tabular-nums text-primary">
                {formatMoney(p.amount_minor, { currency })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              {p.status !== 'paid' && (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<CheckCircle2 className="h-4 w-4" />}
                  onClick={() => openMarkPaidDialog(p)}
                >
                  Mark paid
                </Button>
              )}

              {canUndo && (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<RotateCcw className="h-4 w-4" />}
                  isLoading={undoMutation.isPending}
                  onClick={() => undoMutation.mutate(p.id)}
                >
                  Undo last payment
                </Button>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={`Edit ${p.name}`}
                onClick={() => openEditDialog(p)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-muted hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Delete ${p.name}`}
                onClick={() => setDeletingPayment(p)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-muted hover:bg-expense/10 hover:text-expense"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-primary">Upcoming Payments</h2>
          <p className="text-sm text-muted">
            Scheduled bills never affect your balance or budgets until marked as paid.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={openCreateDialog}
        >
          Add payment
        </Button>
      </div>

      {/* Tabs: Upcoming, Overdue, Paid */}
      <div
        role="tablist"
        aria-label="Payment status tabs"
        className="flex flex-wrap gap-2 border-b border-border pb-3"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'upcoming'}
          onClick={() => setActiveTab('upcoming')}
          className={`min-h-[44px] rounded-control px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'upcoming'
              ? 'bg-[#14533D] text-white'
              : 'bg-card border border-border text-primary hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          Upcoming ({evaluated.upcoming.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'overdue'}
          onClick={() => setActiveTab('overdue')}
          className={`min-h-[44px] rounded-control px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'overdue'
              ? 'bg-[#14533D] text-white'
              : 'bg-card border border-border text-primary hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          Overdue ({evaluated.overdue.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'paid'}
          onClick={() => setActiveTab('paid')}
          className={`min-h-[44px] rounded-control px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'paid'
              ? 'bg-[#14533D] text-white'
              : 'bg-card border border-border text-primary hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          Paid ({paidTransactions.length})
        </button>
      </div>

      {paymentsQuery.isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      )}

      {paymentsQuery.isError && (
        <EmptyState
          icon={<AlertCircle className="h-6 w-6 text-expense" />}
          title="Could not load scheduled payments"
          description="An error occurred while loading your payments."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => paymentsQuery.refetch()}
            >
              Retry
            </Button>
          }
        />
      )}

      {/* Tab 1: Upcoming */}
      {!paymentsQuery.isLoading && !paymentsQuery.isError && activeTab === 'upcoming' && (
        evaluated.upcoming.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-6 w-6" />}
            title="No upcoming payments scheduled"
            description="Schedule recurring bills like rent, broadband, or subscriptions to receive in-app due reminders."
            action={
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={openCreateDialog}
              >
                Add payment
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {evaluated.upcoming.map(renderPaymentCard)}
          </div>
        )
      )}

      {/* Tab 2: Overdue */}
      {!paymentsQuery.isLoading && !paymentsQuery.isError && activeTab === 'overdue' && (
        evaluated.overdue.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-6 w-6 text-income" />}
            title="No overdue payments"
            description="You are caught up on all scheduled bills past their due date."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {evaluated.overdue.map(renderPaymentCard)}
          </div>
        )
      )}

      {/* Tab 3: Paid (lists linked expense transactions + undo option) */}
      {!paymentsQuery.isLoading && !paymentsQuery.isError && activeTab === 'paid' && (
        paidTransactions.length === 0 ? (
          <EmptyState
            title="No paid bill records yet"
            description="When you mark an upcoming or overdue payment as paid, its linked expense transaction is listed here."
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Paid Payment History</CardTitle>
              <CardDescription>
                Linked expense transactions created when marking scheduled bills as paid
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {paidTransactions.map((txn) => {
                  const parentPayment = evaluated.all.find(
                    (p) => p.id === txn.recurring_payment_id && p.last_paid_txn_id === txn.id
                  );
                  return (
                    <li
                      key={txn.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3.5"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-income/15 text-income">
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-primary truncate">
                            {txn.description}
                          </p>
                          <p className="text-xs text-muted">
                            {getCategoryLabel(txn.category)} • Paid on{' '}
                            {formatDisplayDate(txn.txn_date)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-bold tabular-nums text-expense">
                          {formatMoney(txn.amount_minor, { currency })}
                        </span>
                        <Badge variant="success">Paid</Badge>
                        {parentPayment && (
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                            isLoading={undoMutation.isPending}
                            onClick={() => undoMutation.mutate(parentPayment.id)}
                          >
                            Undo
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )
      )}

      {/* Add / Edit Payment Dialog */}
      <Dialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        title={editingPayment ? 'Edit scheduled payment' : 'Add upcoming payment'}
        description="Configure the bill name, amount, category, due date, and recurrence frequency."
      >
        <form onSubmit={handleSavePayment} className="space-y-4" noValidate>
          <Input
            label="Payment name"
            placeholder="e.g. ACT Fibernet or Apartment Rent"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            maxLength={80}
            required
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Amount (INR)"
              prefixAddon="₹"
              placeholder="e.g. 1,179"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              required
            />
            <Input
              label="Next due date"
              type="date"
              value={dueDateInput}
              onChange={(e) => setDueDateInput(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Category"
              value={categoryInput}
              onChange={(e) => setCategoryInput(e.target.value as ExpenseCategoryKey)}
              options={EXPENSE_CATEGORIES.map((c) => ({
                value: c.key,
                label: c.label,
              }))}
            />
            <Select
              label="Frequency"
              value={frequencyInput}
              onChange={(e) => setFrequencyInput(e.target.value as PaymentFrequency)}
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'quarterly', label: 'Quarterly' },
                { value: 'yearly', label: 'Yearly' },
                { value: 'once', label: 'One-time' },
              ]}
            />
          </div>

          {formError && (
            <p role="alert" className="text-xs font-medium text-expense">
              {formError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormDialogOpen(false)}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingPayment ? 'Save changes' : 'Schedule payment'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Mark Paid Dialog (Rule 7) */}
      <Dialog
        open={!!markingPayment}
        onOpenChange={(open) => {
          if (!open) setMarkingPayment(null);
        }}
        title={`Mark "${markingPayment?.name ?? ''}" as paid`}
        description="This creates a linked expense transaction and advances the next due date."
      >
        <form onSubmit={handleConfirmMarkPaid} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Amount paid (INR)"
              prefixAddon="₹"
              value={paidAmountStr}
              onChange={(e) => setPaidAmountStr(e.target.value)}
              error={markPaidError ?? undefined}
              required
            />
            <Input
              label="Paid date"
              type="date"
              max={today}
              value={paidDateInput}
              onChange={(e) => setPaidDateInput(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMarkingPayment(null)}
              disabled={markPaidMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={markPaidMutation.isPending}
            >
              Confirm & record expense
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Payment Confirmation Dialog */}
      <Dialog
        open={!!deletingPayment}
        onOpenChange={(open) => {
          if (!open) setDeletingPayment(null);
        }}
        title="Delete scheduled payment?"
        description="Past transactions already marked as paid will remain in your transaction ledger."
      >
        {deletingPayment && (
          <div className="space-y-4">
            <p className="text-sm text-primary">
              Remove <strong>{deletingPayment.name}</strong> (
              {formatMoney(deletingPayment.amount_minor, { currency })}) from your
              scheduled payments?
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                onClick={() => setDeletingPayment(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                isLoading={deleteMutation.isPending}
                onClick={async () => {
                  await deleteMutation.mutateAsync(deletingPayment.id);
                  setDeletingPayment(null);
                }}
              >
                Delete payment
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
