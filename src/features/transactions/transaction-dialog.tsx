'use client';

import * as React from 'react';
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
  getTodayInTimezone,
  isFutureDate,
  isValidISODate,
  type CategoryKey,
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
  const [txnDate, setTxnDate] = React.useState(today);
  const [notes, setNotes] = React.useState('');

  const [errors, setErrors] = React.useState<{
    amount?: string;
    description?: string;
    category?: string;
    txnDate?: string;
    notes?: string;
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
      setTxnDate(editingTransaction.txn_date);
      setNotes(editingTransaction.notes ?? '');
    } else {
      setClientUuid(crypto.randomUUID());
      setType(initialType);
      setAmountStr('');
      setDescription('');
      setCategory(getDefaultCategoryForType(initialType));
      setTxnDate(getTodayInTimezone(new Date(), timezone));
      setNotes('');
    }
  }, [open, editingTransaction, initialType, timezone]);

  // Rule 13: Changing the type on edit resets an invalid category
  const handleTypeChange = (nextType: TxnType) => {
    setType(nextType);
    setCategory((prev) => resolveCategoryOnTypeChange(prev, nextType));
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

    if (Object.keys(nextErrors).length > 0 || !parsedMoney.ok) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});

    if (isEditing && editingTransaction) {
      await updateMutation.mutateAsync({
        id: editingTransaction.id,
        type,
        amount_minor: parsedMoney.minor,
        description: cleanDesc,
        category,
        txn_date: txnDate,
        notes: notes.trim() || null,
      });
    } else {
      await createMutation.mutateAsync({
        id: clientUuid,
        type,
        amount_minor: parsedMoney.minor,
        description: cleanDesc,
        category,
        txn_date: txnDate,
        notes: notes.trim() || null,
      });
    }

    onOpenChange(false);
  };

  const categoryOptions = getCategoriesForType(type).map((c) => ({
    value: c.key,
    label: c.label,
  }));

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

        <Select
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryKey)}
          options={categoryOptions}
          error={errors.category}
        />

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
