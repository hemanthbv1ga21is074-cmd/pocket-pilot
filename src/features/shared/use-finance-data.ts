'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  computeBalance,
  getTodayInTimezone,
  type BalanceResult,
  type BudgetRecord,
  type CategoryKey,
  type ExpenseCategoryKey,
  type GoalContributionRecord,
  type GoalRecord,
  type PaymentFrequency,
  type RecurringPaymentRecord,
  type ThemePreference,
  type TransactionRecord,
  type TxnType,
} from '@/lib/finance';

export const FINANCE_QUERY_KEY = ['finance'] as const;

export interface UserProfile {
  user_id: string;
  email?: string;
  is_anonymous?: boolean;
  display_name: string;
  currency: string;
  timezone: string;
  starting_balance_minor: number;
  overall_monthly_budget_minor: number | null;
  warn_pct: number;
  theme: ThemePreference;
  onboarded: boolean;
}

export function useProfile() {
  return useQuery({
    queryKey: [...FINANCE_QUERY_KEY, 'profile'],
    queryFn: async (): Promise<UserProfile | null> => {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return null;

      const { data: existing, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw new Error(error.message);

      if (existing) {
        return {
          ...existing,
          theme: (existing.theme as ThemePreference) || 'system',
          starting_balance_minor: Number(existing.starting_balance_minor ?? 0),
          overall_monthly_budget_minor:
            existing.overall_monthly_budget_minor !== null
              ? Number(existing.overall_monthly_budget_minor)
              : null,
          warn_pct: Number(existing.warn_pct ?? 80),
          email: user.email,
          is_anonymous: user.is_anonymous,
        };
      }

      // Create default profile if trigger did not run yet
      const fallbackName =
        (user.user_metadata?.display_name as string | undefined) ||
        user.email?.split('@')[0] ||
        'there';

      const { data: created, error: insertErr } = await supabase
        .from('profiles')
        .insert({
          user_id: user.id,
          display_name: fallbackName,
        })
        .select('*')
        .single();

      if (insertErr) throw new Error(insertErr.message);

      return {
        ...created,
        theme: (created.theme as ThemePreference) || 'system',
        starting_balance_minor: Number(created.starting_balance_minor ?? 0),
        overall_monthly_budget_minor:
          created.overall_monthly_budget_minor !== null
            ? Number(created.overall_monthly_budget_minor)
            : null,
        warn_pct: Number(created.warn_pct ?? 80),
        email: user.email,
        is_anonymous: user.is_anonymous,
      };
    },
  });
}

export function useBalanceSummary() {
  return useQuery({
    queryKey: [...FINANCE_QUERY_KEY, 'balance_summary'],
    queryFn: async (): Promise<BalanceResult> => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.rpc('balance_summary');
      if (error) throw new Error(error.message);

      const row = Array.isArray(data) ? data[0] : data;
      return computeBalance({
        startingBalanceMinor: Number(row?.starting_balance_minor ?? 0),
        totalIncomeMinor: Number(row?.total_income_minor ?? 0),
        totalExpenseMinor: Number(row?.total_expense_minor ?? 0),
        netGoalContributionsMinor: Number(row?.net_goal_contributions_minor ?? 0),
      });
    },
  });
}

export function useTransactionsRange(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: [...FINANCE_QUERY_KEY, 'transactions_range', startDate ?? 'all', endDate ?? 'all'],
    queryFn: async (): Promise<TransactionRecord[]> => {
      const supabase = getSupabaseBrowserClient();
      let query = supabase
        .from('transactions')
        .select('*')
        .order('txn_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('txn_date', startDate);
      }
      if (endDate) {
        query = query.lte('txn_date', endDate);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => ({
        ...row,
        amount_minor: Number(row.amount_minor),
      }));
    },
  });
}

export interface PaginatedTransactionsParams {
  page: number;
  pageSize?: number;
  search?: string;
  type?: TxnType | 'all';
  category?: CategoryKey | 'all';
  startDate?: string;
  endDate?: string;
  sortBy?: 'txn_date' | 'amount_minor';
  sortDir?: 'asc' | 'desc';
}

