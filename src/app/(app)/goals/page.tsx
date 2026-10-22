'use client';

import * as React from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  Target,
  AlertCircle,
  History,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Badge,
  Progress,
  Skeleton,
  EmptyState,
  Dialog,
} from '@/components/ui';
import {
  evaluateGoal,
  validateGoalContribution,
  formatMoney,
  formatDisplayDate,
  parseMoneyToMinor,
  minorToDecimalString,
  getTodayInTimezone,
  type EvaluatedGoal,
} from '@/lib/finance';
import {
  useProfile,
  useBalanceSummary,
  useGoals,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  useAddGoalContribution,
} from '@/features/shared/use-finance-data';

export default function GoalsPage() {
  const { data: profile } = useProfile();
  const timezone = profile?.timezone || 'Asia/Kolkata';
  const currency = profile?.currency || 'INR';
  const today = getTodayInTimezone(new Date(), timezone);

  const balanceQuery = useBalanceSummary();
  const goalsQuery = useGoals();

  const createGoalMutation = useCreateGoal();
  const updateGoalMutation = useUpdateGoal();
  const deleteGoalMutation = useDeleteGoal();
  const addContributionMutation = useAddGoalContribution();

  // Create / Edit Goal Dialog State
  const [goalDialogOpen, setGoalDialogOpen] = React.useState(false);
  const [editingGoal, setEditingGoal] = React.useState<EvaluatedGoal | null>(null);
  const [nameInput, setNameInput] = React.useState('');
  const [targetStr, setTargetStr] = React.useState('');
  const [targetDateInput, setTargetDateInput] = React.useState('');
  const [descInput, setDescInput] = React.useState('');
  const [openingStr, setOpeningStr] = React.useState('');
  const [goalFormError, setGoalFormError] = React.useState<string | null>(null);

  // Contribute / Withdraw Dialog State
  const [movementGoal, setMovementGoal] = React.useState<EvaluatedGoal | null>(null);
  const [movementType, setMovementType] = React.useState<'contribute' | 'withdraw'>(
    'contribute'
  );
  const [movementAmountStr, setMovementAmountStr] = React.useState('');
  const [movementDate, setMovementDate] = React.useState(today);
  const [movementNote, setMovementNote] = React.useState('');
  const [movementError, setMovementError] = React.useState<string | null>(null);

  // Delete Confirmation State
  const [deletingGoal, setDeletingGoal] = React.useState<EvaluatedGoal | null>(null);

  const availableToSpendMinor = balanceQuery.data?.availableToSpendMinor ?? 0;
  const goals = goalsQuery.data?.goals ?? [];
  const contributions = goalsQuery.data?.contributions ?? [];

  const evaluatedGoals = React.useMemo(
    () => goals.map((g) => evaluateGoal(g, contributions, today)),
    [goals, contributions, today]
  );

  const openCreateGoal = () => {
    setEditingGoal(null);
    setNameInput('');
    setTargetStr('');
    setTargetDateInput('');
    setDescInput('');
    setOpeningStr('');
    setGoalFormError(null);
    setGoalDialogOpen(true);
  };

  const openEditGoal = (g: EvaluatedGoal) => {
    setEditingGoal(g);
    setNameInput(g.name);
    setTargetStr(minorToDecimalString(g.targetMinor, false));
    setTargetDateInput(g.targetDate ?? '');
    setDescInput(g.description ?? '');
    setOpeningStr('');
    setGoalFormError(null);
    setGoalDialogOpen(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoalFormError(null);

    const cleanName = nameInput.trim();
    if (!cleanName || cleanName.length > 80) {
      setGoalFormError('Goal name is required (1–80 characters)');
      return;
    }

    const parsedTarget = parseMoneyToMinor(targetStr);
    if (!parsedTarget.ok) {
      setGoalFormError(parsedTarget.error);
      return;
    }

    let openingMinor = 0;
    if (!editingGoal && openingStr.trim() !== '') {
      const parsedOpening = parseMoneyToMinor(openingStr, { allowZero: true });
      if (!parsedOpening.ok) {
        setGoalFormError(parsedOpening.error);
        return;
      }
      if (parsedOpening.minor > availableToSpendMinor) {
        setGoalFormError(
          'Opening contribution exceeds your Available to spend balance'
        );
        return;
      }
      openingMinor = parsedOpening.minor;
    }

    if (editingGoal) {
      await updateGoalMutation.mutateAsync({
        id: editingGoal.id,
        name: cleanName,
        target_minor: parsedTarget.minor,
        target_date: targetDateInput || null,
        description: descInput.trim() || null,
      });
    } else {
      await createGoalMutation.mutateAsync({
        name: cleanName,
        target_minor: parsedTarget.minor,
        target_date: targetDateInput || null,
        description: descInput.trim() || null,
        opening_contribution_minor: openingMinor,
        contributed_on: today,
      });
    }

    setGoalDialogOpen(false);
  };

  const openMovementDialog = (
    goal: EvaluatedGoal,
    type: 'contribute' | 'withdraw'
  ) => {
    setMovementGoal(goal);
    setMovementType(type);
    setMovementAmountStr('');
    setMovementDate(today);
    setMovementNote('');
    setMovementError(null);
  };

  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementGoal) return;
    setMovementError(null);

    const parsed = parseMoneyToMinor(movementAmountStr);
    if (!parsed.ok) {
      setMovementError(parsed.error);
      return;
    }

    const signedMinor =
      movementType === 'contribute' ? parsed.minor : -parsed.minor;

    const validation = validateGoalContribution(
      signedMinor,
      availableToSpendMinor,
      movementGoal.savedMinor
    );

    if (!validation.ok) {
      setMovementError(validation.error);
      return;
    }

    await addContributionMutation.mutateAsync({
      goal_id: movementGoal.id,
      amount_minor: signedMinor,
      on_date: movementDate || today,
      note: movementNote.trim() || null,
    });

    setMovementGoal(null);
  };

  const isLoading = goalsQuery.isLoading || balanceQuery.isLoading;
  const isError = goalsQuery.isError;

  return (
    <div className="space-y-6">
      {/* Header & Available Balance Context */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-primary">Savings Goals</h2>
          <p className="text-sm text-muted">
            Available to spend:{' '}
            <strong className="tabular-nums text-primary">
              {formatMoney(availableToSpendMinor, { currency })}
            </strong>{' '}
            • Total set aside in goals:{' '}
            <strong className="tabular-nums text-income">
              {formatMoney(balanceQuery.data?.setAsideMinor ?? 0, { currency })}
            </strong>
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={openCreateGoal}
        >
          New goal
        </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      )}

      {isError && (
        <EmptyState
          icon={<AlertCircle className="h-6 w-6 text-expense" />}
          title="Could not load savings goals"
          description="An error occurred while fetching your savings goals."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => goalsQuery.refetch()}
            >
              Retry
            </Button>
          }
        />
      )}

      {!isLoading && !isError && evaluatedGoals.length === 0 && (
        <EmptyState
          icon={<Target className="h-6 w-6" />}
          title="No savings goals yet"
          description="Create a savings goal with an optional target date to calculate your required monthly contribution."
          action={
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={openCreateGoal}
            >
              Create goal
            </Button>
          }
        />
      )}

      {!isLoading && !isError && evaluatedGoals.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {evaluatedGoals.map((goal) => {
            const goalContribs = contributions.filter((c) => c.goal_id === goal.id);
            return (
              <Card
                key={goal.id}
                data-testid={`goal-card-${goal.id}`}
                className="flex flex-col justify-between"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">{goal.name}</CardTitle>
                      {goal.description && (
                        <CardDescription className="mt-0.5">
                          {goal.description}
                        </CardDescription>
                      )}
                    </div>
                    <Badge
                      variant={
                        goal.state === 'reached'
                          ? 'success'
                          : goal.state === 'past_due'
                            ? 'warning'
                            : 'income'
                      }
                    >
                      {goal.stateLabel} ({goal.progressPct.toFixed(0)}%)
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <Progress
                    value={goal.progressPct}
                    tone={goal.state === 'past_due' ? 'approaching' : 'normal'}
                    label={`${goal.name} savings progress`}
                  />

                  <div className="grid grid-cols-3 gap-2 rounded-control border border-border bg-page/50 p-3 text-xs sm:text-sm">
                    <div>
                      <p className="text-xs text-muted">Saved</p>
                      <p className="font-bold tabular-nums text-income">
                        {formatMoney(goal.savedMinor, { currency })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Target</p>
                      <p className="font-bold tabular-nums text-primary">
                        {formatMoney(goal.targetMinor, { currency })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Remaining</p>
                      <p className="font-bold tabular-nums text-primary">
                        {formatMoney(goal.remainingMinor, { currency })}
                      </p>
                    </div>
                  </div>

                  {/* Target Date & Required Monthly Contribution (Rule 6) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                    <span>
                      Target date:{' '}
                      <strong className="text-primary">
                        {goal.targetDate
                          ? formatDisplayDate(goal.targetDate)
                          : 'No target date'}
                      </strong>
                    </span>
                    {goal.requiredMonthlyMinor !== null && (
                      <span>
                        Required monthly:{' '}
                        <strong className="tabular-nums text-primary">
                          {formatMoney(goal.requiredMonthlyMinor, { currency })}/mo
                        </strong>
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<ArrowUpRight className="h-4 w-4" />}
                        onClick={() => openMovementDialog(goal, 'contribute')}
                      >
                        Contribute
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={goal.savedMinor <= 0}
                        leftIcon={<ArrowDownLeft className="h-4 w-4" />}
                        onClick={() => openMovementDialog(goal, 'withdraw')}
                      >
                        Withdraw
                      </Button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Edit ${goal.name}`}
                        onClick={() => openEditGoal(goal)}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-muted hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${goal.name}`}
                        onClick={() => setDeletingGoal(goal)}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-muted hover:bg-expense/10 hover:text-expense"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Contribution History per Goal */}
                  <div className="border-t border-border pt-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                      <History className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Contribution history ({goalContribs.length})</span>
                    </div>
                    {goalContribs.length === 0 ? (
                      <p className="text-xs text-muted">No contributions recorded yet.</p>
                    ) : (
                      <ul className="divide-y divide-border max-h-36 overflow-y-auto text-xs">
                        {goalContribs.map((c) => (
                          <li
                            key={c.id}
                            className="flex items-center justify-between py-1.5 gap-2"
                          >
                            <div className="min-w-0">
                              <span className="font-medium text-primary">
                                {formatDisplayDate(c.contributed_on)}
                              </span>
                              {c.note && (
                                <span className="ml-2 text-muted truncate">
                                  • {c.note}
                                </span>
                              )}
                            </div>
                            <span
                              className={`font-semibold tabular-nums shrink-0 ${
                                c.amount_minor > 0 ? 'text-income' : 'text-expense'
                              }`}
                            >
                              {formatMoney(c.amount_minor, {
                                currency,
                                showPlusSign: true,
                              })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Goal Dialog */}
      <Dialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        title={editingGoal ? 'Edit savings goal' : 'Create savings goal'}
        description="Set a target amount and optional target date to track your progress."
      >
        <form onSubmit={handleSaveGoal} className="space-y-4" noValidate>
          <Input
            label="Goal name"
            placeholder="e.g. Emergency Cushion or Laptop Upgrade"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            maxLength={80}
            required
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Target amount (INR)"
              prefixAddon="₹"
              placeholder="e.g. 1,50,000"
              value={targetStr}
              onChange={(e) => setTargetStr(e.target.value)}
              required
            />
            <Input
              label="Target date (optional)"
              type="date"
              value={targetDateInput}
              onChange={(e) => setTargetDateInput(e.target.value)}
            />
          </div>

          {!editingGoal && (
            <Input
              label="Opening contribution (optional, INR)"
              prefixAddon="₹"
              placeholder="0"
              value={openingStr}
              onChange={(e) => setOpeningStr(e.target.value)}
              helperText={`Available to spend: ${formatMoney(availableToSpendMinor, { currency })}`}
            />
          )}

          <Input
            label="Description (optional)"
            placeholder="Short note about this goal..."
            value={descInput}
            onChange={(e) => setDescInput(e.target.value)}
            maxLength={300}
          />

          {goalFormError && (
            <p role="alert" className="text-xs font-medium text-expense">
              {goalFormError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setGoalDialogOpen(false)}
              disabled={createGoalMutation.isPending || updateGoalMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={createGoalMutation.isPending || updateGoalMutation.isPending}
            >
              {editingGoal ? 'Save changes' : 'Create goal'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Contribute / Withdraw Dialog */}
      <Dialog
        open={!!movementGoal}
        onOpenChange={(open) => {
          if (!open) setMovementGoal(null);
        }}
        title={
          movementType === 'contribute'
            ? `Contribute to ${movementGoal?.name ?? ''}`
            : `Withdraw from ${movementGoal?.name ?? ''}`
        }
        description={
          movementType === 'contribute'
            ? `Move funds from your Available to spend balance (${formatMoney(availableToSpendMinor, { currency })}) into this goal.`
            : `Return funds from this goal (currently saved: ${formatMoney(movementGoal?.savedMinor ?? 0, { currency })}) to your Available to spend balance.`
        }
      >
        <form onSubmit={handleSaveMovement} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Amount (INR)"
              prefixAddon="₹"
              placeholder="e.g. 5,000"
              value={movementAmountStr}
              onChange={(e) => setMovementAmountStr(e.target.value)}
              error={movementError ?? undefined}
              required
            />
            <Input
              label="Date"
              type="date"
              max={today}
              value={movementDate}
              onChange={(e) => setMovementDate(e.target.value)}
              required
            />
          </div>

          <Input
            label="Note (optional)"
            placeholder="e.g. Monthly allocation"
            value={movementNote}
            onChange={(e) => setMovementNote(e.target.value)}
            maxLength={200}
          />

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMovementGoal(null)}
              disabled={addContributionMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={addContributionMutation.isPending}
            >
              {movementType === 'contribute' ? 'Confirm contribution' : 'Confirm withdrawal'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Goal Confirmation Dialog (Rule 6) */}
      <Dialog
        open={!!deletingGoal}
        onOpenChange={(open) => {
          if (!open) setDeletingGoal(null);
        }}
        title="Delete savings goal?"
        description="Deleting a goal removes all of its contribution records and returns the saved money to your Available to spend balance."
      >
        {deletingGoal && (
          <div className="space-y-4">
            <div className="rounded-control border border-border bg-page/60 p-3.5 text-sm">
              <p className="font-semibold text-primary">{deletingGoal.name}</p>
              <p className="text-xs text-muted mt-1">
                Saved amount returning to Available to spend:{' '}
                <strong className="tabular-nums text-income">
                  {formatMoney(deletingGoal.savedMinor, { currency })}
                </strong>
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                onClick={() => setDeletingGoal(null)}
                disabled={deleteGoalMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                isLoading={deleteGoalMutation.isPending}
                onClick={async () => {
                  await deleteGoalMutation.mutateAsync(deletingGoal.id);
                  setDeletingGoal(null);
                }}
              >
                Delete goal & return funds
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
