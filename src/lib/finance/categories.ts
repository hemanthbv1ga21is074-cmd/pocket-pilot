import type { CategoryKey, ExpenseCategoryKey, IncomeCategoryKey, TxnType } from './types';

export interface CategoryMeta {
  key: CategoryKey;
  label: string;
  type: TxnType;
}

export const EXPENSE_CATEGORIES: ReadonlyArray<{ key: ExpenseCategoryKey; label: string; type: 'expense' }> = [
  { key: 'food_dining', label: 'Food and Dining', type: 'expense' },
  { key: 'transport', label: 'Transport', type: 'expense' },
  { key: 'shopping', label: 'Shopping', type: 'expense' },
  { key: 'bills_utilities', label: 'Bills and Utilities', type: 'expense' },
  { key: 'housing_rent', label: 'Housing and Rent', type: 'expense' },
  { key: 'entertainment', label: 'Entertainment', type: 'expense' },
  { key: 'healthcare', label: 'Healthcare', type: 'expense' },
  { key: 'education', label: 'Education', type: 'expense' },
  { key: 'subscriptions', label: 'Subscriptions', type: 'expense' },
  { key: 'other_expense', label: 'Other', type: 'expense' },
] as const;

export const INCOME_CATEGORIES: ReadonlyArray<{ key: IncomeCategoryKey; label: string; type: 'income' }> = [
  { key: 'salary', label: 'Salary', type: 'income' },
  { key: 'freelance', label: 'Freelance', type: 'income' },
  { key: 'gift', label: 'Gift', type: 'income' },
  { key: 'refund', label: 'Refund', type: 'income' },
  { key: 'other_income', label: 'Other income', type: 'income' },
] as const;

export const ALL_CATEGORIES: ReadonlyArray<CategoryMeta> = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
];

const CATEGORY_MAP = new Map<CategoryKey, CategoryMeta>(
  ALL_CATEGORIES.map((c) => [c.key, c])
);

const EXPENSE_KEY_SET = new Set<string>(EXPENSE_CATEGORIES.map((c) => c.key));
const INCOME_KEY_SET = new Set<string>(INCOME_CATEGORIES.map((c) => c.key));

export function isExpenseCategory(category: string): category is ExpenseCategoryKey {
  return EXPENSE_KEY_SET.has(category);
}

export function isIncomeCategory(category: string): category is IncomeCategoryKey {
  return INCOME_KEY_SET.has(category);
}

export function isCategoryValidForType(category: string, type: TxnType): category is CategoryKey {
  if (type === 'expense') return isExpenseCategory(category);
  return isIncomeCategory(category);
}

export function getCategoriesForType(type: TxnType): ReadonlyArray<CategoryMeta> {
  return type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
}

export function getDefaultCategoryForType(type: TxnType): CategoryKey {
  return type === 'expense' ? 'food_dining' : 'salary';
}

export function resolveCategoryOnTypeChange(
  currentCategory: string,
  nextType: TxnType
): CategoryKey {
  if (isCategoryValidForType(currentCategory, nextType)) {
    return currentCategory;
  }
  return getDefaultCategoryForType(nextType);
}

export function getCategoryLabel(category: CategoryKey | string): string {
  return CATEGORY_MAP.get(category as CategoryKey)?.label ?? category;
}
