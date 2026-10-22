'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Compass, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@/components/ui';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [hasRecoverySession, setHasRecoverySession] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [sentEmail, setSentEmail] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setHasRecoverySession(true);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasRecoverySession(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo,
      });
      if (resetErr) {
        setError(resetErr.message);
        return;
      }
      setSentEmail(true);
      toast.success('Password reset instructions requested');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request password reset');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateErr) {
        setError(updateErr.message);
        return;
      }
      toast.success('Password updated successfully');
      router.push('/overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-page px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-card bg-[#0E3B2C] text-white shadow-md">
            <Compass className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-primary">
            Reset Password
          </h1>
          <p className="mt-1 text-sm text-muted">
            Recover access to your PocketPilot workspace
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {hasRecoverySession ? 'Choose a new password' : 'Request reset link'}
            </CardTitle>
            <CardDescription>
              {hasRecoverySession
                ? 'Enter a new password for your account.'
                : 'Enter the email address associated with your account.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasRecoverySession ? (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <Input
                  label="New password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  error={error ?? undefined}
                  required
                />
                <Button type="submit" className="w-full" isLoading={isSubmitting}>
                  Update password
                </Button>
              </form>
            ) : sentEmail ? (
              <div className="rounded-control border border-income/30 bg-income/10 p-4 text-sm text-primary space-y-2">
                <div className="flex items-center gap-2 font-semibold text-[#14533D] dark:text-[#6EE7B7]">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>Check your inbox</span>
                </div>
                <p className="text-xs text-muted">
                  If an account exists for <strong className="text-primary">{email}</strong>, a
                  password recovery link has been dispatched via Supabase Auth.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendResetLink} className="space-y-4">
                <Input
                  label="Email address"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={error ?? undefined}
                  required
                />
                <Button type="submit" className="w-full" isLoading={isSubmitting}>
                  Send reset link
                </Button>
              </form>
            )}

            <div className="pt-2 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-primary"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back to sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