export function usePaginatedTransactions(params: PaginatedTransactionsParams) {
  const {
    page,
    pageSize = 25,
    search = '',
    type = 'all',
    category = 'all',
    startDate,
    endDate,
    sortBy = 'txn_date',
    sortDir = 'desc',
  } = params;

  return useQuery({
    queryKey: [
      ...FINANCE_QUERY_KEY,
      'transactions_paginated',
      { page, pageSize, search, type, category, startDate, endDate, sortBy, sortDir },
    ],
    queryFn: async (): Promise<{
      rows: TransactionRecord[];
      totalCount: number;
      totalPages: number;
    }> => {
      const supabase = getSupabaseBrowserClient();
      let query = supabase.from('transactions').select('*', { count: 'exact' });

      if (type !== 'all') {
        query = query.eq('type', type);
      }
      if (category !== 'all') {
        query = query.eq('category', category);
      }
      if (startDate) {
        query = query.gte('txn_date', startDate);
      }
      if (endDate) {
        query = query.lte('txn_date', endDate);
      }
      if (search.trim()) {
        query = query.ilike('description', `%${search.trim()}%`);
      }

      query = query
        .order(sortBy, { ascending: sortDir === 'asc' })
        .order('created_at', { ascending: false });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw new Error(error.message);

      const totalCount = count ?? 0;
      const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);

      return {
        rows: (data ?? []).map((r) => ({
          ...r,
          amount_minor: Number(r.amount_minor),
        })),
        totalCount,
        totalPages,
      };
    },
  });
}

export async function fetchFilteredTransactionsForExport(
  params: Omit<PaginatedTransactionsParams, 'page' | 'pageSize'>
): Promise<TransactionRecord[]> {
  const {
    search = '',
    type = 'all',
    category = 'all',
    startDate,
    endDate,
    sortBy = 'txn_date',
    sortDir = 'desc',
  } = params;

  const supabase = getSupabaseBrowserClient();
  let query = supabase.from('transactions').select('*');

  if (type !== 'all') {
    query = query.eq('type', type);
  }
  if (category !== 'all') {
    query = query.eq('category', category);
  }
  if (startDate) {
    query = query.gte('txn_date', startDate);
  }
  if (endDate) {
    query = query.lte('txn_date', endDate);
  }
  if (search.trim()) {
    query = query.ilike('description', `%${search.trim()}%`);
  }

  query = query
    .order(sortBy, { ascending: sortDir === 'asc' })
    .order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    ...r,
    amount_minor: Number(r.amount_minor),
  }));
}

export function useBudgets() {
  return useQuery({
    queryKey: [...FINANCE_QUERY_KEY, 'budgets'],
    queryFn: async (): Promise<BudgetRecord[]> => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .order('category', { ascending: true });
      if (error) throw new Error(error.message);

      return (data ?? []).map((b) => ({
        id: b.id,
        user_id: b.user_id,
        category: b.category as ExpenseCategoryKey,
        limit_minor: Number(b.limit_minor),
        is_sample: b.is_sample,
      }));
    },
  });
}

export function useGoals() {
  return useQuery({
    queryKey: [...FINANCE_QUERY_KEY, 'goals'],
    queryFn: async (): Promise<{
      goals: GoalRecord[];
      contributions: GoalContributionRecord[];
    }> => {
      const supabase = getSupabaseBrowserClient();
      const [goalsRes, contribRes] = await Promise.all([
        supabase.from('goals').select('*').order('created_at', { ascending: true }),
        supabase
          .from('goal_contributions')
          .select('*')
          .order('contributed_on', { ascending: false })
          .order('created_at', { ascending: false }),
      ]);

      if (goalsRes.error) throw new Error(goalsRes.error.message);
      if (contribRes.error) throw new Error(contribRes.error.message);

      return {
        goals: (goalsRes.data ?? []).map((g) => ({
          ...g,
          target_minor: Number(g.target_minor),
        })),
        contributions: (contribRes.data ?? []).map((c) => ({
          ...c,
          amount_minor: Number(c.amount_minor),
        })),
      };
    },
  });
}

