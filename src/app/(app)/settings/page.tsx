'use client';

import * as React from 'react';
import {
  Save,
  Download,
  Sparkles,
  Trash2,
  AlertTriangle,
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
} from '@/components/ui';
import {
  parseMoneyToMinor,
  minorToDecimalString,
  transactionsToCsv,
  type ThemePreference,
} from '@/lib/finance';
import { useTheme } from '@/components/layout/theme-provider';
import {
  useProfile,
  useUpdateProfile,
  useTransactionsRange,
  useBudgets,
  useGoals,
  useRecurringPayments,
  useSeedSampleData,
  useClearSampleData,
  useResetAllData,
  useSampleDataStatus,
} from '@/features/shared/use-finance-data';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { data: profile, isLoading } = useProfile();
  const { data: hasSampleData = false } = useSampleDataStatus();

  const allTxnsQuery = useTransactionsRange();
  const budgetsQuery = useBudgets();
  const goalsQuery = useGoals();
  const paymentsQuery = useRecurringPayments();

  const updateProfileMutation = useUpdateProfile();
  const seedSampleMutation = useSeedSampleData();
  const clearSampleMutation = useClearSampleData();
  const resetAllMutation = useResetAllData();

  const [displayName, setDisplayName] = React.useState('');
  const [currency, setCurrency] = React.useState('INR');
  const [startingBalanceStr, setStartingBalanceStr] = React.useState('0');
  const [overallBudgetStr, setOverallBudgetStr] = React.useState('');
  const [warnPctStr, setWarnPctStr] = React.useState('80');
  const [themePref, setThemePref] = React.useState<ThemePreference>(theme);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [resetConfirmation, setResetConfirmation] = React.useState('');

  React.useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name || 'there');
    setCurrency(profile.currency || 'INR');
    setStartingBalanceStr(
      minorToDecimalString(profile.starting_balance_minor ?? 0, false)
    );
    setOverallBudgetStr(
      profile.overall_monthly_budget_minor
        ? minorToDecimalString(profile.overall_monthly_budget_minor, false)
        : ''
    );
    setWarnPctStr(String(profile.warn_pct ?? 80));
    setThemePref(profile.theme || 'system');
  }, [profile]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = displayName.trim();
    if (!cleanName) {
      setFormError('Display name is required');
      return;
    }

    const parsedStarting = parseMoneyToMinor(startingBalanceStr || '0', {
      allowZero: true,
      allowNegative: true,
    });
    if (!parsedStarting.ok) {
      setFormError(`Starting balance: ${parsedStarting.error}`);
      return;
    }

    let overallMinor: number | null = null;
    if (overallBudgetStr.trim() !== '') {
      const parsedCap = parseMoneyToMinor(overallBudgetStr, { allowZero: false });
      if (!parsedCap.ok) {
        setFormError(`Overall monthly budget cap: ${parsedCap.error}`);
        return;
      }
      overallMinor = parsedCap.minor;
    }

    const warnNum = Number(warnPctStr);
    if (!Number.isInteger(warnNum) || warnNum < 50 || warnNum > 99) {
      setFormError('Warning threshold must be a whole number between 50% and 99%');
      return;
    }

    setTheme(themePref);
    await updateProfileMutation.mutateAsync({
      display_name: cleanName,
      currency,
      starting_balance_minor: parsedStarting.minor,
      overall_monthly_budget_minor: overallMinor,
      warn_pct: warnNum,
      theme: themePref,
    });
  };

  const handleExportAllCsv = () => {
    const txns = allTxnsQuery.data ?? [];
    const csv = transactionsToCsv(txns);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pocketpilot-all-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported all ${txns.length} transactions to CSV`);
  };

  const handleExportAllJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile,
      transactions: allTxnsQuery.data ?? [],
      budgets: budgetsQuery.data ?? [],
      goals: goalsQuery.data?.goals ?? [],
      goalContributions: goalsQuery.data?.contributions ?? [],
      recurringPayments: paymentsQuery.data?.payments ?? [],
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pocketpilot-workspace-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Exported full workspace data to JSON');
  };

  const handleResetAllData = async () => {
    if (resetConfirmation !== 'RESET') return;
    await resetAllMutation.mutateAsync();
    setResetConfirmation('');
    setStartingBalanceStr('0');
    setOverallBudgetStr('');
    setWarnPctStr('80');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Profile & Financial Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Profile & Financial Preferences</CardTitle>
          <CardDescription>
            Customize your display name, starting balance, budget thresholds, and theme.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveSettings} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Display name"
                value={displayName}
                disabled={isLoading}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />

              <Select
                label="Currency preference"
                value={currency}
                disabled={isLoading}
                onChange={(e) => setCurrency(e.target.value)}
                options={[
                  { value: 'INR', label: 'INR (₹ — Indian Rupee)' },
                  { value: 'USD', label: 'USD ($ — US Dollar)' },
                  { value: 'EUR', label: 'EUR (€ — Euro)' },
                  { value: 'GBP', label: 'GBP (£ — British Pound)' },
                ]}
                helperText="Symbol and formatting preference only; stored amounts are not converted."
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                label="Starting balance"
                prefixAddon="₹"
                value={startingBalanceStr}
                disabled={isLoading}
                onChange={(e) => setStartingBalanceStr(e.target.value)}
                helperText="Used for balance corrections"
              />

              <Input
                label="Overall monthly budget cap (optional)"
                prefixAddon="₹"
                placeholder="No cap"
                value={overallBudgetStr}
                disabled={isLoading}
                onChange={(e) => setOverallBudgetStr(e.target.value)}
                helperText="Leave blank to use sum of category limits"
              />

              <Input
                label="Budget warning threshold (%)"
                type="number"
                min={50}
                max={99}
                suffixAddon="%"
                value={warnPctStr}
                disabled={isLoading}
                onChange={(e) => setWarnPctStr(e.target.value)}
                helperText="Between 50% and 99% (default 80%)"
              />
            </div>

            <Select
              label="Appearance Theme"
              value={themePref}
              onChange={(e) => {
                const next = e.target.value as ThemePreference;
                setThemePref(next);
                setTheme(next);
              }}
              options={[
                { value: 'system', label: 'System default' },
                { value: 'light', label: 'Light theme' },
                { value: 'dark', label: 'Dark theme' },
              ]}
            />

            {formError && (
              <p role="alert" className="text-xs font-medium text-expense">
                {formError}
              </p>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="primary"
                leftIcon={<Save className="h-4 w-4" />}
                isLoading={updateProfileMutation.isPending}
              >
                Save settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Full Data Export (CSV & JSON) */}
      <Card>
        <CardHeader>
          <CardTitle>Data Export</CardTitle>
          <CardDescription>
            Export your complete transaction ledger as UTF-8 CSV or download a full JSON backup of your workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={handleExportAllCsv}
          >
            Export all transactions (CSV)
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={handleExportAllJson}
          >
            Export full workspace (JSON)
          </Button>
        </CardContent>
      </Card>

      {/* Sample Data Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Sample Data Controls</CardTitle>
          <CardDescription>
            Load or clear flagged sample rows (`is_sample = true`) without affecting your own manually entered records.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Sparkles className="h-4 w-4" />}
            isLoading={seedSampleMutation.isPending}
            onClick={() =>
              seedSampleMutation.mutate(profile?.timezone || 'Asia/Kolkata')
            }
          >
            {hasSampleData ? 'Reload sample data' : 'Load sample data'}
          </Button>

          {hasSampleData && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Trash2 className="h-4 w-4" />}
              isLoading={clearSampleMutation.isPending}
              onClick={() => clearSampleMutation.mutate()}
            >
              Clear sample data
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone: Reset All Data */}
      <Card className="border-expense/40">
        <CardHeader>
          <div className="flex items-center gap-2 text-expense">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            <CardTitle className="text-expense">Reset All Data</CardTitle>
          </div>
          <CardDescription>
            Permanently delete all transactions, budgets, savings goals, contributions, and upcoming payments, and reset your starting balance to ₹0.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <Input
              label="Type RESET to confirm"
              placeholder="RESET"
              value={resetConfirmation}
              onChange={(e) => setResetConfirmation(e.target.value)}
            />
          </div>
          <Button
            variant="danger"
            disabled={resetConfirmation !== 'RESET' || resetAllMutation.isPending}
            isLoading={resetAllMutation.isPending}
            leftIcon={<Trash2 className="h-4 w-4" />}
            onClick={handleResetAllData}
          >
            Reset all data
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
