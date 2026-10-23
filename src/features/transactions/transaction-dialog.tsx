'use client';

import * as React from 'react';
import { Users } from 'lucide-react';
import {
  Dialog,
  Button,
  Input,
  Select,
} from '@/components/ui';
import {
  getCategoriesForType,
  getDefaultCategoryForType,
  resolveCategoryOnTypeChange,
  isCategoryValidForType,
  parseMoneyToMinor,
  minorToDecimalString,
  formatMoney,
  getTodayInTimezone,
  isFutureDate,
  isValidISODate,
  PAYMENT_METHODS,
  type CategoryKey,
  type PaymentMethodKey,
  type TransactionRecord,
  type TxnType,
} from '@/lib/finance';
import {
  useCreateTransaction,
  useUpdateTransaction,
} from '@/features/shared/use-finance-data';

export interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: TxnType;
  editingTransaction?: TransactionRecord | null;
  timezone?: string;
}

export function TransactionDialog({
  open,
  onOpenChange,
  initialType = 'expense',
  editingTransaction = null,
  timezone = 'Asia/Kolkata',
}: TransactionDialogProps) {
  const isEditing = !!editingTransaction;
  const today = getTodayInTimezone(new Date(), timezone);

  // Client-generated UUID for idempotent creation (Rule 12)
  const [clientUuid, setClientUuid] = React.useState<string>(() => crypto.randomUUID());
  const [type, setType] = React.useState<TxnType>(initialType);
  const [amountStr, setAmountStr] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState<CategoryKey>(() =>
    getDefaultCategoryForType(initialType)
  );
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethodKey>(
    initialType === 'income' ? 'bank' : 'upi'
  );
  const [txnDate, setTxnDate] = React.useState(today);
  const [notes, setNotes] = React.useState('');

  // Split Bill / Reimbursement state
  const [isSplit, setIsSplit] = React.useState(false);
  const [splitWith, setSplitWith] = React.useState('');
  const [reimbursableStr, setReimbursableStr] = React.useState('');
  const [isReimbursed, setIsReimbursed] = React.useState(false);

  const [errors, setErrors] = React.useState<{
    amount?: string;
    description?: string;
    category?: string;
    txnDate?: string;
    notes?: string;
    reimbursable?: string;
  }>({});

  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const isPending = createMutation.isPending || updateMutation.isPending;

  React.useEffect(() => {
    if (!open) return;
    setErrors({});
    if (editingTransaction) {
      setClientUuid(editingTransaction.id);
      setType(editingTransaction.type);
      setAmountStr(minorToDecimalString(editingTransaction.amount_minor, false));
      setDescription(editingTransaction.description);
      setCategory(editingTransaction.category);
      setPaymentMethod(
        editingTransaction.payment_method ||
          (editingTransaction.type === 'income' ? 'bank' : 'upi')
      );
      setTxnDate(editingTransaction.txn_date);
      setNotes(editingTransaction.notes ?? '');
      setIsSplit(Boolean(editingTransaction.is_split));
      setSplitWith(editingTransaction.split_with ?? '');
      setReimbursableStr(
        editingTransaction.reimbursable_minor && editingTransaction.reimbursable_minor > 0
          ? minorToDecimalString(editingTransaction.reimbursable_minor, false)
          : ''
      );
      setIsReimbursed(Boolean(editingTransaction.is_reimbursed));
    } else {
      setClientUuid(crypto.randomUUID());
      setType(initialType);
      setAmountStr('');
      setDescription('');
      setCategory(getDefaultCategoryForType(initialType));
      setPaymentMethod(initialType === 'income' ? 'bank' : 'upi');
      setTxnDate(getTodayInTimezone(new Date(), timezone));
      setNotes('');
      setIsSplit(false);
      setSplitWith('');
      setReimbursableStr('');
      setIsReimbursed(false);
    }
  }, [open, editingTransaction, initialType, timezone]);

  // Rule 13: Changing the type on edit resets an invalid category
  const handleTypeChange = (nextType: TxnType) => {
    setType(nextType);
    setCategory((prev) => resolveCategoryOnTypeChange(prev, nextType));
    if (!isEditing) {
      setPaymentMethod(nextType === 'income' ? 'bank' : 'upi');
    }
    if (nextType === 'income') {
      setIsSplit(false);
    }
  };

  const applySplitPreset = (ways: 2 | 3 | 4) => {
    const parsedTotal = parseMoneyToMinor(amountStr);
    if (!parsedTotal.ok || parsedTotal.minor <= 0) return;
    // Owed back is (ways - 1) / ways of total
    const myShareMinor = Math.round(parsedTotal.minor / ways);
    const owedBackMinor = Math.max(1, parsedTotal.minor - myShareMinor);
    setReimbursableStr(minorToDecimalString(owedBackMinor, false));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;

    const nextErrors: typeof errors = {};
    const parsedMoney = parseMoneyToMinor(amountStr);
    if (!parsedMoney.ok) {
      nextErrors.amount = parsedMoney.error;
    }

    const cleanDesc = description.trim();
    if (!cleanDesc) {
      nextErrors.description = 'Description is required';
    } else if (cleanDesc.length > 120) {
      nextErrors.description = 'Description must be 120 characters or fewer';
    }

    if (!isCategoryValidForType(category, type)) {
      nextErrors.category = 'Selected category does not match the transaction type';
    }

    const currentToday = getTodayInTimezone(new Date(), timezone);
    if (!txnDate || !isValidISODate(txnDate)) {
      nextErrors.txnDate = 'Enter a valid date (YYYY-MM-DD)';
    } else if (isFutureDate(txnDate, currentToday)) {
      nextErrors.txnDate =
        'Future-dated transactions are not allowed. Use Upcoming Payments for future bills.';
    }

    if (notes.length > 500) {
      nextErrors.notes = 'Notes must be 500 characters or fewer';
    }

    let reimbursableMinor = 0;
    if (type === 'expense' && isSplit) {
      const parsedOwed = parseMoneyToMinor(reimbursableStr);
      if (!parsedOwed.ok) {
        nextErrors.reimbursable = 'Enter the amount owed back to you';
      } else if (parsedMoney.ok && parsedOwed.minor >= parsedMoney.minor) {
        nextErrors.reimbursable =
          'Owed reimbursement must be less than the total bill amount';
      } else {
        reimbursableMinor = parsedOwed.minor;
      }
    }

    if (Object.keys(nextErrors).length > 0 || !parsedMoney.ok) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});

    const payload = {
      type,
      amount_minor: parsedMoney.minor,
      description: cleanDesc,
      category,
      txn_date: txnDate,
      notes: notes.trim() || null,
      payment_method: paymentMethod,
      is_split: type === 'expense' && isSplit,
      split_with: type === 'expense' && isSplit ? splitWith.trim() || null : null,
      reimbursable_minor: type === 'expense' && isSplit ? reimbursableMinor : 0,
      is_reimbursed: type === 'expense' && isSplit ? isReimbursed : false,
    };

    if (isEditing && editingTransaction) {
      await updateMutation.mutateAsync({
        id: editingTransaction.id,
        ...payload,
      });
    } else {
      await createMutation.mutateAsync({
        id: clientUuid,
        ...payload,
      });
    }

    onOpenChange(false);
  };

  const categoryOptions = getCategoriesForType(type).map((c) => ({
    value: c.key,
    label: c.label,
  }));

  const paymentMethodOptions = PAYMENT_METHODS.map((pm) => ({
    value: pm.key,
    label: pm.label,
  }));

  const parsedTotalPreview = parseMoneyToMinor(amountStr);
  const parsedOwedPreview = parseMoneyToMinor(reimbursableStr);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Edit transaction' : 'Add transaction'}
      description={
        isEditing
          ? 'Update the details of this recorded transaction.'
          : 'Record a completed income or expense in INR.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Type Switcher */}
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-primary">Transaction type</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`min-h-[44px] rounded-control border text-sm font-medium transition-colors ${
                type === 'expense'
                  ? 'border-expense bg-expense/15 text-primary font-semibold'
                  : 'border-border bg-card text-muted hover:text-primary'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`min-h-[44px] rounded-control border text-sm font-medium transition-colors ${
                type === 'income'
                  ? 'border-income bg-income/15 text-primary font-semibold'
                  : 'border-border bg-card text-muted hover:text-primary'
              }`}
            >
              Income
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Amount (INR)"
            prefixAddon="₹"
            placeholder="e.g. 1,250.50"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            error={errors.amount}
            required
          />

          <Input
            label="Date"
            type="date"
            max={today}
            value={txnDate}
            onChange={(e) => setTxnDate(e.target.value)}
            error={errors.txnDate}
            required
          />
        </div>

        <Input
          label="Description"
          placeholder="e.g. Monthly Groceries or Client Invoice #12"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={errors.description}
          maxLength={120}
          required
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryKey)}
            options={categoryOptions}
            error={errors.category}
          />

          <Select
            label="Account / Payment mode"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodKey)}
            options={paymentMethodOptions}
          />
        </div>

        {/* Split Bill / Reimbursement Section (only for expenses) */}
        {type === 'expense' && (
          <div className="rounded-control border border-border bg-page/50 p-3.5 space-y-3">
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                <Users className="h-4 w-4 text-[#14533D] dark:text-[#45B883]" />
                Split bill / Friend owes me reimbursement
              </span>
              <input
                type="checkbox"
                checked={isSplit}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsSplit(checked);
                  if (checked && !reimbursableStr && parsedTotalPreview.ok) {
                    const half = Math.round(parsedTotalPreview.minor / 2);
                    if (half > 0) {
                      setReimbursableStr(minorToDecimalString(half, false));
                    }
                  }
                }}
                className="h-4 w-4 rounded border-border accent-[#14533D]"
              />
            </label>

            {isSplit && (
              <div className="space-y-3 pt-1 border-t border-border">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted mr-1">Quick split:</span>
                  {(
                    [
                      { ways: 2, label: '50/50 (2 ways)' },
                      { ways: 3, label: 'Split 3 ways' },
                      { ways: 4, label: 'Split 4 ways' },
                    ] as const
                  ).map((preset) => (
                    <button
                      key={preset.ways}
                      type="button"
                      onClick={() => applySplitPreset(preset.ways)}
                      className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-primary hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="Split with (optional)"
                    placeholder="e.g. Rahul & Priya"
                    value={splitWith}
                    onChange={(e) => setSplitWith(e.target.value)}
                    maxLength={80}
                  />
                  <Input
                    label="Owed back to you (INR)"
                    prefixAddon="₹"
                    placeholder="e.g. 625"
                    value={reimbursableStr}
                    onChange={(e) => setReimbursableStr(e.target.value)}
                    error={errors.reimbursable}
                  />
                </div>

                {parsedTotalPreview.ok &&
                  parsedOwedPreview.ok &&
                  parsedOwedPreview.minor < parsedTotalPreview.minor && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-card px-3 py-2 text-xs border border-border">
                      <span className="text-muted">
                        Your personal share:{' '}
                        <strong className="text-primary tabular-nums">
                          {formatMoney(parsedTotalPreview.minor - parsedOwedPreview.minor)}
                        </strong>
                      </span>
                      <span className="text-income font-semibold tabular-nums">
                        Owed to you: {formatMoney(parsedOwedPreview.minor)}
                      </span>
                    </div>
                  )}

                <label className="flex items-center gap-2 text-xs text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isReimbursed}
                    onChange={(e) => setIsReimbursed(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border accent-[#14533D]"
                  />
                  Mark reimbursement as already settled / received
                </label>
              </div>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="txn-notes-input"
            className="block text-sm font-medium text-primary"
          >
            Notes (optional)
          </label>
          <textarea
            id="txn-notes-input"
            rows={2}
            maxLength={500}
            placeholder="Optional memo or reference..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-control border border-border bg-card px-3.5 py-2 text-sm text-primary placeholder:text-muted/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9E6B]"
          />
          {errors.notes && (
            <p role="alert" className="text-xs font-medium text-expense">
              {errors.notes}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isPending}>
            {isEditing ? 'Save changes' : 'Save transaction'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