export function useRecurringPayments() {
  return useQuery({
    queryKey: [...FINANCE_QUERY_KEY, 'recurring_payments'],
    queryFn: async (): Promise<{
      payments: RecurringPaymentRecord[];
      paidTransactions: TransactionRecord[];
    }> => {
      const supabase = getSupabaseBrowserClient();
      const [paymentsRes, paidTxnsRes] = await Promise.all([
        supabase
          .from('recurring_payments')
          .select('*')
          .order('next_due_date', { ascending: true }),
        supabase
          .from('transactions')
          .select('*')
          .not('recurring_payment_id', 'is', null)
          .order('txn_date', { ascending: false })
          .order('created_at', { ascending: false }),
      ]);

      if (paymentsRes.error) throw new Error(paymentsRes.error.message);
      if (paidTxnsRes.error) throw new Error(paidTxnsRes.error.message);

      return {
        payments: (paymentsRes.data ?? []).map((p) => ({
          ...p,
          category: p.category as ExpenseCategoryKey,
          amount_minor: Number(p.amount_minor),
          anchor_day: Number(p.anchor_day),
        })),
        paidTransactions: (paidTxnsRes.data ?? []).map((t) => ({
          ...t,
          amount_minor: Number(t.amount_minor),
        })),
      };
    },
  });
}

export function useSampleDataStatus() {
  return useQuery({
    queryKey: [...FINANCE_QUERY_KEY, 'sample_status'],
    queryFn: async (): Promise<boolean> => {
      const supabase = getSupabaseBrowserClient();
      const [tRes, bRes, gRes, pRes] = await Promise.all([
        supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('is_sample', true),
        supabase.from('budgets').select('id', { count: 'exact', head: true }).eq('is_sample', true),
        supabase.from('goals').select('id', { count: 'exact', head: true }).eq('is_sample', true),
        supabase
          .from('recurring_payments')
          .select('id', { count: 'exact', head: true })
          .eq('is_sample', true),
      ]);

      const totalSampleRows =
        (tRes.count ?? 0) + (bRes.count ?? 0) + (gRes.count ?? 0) + (pRes.count ?? 0);
      return totalSampleRows > 0;
    },
  });
}

// ---------------------------------------------------------------------------
// MUTATIONS (all invalidate FINANCE_QUERY_KEY so every view updates atomically)
// ---------------------------------------------------------------------------

export function useSeedSampleData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (timezone?: string) => {
      const supabase = getSupabaseBrowserClient();
      const today = getTodayInTimezone(new Date(), timezone || 'Asia/Kolkata');
      const { error } = await supabase.rpc('seed_sample_data', { p_today: today });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
      toast.success('Sample data loaded');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to load sample data');
    },
  });
}

export function useClearSampleData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc('clear_sample_data');
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
      toast.success('Sample data cleared');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to clear sample data');
    },
  });
}

export function useResetAllData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc('reset_all_data');
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
      toast.success('All workspace data has been reset');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to reset workspace data');
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: {
      display_name?: string;
      currency?: string;
      timezone?: string;
      starting_balance_minor?: number;
      overall_monthly_budget_minor?: number | null;
      warn_pct?: number;
      theme?: ThemePreference;
      onboarded?: boolean;
    }) => {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
      toast.success('Settings saved');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save settings');
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string; // Client-generated UUID for idempotent submit (Rule 12)
      type: TxnType;
      amount_minor: number;
      description: string;
      category: CategoryKey;
      txn_date: string;
      notes?: string | null;
    }) => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          id: input.id,
          type: input.type,
          amount_minor: input.amount_minor,
          description: input.description.trim(),
          category: input.category,
          txn_date: input.txn_date,
          notes: input.notes?.trim() || null,
          is_sample: false,
        })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
      toast.success('Transaction added');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to add transaction');
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      type: TxnType;
      amount_minor: number;
      description: string;
      category: CategoryKey;
      txn_date: string;
      notes?: string | null;
    }) => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('transactions')
        .update({
          type: input.type,
          amount_minor: input.amount_minor,
          description: input.description.trim(),
          category: input.category,
          txn_date: input.txn_date,
          notes: input.notes?.trim() || null,
        })
        .eq('id', input.id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
      toast.success('Transaction updated');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update transaction');
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
      toast.success('Transaction deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete transaction');
    },
  });
}

