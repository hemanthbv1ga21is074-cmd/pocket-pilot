'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Sparkles, FilePlus2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell, type ReminderNotification } from './app-shell';
import {
  useProfile,
  useRecurringPayments,
  useSampleDataStatus,
  useSeedSampleData,
  useClearSampleData,
  useUpdateProfile,
} from '@/features/shared/use-finance-data';
import { evaluateAllPayments, getTodayInTimezone } from '@/lib/finance';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useTheme } from './theme-provider';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';

export function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setTheme } = useTheme();

  const { data: profile } = useProfile();
  const { data: paymentsData } = useRecurringPayments();
  const { data: hasSampleData = false } = useSampleDataStatus();

  const seedSampleMutation = useSeedSampleData();
  const clearSampleMutation = useClearSampleData();
  const updateProfileMutation = useUpdateProfile();

  // Sync profile theme preference when loaded
  const syncedThemeRef = React.useRef(false);
  React.useEffect(() => {
    if (profile?.theme && !syncedThemeRef.current) {
      syncedThemeRef.current = true;
      setTheme(profile.theme);
    }
  }, [profile?.theme, setTheme]);

  const reminders: ReminderNotification[] = React.useMemo(() => {
    if (!paymentsData?.payments) return [];
    const today = getTodayInTimezone(new Date(), profile?.timezone || 'Asia/Kolkata');
    const evaluated = evaluateAllPayments(paymentsData.payments, today);
    return evaluated.reminders.map((r) => ({
      id: r.id,
      name: r.name,
      amountMinor: r.amount_minor,
      nextDueDate: r.next_due_date,
      status: r.status === 'overdue' ? 'overdue' : 'due_soon',
      statusLabel: r.statusLabel,
    }));
  }, [paymentsData?.payments, profile?.timezone]);

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    queryClient.clear();
    toast.success('Signed out');
    router.push('/login');
    router.refresh();
  };

  const showFirstRunCard = profile && !profile.onboarded && !hasSampleData;

  return (
    <AppShell
      displayName={profile?.display_name || 'there'}
      userEmail={profile?.email}
      currency={profile?.currency || 'INR'}
      reminders={reminders}
      hasSampleData={hasSampleData}
      onClearSampleData={() => clearSampleMutation.mutate()}
      onReloadSampleData={() =>
        seedSampleMutation.mutate(profile?.timezone || 'Asia/Kolkata')
      }
      isSampleActionPending={
        seedSampleMutation.isPending || clearSampleMutation.isPending
      }
      onSignOut={handleSignOut}
    >
      {/* First-Run Onboarding Card for New Accounts (Section 5) */}
      {showFirstRunCard && (
        <Card
          data-testid="first-run-card"
          className="mb-6 border-2 border-[#2E9E6B]/40 bg-card shadow-md"
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              Welcome to PocketPilot, {profile.display_name}!
            </CardTitle>
            <CardDescription>
              How would you like to initialize your personal finance workspace?
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Sparkles className="h-4 w-4" />}
              isLoading={seedSampleMutation.isPending}
              onClick={() =>
                seedSampleMutation.mutate(profile.timezone || 'Asia/Kolkata')
              }
            >
              Start with sample data
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FilePlus2 className="h-4 w-4" />}
              isLoading={updateProfileMutation.isPending}
              onClick={() => updateProfileMutation.mutate({ onboarded: true })}
            >
              Start empty
            </Button>
          </CardContent>
        </Card>
      )}

      {children}
    </AppShell>
  );
}
