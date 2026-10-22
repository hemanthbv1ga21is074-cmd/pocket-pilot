'use client';

import * as React from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  Plus,
  Search,
  Download,
  Pencil,
  Trash2,
  ArrowUpDown,
  FilterX,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
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
  ALL_CATEGORIES,
  formatMoney,
  formatDisplayDate,
  getCategoryLabel,
  transactionsToCsv,
  type CategoryKey,
  type TransactionRecord,
  type TxnType,
} from '@/lib/finance';
import {
  useProfile,
  usePaginatedTransactions,
  useDeleteTransaction,
  fetchFilteredTransactionsForExport,
} from '@/features/shared/use-finance-data';
import { CategoryIcon } from '@/features/shared/category-icon';
import { TransactionDialog } from '@/features/transactions/transaction-dialog';

export default function TransactionsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data: profile } = useProfile();

  const initialCategoryParam = (searchParams.get('category') as CategoryKey | null) || 'all';
  const newParam = searchParams.get('new') as TxnType | null;

  const [searchInput, setSearchInput] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<TxnType | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = React.useState<CategoryKey | 'all'>(
    initialCategoryParam
  );
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [sortBy, setSortBy] = React.useState<'txn_date' | 'amount_minor'>('txn_date');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [page, setPage] = React.useState(1);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogInitialType, setDialogInitialType] = React.useState<TxnType>('expense');
  const [editingTxn, setEditingTxn] = React.useState<TransactionRecord | null>(null);
  const [deletingTxn, setDeletingTxn] = React.useState<TransactionRecord | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  // Sync URL ?new=income|expense quick action trigger
  React.useEffect(() => {
    if (newParam === 'income' || newParam === 'expense') {
      setEditingTxn(null);
      setDialogInitialType(newParam);
      setDialogOpen(true);
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete('new');
      const qs = nextParams.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [newParam, pathname, router, searchParams]);

  // Debounce search input (250ms)
  React.useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const queryParams = {
    page,
    pageSize: 25,
    search: debouncedSearch,
    type: typeFilter,
    category: categoryFilter,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    sortBy,
    sortDir,
  };

  const { data, isLoading, isError, error, refetch } =
    usePaginatedTransactions(queryParams);
  const deleteMutation = useDeleteTransaction();

  const hasActiveFilters =
    debouncedSearch.trim() !== '' ||
    typeFilter !== 'all' ||
    categoryFilter !== 'all' ||
    startDate !== '' ||
    endDate !== '';

  const clearAllFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setTypeFilter('all');
    setCategoryFilter('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const rows = await fetchFilteredTransactionsForExport({
        search: debouncedSearch,
        type: typeFilter,
        category: categoryFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortBy,
        sortDir,
      });
      const csvContent = transactionsToCsv(rows);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pocketpilot-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} transactions to CSV`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'CSV export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const toggleSort = (field: 'txn_date' | 'amount_minor') => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  const currency = profile?.currency || 'INR';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Transactions Ledger</CardTitle>
            <CardDescription>
              All recorded income and expenses ({data?.totalCount ?? 0} total matching records)
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="h-4 w-4" />}
              isLoading={isExporting}
              onClick={handleExportCsv}
            >
              Export CSV
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setEditingTxn(null);
                setDialogInitialType('expense');
                setDialogOpen(true);
              }}
            >
              Add transaction
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Filter Bar */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <Input
                label="Search description"
                placeholder="Search transactions..."
                prefixAddon={<Search className="h-4 w-4" />}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            <Select
              label="Type"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as TxnType | 'all');
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All types' },
                { value: 'expense', label: 'Expenses only' },
                { value: 'income', label: 'Income only' },
              ]}
            />

            <Select
              label="Category"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value as CategoryKey | 'all');
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All categories' },
                ...ALL_CATEGORIES.map((c) => ({ value: c.key, label: c.label })),
              ]}
            />

            <Input
              label="From date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />

            <Input
              label="To date"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Sort & Active Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-y border-border py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted">Sort by:</span>
              <Button
                variant={sortBy === 'txn_date' ? 'secondary' : 'ghost'}
                size="sm"
                leftIcon={<ArrowUpDown className="h-3.5 w-3.5" />}
                onClick={() => toggleSort('txn_date')}
              >
                Date ({sortBy === 'txn_date' ? (sortDir === 'desc' ? 'Newest' : 'Oldest') : 'Click'})
              </Button>
              <Button
                variant={sortBy === 'amount_minor' ? 'secondary' : 'ghost'}
                size="sm"
                leftIcon={<ArrowUpDown className="h-3.5 w-3.5" />}
                onClick={() => toggleSort('amount_minor')}
              >
                Amount ({sortBy === 'amount_minor' ? (sortDir === 'desc' ? 'High–Low' : 'Low–High') : 'Click'})
              </Button>
            </div>

            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FilterX className="h-4 w-4" />}
                onClick={clearAllFilters}
              >
                Clear filters
              </Button>
            )}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div role="status" className="space-y-3" aria-label="Loading transactions">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Skeleton key={idx} className="h-14 w-full" />
              ))}
            </div>
          )}

          {/* Error State */}
          {isError && (
            <EmptyState
              icon={<AlertCircle className="h-6 w-6 text-expense" />}
              title="Could not load transactions"
              description={
                error instanceof Error ? error.message : 'An unexpected database error occurred.'
              }
              action={
                <Button variant="primary" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              }
            />
          )}

          {/* Empty / No Matches States */}
          {!isLoading && !isError && data && data.rows.length === 0 && (
            hasActiveFilters ? (
              <EmptyState
                icon={<FilterX className="h-6 w-6" />}
                title="No matching transactions"
                description="No records matched your current search or filter criteria."
                action={
                  <Button variant="outline" size="sm" onClick={clearAllFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="No transactions recorded yet"
                description="Add your first income or expense transaction to start tracking your cashflow."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus className="h-4 w-4" />}
                    onClick={() => {
                      setEditingTxn(null);
                      setDialogInitialType('expense');
                      setDialogOpen(true);
                    }}
                  >
                    Add transaction
                  </Button>
                }
              />
            )
          )}

          {/* Desktop Table (>= 768px) & Mobile Card List (< 768px) */}
          {!isLoading && !isError && data && data.rows.length > 0 && (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto rounded-control border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-page/60 text-xs font-semibold uppercase text-muted">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.rows.map((txn) => (
                      <tr
                        key={txn.id}
                        className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="whitespace-nowrap px-4 py-3.5 text-muted tabular-nums">
                          {formatDisplayDate(txn.txn_date)}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-primary">{txn.description}</p>
                          {txn.notes && (
                            <p className="text-xs text-muted truncate max-w-xs">{txn.notes}</p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <span className="inline-flex items-center gap-2 text-sm text-primary">
                            <CategoryIcon category={txn.category} className="h-4 w-4 text-muted" />
                            {getCategoryLabel(txn.category)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <Badge variant={txn.type === 'income' ? 'income' : 'expense'}>
                            {txn.type === 'income' ? 'Income' : 'Expense'}
                          </Badge>
                        </td>
                        <td
                          className={`whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums ${
                            txn.type === 'income' ? 'text-income' : 'text-expense'
                          }`}
                        >
                          {formatMoney(
                            txn.type === 'income' ? txn.amount_minor : -txn.amount_minor,
                            { currency, showPlusSign: true }
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              aria-label={`Edit ${txn.description}`}
                              onClick={() => {
                                setEditingTxn(txn);
                                setDialogOpen(true);
                              }}
                              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-muted hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${txn.description}`}
                              onClick={() => setDeletingTxn(txn)}
                              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-muted hover:bg-expense/10 hover:text-expense"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List (< 768px) */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {data.rows.map((txn) => (
                  <div
                    key={txn.id}
                    className="rounded-control border border-border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0E3B2C]/10 text-[#0E3B2C] dark:bg-white/10 dark:text-[#EDEBE4]">
                          <CategoryIcon category={txn.category} className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-primary truncate">
                            {txn.description}
                          </p>
                          <p className="text-xs text-muted">
                            {getCategoryLabel(txn.category)} • {formatDisplayDate(txn.txn_date)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`text-sm font-bold tabular-nums ${
                            txn.type === 'income' ? 'text-income' : 'text-expense'
                          }`}
                        >
                          {formatMoney(
                            txn.type === 'income' ? txn.amount_minor : -txn.amount_minor,
                            { currency, showPlusSign: true }
                          )}
                        </p>
                        <Badge variant={txn.type === 'income' ? 'income' : 'expense'}>
                          {txn.type === 'income' ? 'Income' : 'Expense'}
                        </Badge>
                      </div>
                    </div>

                    {txn.notes && <p className="text-xs text-muted">{txn.notes}</p>}

                    <div className="flex items-center justify-end gap-2 border-t border-border pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Pencil className="h-3.5 w-3.5" />}
                        onClick={() => {
                          setEditingTxn(txn);
                          setDialogOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-expense"
                        leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => setDeletingTxn(txn)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Server-Side Pagination Controls (25 per page) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="text-xs text-muted">
                  Page <span className="font-semibold text-primary">{page}</span> of{' '}
                  <span className="font-semibold text-primary">{data.totalPages}</span> (
                  {data.totalCount} total records)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    leftIcon={<ChevronLeft className="h-4 w-4" />}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.totalPages}
                    rightIcon={<ChevronRight className="h-4 w-4" />}
                    onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Transaction Dialog */}
      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialType={dialogInitialType}
        editingTransaction={editingTxn}
        timezone={profile?.timezone || 'Asia/Kolkata'}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deletingTxn}
        onOpenChange={(open) => {
          if (!open) setDeletingTxn(null);
        }}
        title="Delete transaction?"
        description="This action permanently removes this transaction and recalculates your balance, budgets, and analytics."
      >
        {deletingTxn && (
          <div className="space-y-4">
            <div className="rounded-control border border-border bg-page/60 p-3.5 text-sm">
              <p className="font-semibold text-primary">{deletingTxn.description}</p>
              <p className="text-xs text-muted mt-0.5">
                {formatDisplayDate(deletingTxn.txn_date)} •{' '}
                {formatMoney(deletingTxn.amount_minor, { currency })}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                onClick={() => setDeletingTxn(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                isLoading={deleteMutation.isPending}
                onClick={async () => {
                  await deleteMutation.mutateAsync(deletingTxn.id);
                  setDeletingTxn(null);
                }}
              >
                Delete transaction
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