export function useUpsertBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      category: ExpenseCategoryKey;
      limit_minor: number;
    }) => {
      const supabase = getSupabaseBrowserClient();
      if (input.id) {
        const { data, error } = await supabase
          .from('budgets')
          .update({
            limit_minor: input.limit_minor,
            is_sample: false,
          })
          .eq('id', input.id)
          .select('*')
          .single();
        if (error) throw new Error(error.message);
        return data;
      }

      const { data, error } = await supabase
        .from('budgets')
        .insert({
          category: input.category,
          limit_minor: input.limit_minor,
          is_sample: false,
        })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
      toast.success(variables.id ? 'Budget limit updated' : 'Category budget created');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save budget');
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from('budgets').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
      toast.success('Budget removed');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete budget');
    },
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      target_minor: number;
      target_date?: string | null;
      description?: string | null;
      opening_contribution_minor?: number;
      contributed_on?: string;
    }) => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.rpc('create_goal', {
        p_name: input.name.trim(),
        p_target_minor: input.target_minor,
        p_target_date: input.target_date || undefined,
        p_description: input.description?.trim() || undefined,
        p_opening_contribution_minor: input.opening_contribution_minor ?? 0,
        p_contributed_on: input.contributed_on ?? getTodayInTimezone(),
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
      toast.success('Savings goal created');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create savings goal');
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name: string;
      target_minor: number;
      target_date?: string | null;
      description?: string | null;
    }) => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('goals')
        .update({
          name: input.name.trim(),
          target_minor: input.target_minor,
          target_date: input.target_date || null,
          description: input.description?.trim() || null,
        })
        .eq('id', input.id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
      toast.success('Savings goal updated');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update savings goal');
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from('goals').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
      toast.success('Goal deleted and funds returned to Available to spend');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete goal');
    },
  });
}

export function useAddGoalContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      goal_id: string;
      amount_minor: number; // positive = contribution, negative = withdrawal
      on_date: string;
      note?: string | null;
    }) => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.rpc('add_goal_contribution', {
        p_goal_id: input.goal_id,
        p_amount_minor: input.amount_minor,
        p_on_date: input.on_date,
        p_note: input.note?.trim() || undefined,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
      toast.success(vars.amount_minor > 0 ? 'Contribution added to goal' : 'Withdrawal completed');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to record goal movement');
    },
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      amount_minor: number;
      category: ExpenseCategoryKey;
      frequency: PaymentFrequency;
      next_due_date: string;
      anchor_day: number;
    }) => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('recurring_payments')
        .insert({
          name: input.name.trim(),
          amount_minor: input.amount_minor,
          category: input.category,
          frequency: input.frequency,
          next_due_date: input.next_due_date,
          anchor_day: input.anchor_day,
          is_paid: false,
          is_sample: false,
        })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
      toast.success('Upcoming payment scheduled');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to schedule payment');
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name: string;
      amount_minor: number;
      category: ExpenseCategoryKey;
      frequency: PaymentFrequency;
      next_due_date: string;
      anchor_day: number;
    }) => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('recurring_payments')
        .update({
          name: input.name.trim(),
          amount_minor: input.amount_minor,
          category: input.category,
          frequency: input.frequency,
          next_due_date: input.next_due_date,
          anchor_day: input.anchor_day,
        })
        .eq('id', input.id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
      toast.success('Payment updated');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update payment');
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from('recurring_payments').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
      toast.success('Scheduled payment deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete payment');
    },
  });
}

export function useMarkPaymentPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      payment_id: string;
      paid_on: string;
      amount_minor: number;
    }) => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.rpc('mark_payment_paid', {
        p_payment_id: input.payment_id,
        p_paid_on: input.paid_on,
        p_amount_minor: input.amount_minor,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
      toast.success('Payment marked as paid and expense recorded');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to mark payment as paid');
    },
  });
}

export function useUndoLastPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payment_id: string) => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.rpc('undo_last_payment', {
        p_payment_id: payment_id,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
      toast.success('Payment undone and linked expense deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to undo payment');
    },
  });
}
