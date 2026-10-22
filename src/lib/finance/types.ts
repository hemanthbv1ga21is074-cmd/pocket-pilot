export type TxnType = 'income' | 'expense';

export type PaymentFrequency = 'once' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type ExpenseCategoryKey =
  | 'food_dining'
  | 'transport'
  | 'shopping'
  | 'bills_utilities'
  | 'housing_rent'
  | 'entertainment'
  | 'healthcare'
  | 'education'
  | 'subscriptions'
  | 'other_expense';

export type IncomeCategoryKey =
  | 'salary'
  | 'freelance'
  | 'gift'
  | 'refund'
  | 'other_income';

export type CategoryKey = ExpenseCategoryKey | IncomeCategoryKey;

export type PeriodKey =
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'this_year'
  | 'custom';

export type ThemePreference = 'light' | 'dark' | 'system';

export interface TransactionRecord {
  id: string;
  user_id?: string;
  type: TxnType;
  amount_minor: number;
  description: string;
  category: CategoryKey;
  txn_date: string; // YYYY-MM-DD
  notes?: string | null;
  recurring_payment_id?: string | null;
  is_sample?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface BudgetRecord {
  id: string;
  user_id?: string;
  category: ExpenseCategoryKey;
  limit_minor: number;
  is_sample?: boolean;
}

export interface GoalRecord {
  id: string;
  user_id?: string;
  name: string;
  target_minor: number;
  target_date?: string | null; // YYYY-MM-DD
  description?: string | null;
  is_sample?: boolean;
  created_at?: string;
}

export interface GoalContributionRecord {
  id: string;
  goal_id: string;
  user_id?: string;
  amount_minor: number; // positive = contribution, negative = withdrawal
  contributed_on: string; // YYYY-MM-DD
  note?: string | null;
  created_at?: string;
}

export interface RecurringPaymentRecord {
  id: string;
  user_id?: string;
  name: string;
  amount_minor: number;
  category: ExpenseCategoryKey;
  frequency: PaymentFrequency;
  next_due_date: string; // YYYY-MM-DD
  anchor_day: number; // 1..31
  is_paid: boolean;
  last_paid_txn_id?: string | null;
  due_date_before_last_payment?: string | null;
  is_sample?: boolean;
  created_at?: string;
}

export interface BalanceSummaryInput {
  startingBalanceMinor: number;
  totalIncomeMinor: number;
  totalExpenseMinor: number;
  netGoalContributionsMinor: number;
}

export interface BalanceResult {
  startingBalanceMinor: number;
  totalIncomeMinor: number;
  totalExpenseMinor: number;
  totalBalanceMinor: number;
  setAsideMinor: number;
  availableToSpendMinor: number;
}
