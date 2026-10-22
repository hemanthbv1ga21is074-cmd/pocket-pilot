'use client';

import * as React from 'react';
import { Calculator, RotateCcw } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Badge,
  Button,
} from '@/components/ui';
import {
  parseMoneyToMinor,
  formatMoney,
  minorToDecimalString,
  evaluateAffordability,
} from '@/lib/finance';
import { useProfile, useBalanceSummary } from '@/features/shared/use-finance-data';

export default function AffordabilityPage() {
  const { data: profile } = useProfile();
  const { data: balanceSummary, isLoading } = useBalanceSummary();
  const currency = profile?.currency || 'INR';

  const [balanceStr, setBalanceStr] = React.useState('0');
  const [hasUserEditedBalance, setHasUserEditedBalance] = React.useState(false);
  const [purchaseStr, setPurchaseStr] = React.useState('5000');
  const [reserveStr, setReserveStr] = React.useState('10000');

  React.useEffect(() => {
    if (balanceSummary && !hasUserEditedBalance) {
      setBalanceStr(
        minorToDecimalString(balanceSummary.availableToSpendMinor, false)
      );
    }
  }, [balanceSummary, hasUserEditedBalance]);

  const balanceParsed = parseMoneyToMinor(balanceStr, {
    allowZero: true,
    allowNegative: true,
  });
  const purchaseParsed = parseMoneyToMinor(purchaseStr, { allowZero: false });
  const reserveParsed = parseMoneyToMinor(reserveStr, { allowZero: true });

  const calculation = React.useMemo(() => {
    if (!balanceParsed.ok || !purchaseParsed.ok || !reserveParsed.ok) {
      return null;
    }
    return evaluateAffordability({
      balanceMinor: balanceParsed.minor,
      purchaseMinor: purchaseParsed.minor,
      reserveMinor: reserveParsed.minor,
    });
  }, [balanceParsed, purchaseParsed, reserveParsed]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2.5">
              <Calculator
                className="h-5 w-5 text-[#14533D] dark:text-[#45B883]"
                aria-hidden="true"
              />
              <CardTitle>Can I Afford It?</CardTitle>
            </div>
            <CardDescription className="mt-1">
              Evaluate a planned purchase against your available balance and minimum reserve.
              Results are calculated on the fly and are not saved.
            </CardDescription>
          </div>

          {hasUserEditedBalance && balanceSummary && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={() => {
                setHasUserEditedBalance(false);
                setBalanceStr(
                  minorToDecimalString(balanceSummary.availableToSpendMinor, false)
                );
              }}
            >
              Use live Available to spend
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Available balance"
              prefixAddon="₹"
              value={balanceStr}
              disabled={isLoading}
              onChange={(e) => {
                setHasUserEditedBalance(true);
                setBalanceStr(e.target.value);
              }}
              error={!balanceParsed.ok ? balanceParsed.error : undefined}
              helperText="Prefilled with your Available to spend; editable"
            />
            <Input
              label="Purchase amount"
              prefixAddon="₹"
              value={purchaseStr}
              onChange={(e) => setPurchaseStr(e.target.value)}
              error={!purchaseParsed.ok ? purchaseParsed.error : undefined}
              helperText="Must be above ₹0"
            />
            <Input
              label="Minimum reserve"
              prefixAddon="₹"
              value={reserveStr}
              onChange={(e) => setReserveStr(e.target.value)}
              error={!reserveParsed.ok ? reserveParsed.error : undefined}
              helperText="₹0 or more buffer to keep untouched"
            />
          </div>

          {calculation && (
            <div
              data-testid="affordability-result"
              className="rounded-card border border-border bg-page/60 p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-muted">Outcome</span>
                <Badge
                  data-testid="affordability-outcome-badge"
                  variant={
                    calculation.outcome === 'comfortable'
                      ? 'income'
                      : calculation.outcome === 'dips_into_reserve'
                        ? 'warning'
                        : 'expense'
                  }
                >
                  {calculation.label}
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-control border border-border bg-card p-4">
                  <p className="text-xs text-muted">Remaining after purchase</p>
                  <p
                    data-testid="affordability-remaining"
                    className={`mt-1 text-xl font-bold tabular-nums ${
                      calculation.remainingMinor < 0 ? 'text-expense' : 'text-primary'
                    }`}
                  >
                    {formatMoney(calculation.remainingMinor, { currency })}
                  </p>
                </div>

                {calculation.shortfallMinor > 0 && (
                  <div className="rounded-control border border-border bg-card p-4">
                    <p className="text-xs text-muted">
                      {calculation.outcome === 'dips_into_reserve'
                        ? 'Shortfall below minimum reserve'
                        : 'Shortfall below zero'}
                    </p>
                    <p
                      data-testid="affordability-shortfall"
                      className="mt-1 text-xl font-bold tabular-nums text-expense"
                    >
                      {formatMoney(calculation.shortfallMinor, { currency })}
                    </p>
                  </div>
                )}
              </div>

              <p className="text-sm text-primary">{calculation.explanation}</p>
              <p className="text-xs text-muted border-t border-border pt-3">
                {calculation.disclaimer}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
