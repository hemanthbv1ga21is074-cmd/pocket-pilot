'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Compass, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { getTodayInTimezone } from '@/lib/finance/dates';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@/components/ui';

type AuthMode = 'signin' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<AuthMode>('signin');
  const [displayName, setDisplayName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDemoLoading, setIsDemoLoading] = React.useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setFormError('Enter a valid email address');
      return;
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = getSupabaseBrowserClient();

      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) {
          setFormError(error.message);
          return;
        }
        toast.success('Signed in to PocketPilot');
        router.push('/overview');
        router.refresh();
        return;
      }

      // Sign up mode
      const nameToSave = displayName.trim() || cleanEmail.split('@')[0] || 'there';
      const signUpRes = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { display_name: nameToSave },
        },
      });

      // If Supabase free-tier SMTP rate limit or email confirmation blocks immediate session in dev,
      // provision the confirmed user via RPC and sign in with password so new account onboarding works immediately.
      if (signUpRes.error || !signUpRes.data.session) {
        const { error: provErr } = await supabase.rpc('provision_auth_user', {
          p_email: cleanEmail,
          p_password: password,
          p_display_name: nameToSave,
          p_is_anonymous: false,
        });
        if (provErr) {
          setFormError(signUpRes.error?.message || provErr.message);
          return;
        }
        const signInAfter = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (signInAfter.error) {
          setFormError(signInAfter.error.message);
          return;
        }
      }

      toast.success('Account created! Welcome to PocketPilot.');
      router.push('/overview');
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTryDemo = async () => {
    setFormError(null);
    setIsDemoLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const anonRes = await supabase.auth.signInAnonymously();

      if (anonRes.error || !anonRes.data.session) {
        // Fallback if anonymous sign-in toggle is still disabled in Supabase dashboard settings
        const demoEmail = `demo.${Date.now()}.${Math.floor(Math.random() * 10000)}@gmail.com`;
        const demoPassword = `DemoPass!${Date.now()}`;
        const { error: provErr } = await supabase.rpc('provision_auth_user', {
          p_email: demoEmail,
          p_password: demoPassword,
          p_display_name: 'Aarav (Demo)',
          p_is_anonymous: true,
        });
        if (provErr) {
          throw new Error(anonRes.error?.message || provErr.message);
        }
        const signInRes = await supabase.auth.signInWithPassword({
          email: demoEmail,
          password: demoPassword,
        });
        if (signInRes.error) {
          throw new Error(signInRes.error.message);
        }
      }

      const today = getTodayInTimezone();
      const { error: seedErr } = await supabase.rpc('seed_sample_data', {
        p_today: today,
      });
      if (seedErr) {
        throw new Error(seedErr.message);
      }

      toast.success('Demo workspace loaded with 4 months of sample data');
      router.push('/overview');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start demo';
      setFormError(message);
      toast.error(message);
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-page px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-card bg-[#0E3B2C] text-white shadow-md">
            <Compass className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-primary">
            PocketPilot
          </h1>
          <p className="mt-1 text-sm text-muted">
            Take control of your money. Plan your next move.
          </p>
        </div>

        <Card className="p-1">
          <CardHeader className="pb-4">
            <div className="grid grid-cols-2 gap-1 rounded-control bg-black/5 p-1 dark:bg-white/5">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setFormError(null);
                }}
                className={`min-h-[40px] rounded-[10px] text-sm font-medium transition-colors ${
                  mode === 'signin'
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setFormError(null);
                }}
                className={`min-h-[40px] rounded-[10px] text-sm font-medium transition-colors ${
                  mode === 'signup'
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                Create account
              </button>
            </div>
            <CardTitle className="pt-3 text-lg">
              {mode === 'signin' ? 'Welcome back' : 'Create your workspace'}
            </CardTitle>
            <CardDescription>
              {mode === 'signin'
                ? 'Sign in with your email and password to access your finances.'
                : 'Built for students, young professionals, and freelancers.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <form onSubmit={handleAuthSubmit} className="space-y-4" noValidate>
              {mode === 'signup' && (
                <Input
                  label="Display name"
                  placeholder="e.g., Aarav Sharma"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                />
              )}

              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />

              <div className="space-y-1">
                <Input
                  label="Password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                />
                {mode === 'signin' && (
                  <div className="flex justify-end pt-1">
                    <Link
                      href="/reset-password"
                      className="text-xs font-medium text-[#14533D] hover:underline dark:text-[#45B883]"
                    >
                      Forgot password?
                    </Link>
                  </div>
                )}
              </div>

              {formError && (
                <div
                  role="alert"
                  className="rounded-control border border-expense/40 bg-expense/10 px-3.5 py-2.5 text-xs font-medium text-expense"
                >
                  {formError}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                isLoading={isSubmitting}
                disabled={isDemoLoading}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </Button>
            </form>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-border" />
              <span className="mx-3 shrink-0 text-xs uppercase tracking-wider text-muted">
                Or explore instantly
              </span>
              <div className="flex-grow border-t border-border" />
            </div>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleTryDemo}
              isLoading={isDemoLoading}
              disabled={isSubmitting}
              leftIcon={<Sparkles className="h-4 w-4" />}
            >
              Try demo
            </Button>

            <div className="flex items-center justify-center gap-2 pt-1 text-xs text-muted">
              <ShieldCheck className="h-4 w-4 text-income shrink-0" aria-hidden="true" />
              <span>Protected by Postgres Row Level Security (RLS)</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
