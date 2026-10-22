/**
 * PocketPilot Row Level Security (RLS) Verification Script
 * Section 10:
 * "RLS test script: two real users, proving that neither can select, insert with the other's user_id,
 *  update or delete the other's rows on every table."
 *
 * Run via: npm run test:rls
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as crypto from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/supabase/database.types';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`RLS ASSERTION FAILED: ${message}`);
  }
}

async function authenticateTestUser(
  client: SupabaseClient<Database>,
  label: string
): Promise<{ id: string }> {
  // Try anonymous sign-in first (since demo mode uses anonymous sign-in), fallback to email sign-up
  const anonRes = await client.auth.signInAnonymously();
  if (!anonRes.error && anonRes.data.user) {
    console.log(`✓ Authenticated ${label} via anonymous sign-in (${anonRes.data.user.id})`);
    return { id: anonRes.data.user.id };
  }

  const uniqueEmail = `pocketpilot.rls.${label.toLowerCase()}.${Date.now()}.${Math.floor(Math.random() * 10000)}@gmail.com`;
  const password = `RlsTestPass!${crypto.randomUUID()}`;

  // Provision confirmed user in auth.users and sign in with password to obtain a genuine Supabase JWT session
  const { error: provErr } = await client.rpc('provision_auth_user', {
    p_email: uniqueEmail,
    p_password: password,
    p_display_name: `User ${label}`,
    p_is_anonymous: false,
  });

  if (provErr) {
    throw new Error(`Failed to provision ${label}: ${provErr.message}`);
  }

  const signInRes = await client.auth.signInWithPassword({
    email: uniqueEmail,
    password,
  });

  if (signInRes.error || !signInRes.data.user || !signInRes.data.session) {
    throw new Error(
      `Failed to sign in ${label}: ${signInRes.error?.message ?? 'No session returned'}`
    );
  }

  console.log(`✓ Authenticated ${label} via Supabase Auth JWT (${signInRes.data.user.id})`);
  return { id: signInRes.data.user.id };
}

async function runRlsVerification() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    );
  }

  console.log('Starting PocketPilot RLS Verification across all 6 tables...');

  const clientA = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const clientB = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userA = await authenticateTestUser(clientA, 'UserA');
  const userB = await authenticateTestUser(clientB, 'UserB');
  assert(userA.id !== userB.id, 'User A and User B must have distinct UUIDs');

  // ---------------------------------------------------------------------------
  // 1. PROFILES TABLE
  // ---------------------------------------------------------------------------
  console.log('\n[1/6] Testing RLS on public.profiles...');
  const { data: profileA, error: profAErr } = await clientA
    .from('profiles')
    .select('*')
    .eq('user_id', userA.id)
    .single();
  assert(!profAErr && profileA?.user_id === userA.id, 'User A can select own profile');

  // User B cannot select User A's profile
  const { data: bSelectAProfile } = await clientB
    .from('profiles')
    .select('*')
    .eq('user_id', userA.id);
  assert(
    Array.isArray(bSelectAProfile) && bSelectAProfile.length === 0,
    'User B cannot SELECT User A profile'
  );

  // User B cannot insert a profile with User A's user_id
  const { error: bInsertAProfileErr } = await clientB.from('profiles').insert({
    user_id: userA.id,
    display_name: 'Hacked by B',
  });
  assert(!!bInsertAProfileErr, 'User B cannot INSERT profile with User A user_id');

  // User B cannot update User A's profile
  const { data: bUpdateAProfile } = await clientB
    .from('profiles')
    .update({ display_name: 'Mutated by B' })
    .eq('user_id', userA.id)
    .select();
  assert(
    !bUpdateAProfile || bUpdateAProfile.length === 0,
    'User B cannot UPDATE User A profile'
  );

  // User B cannot delete User A's profile
  const { data: bDeleteAProfile } = await clientB
    .from('profiles')
    .delete()
    .eq('user_id', userA.id)
    .select();
  assert(
    !bDeleteAProfile || bDeleteAProfile.length === 0,
    'User B cannot DELETE User A profile'
  );

  // ---------------------------------------------------------------------------
  // 2. RECURRING_PAYMENTS TABLE
  // ---------------------------------------------------------------------------
  console.log('[2/6] Testing RLS on public.recurring_payments...');
  const { data: paymentA, error: payAErr } = await clientA
    .from('recurring_payments')
    .insert({
      user_id: userA.id,
      name: 'User A Rent',
      amount_minor: 2000000,
      category: 'housing_rent',
      frequency: 'monthly',
      next_due_date: '2026-10-25',
      anchor_day: 25,
    })
    .select()
    .single();
  assert(!payAErr && paymentA, `User A created recurring_payment: ${payAErr?.message}`);

  const { data: bSelectAPayment } = await clientB
    .from('recurring_payments')
    .select('*')
    .eq('id', paymentA.id);
  assert(
    Array.isArray(bSelectAPayment) && bSelectAPayment.length === 0,
    'User B cannot SELECT User A recurring_payment'
  );

  const { error: bInsertAPaymentErr } = await clientB.from('recurring_payments').insert({
    user_id: userA.id,
    name: 'Spoofed Payment',
    amount_minor: 50000,
    category: 'subscriptions',
    frequency: 'monthly',
    next_due_date: '2026-10-25',
    anchor_day: 25,
  });
  assert(!!bInsertAPaymentErr, 'User B cannot INSERT recurring_payment with User A user_id');

  const { data: bUpdateAPayment } = await clientB
    .from('recurring_payments')
    .update({ amount_minor: 100 })
    .eq('id', paymentA.id)
    .select();
  assert(
    !bUpdateAPayment || bUpdateAPayment.length === 0,
    'User B cannot UPDATE User A recurring_payment'
  );

  const { data: bDeleteAPayment } = await clientB
    .from('recurring_payments')
    .delete()
    .eq('id', paymentA.id)
    .select();
  assert(
    !bDeleteAPayment || bDeleteAPayment.length === 0,
    'User B cannot DELETE User A recurring_payment'
  );

  // ---------------------------------------------------------------------------
  // 3. TRANSACTIONS TABLE
  // ---------------------------------------------------------------------------
  console.log('[3/6] Testing RLS on public.transactions...');
  const txnAId = crypto.randomUUID();
  const { data: txnA, error: txnAErr } = await clientA
    .from('transactions')
    .insert({
      id: txnAId,
      user_id: userA.id,
      type: 'income',
      amount_minor: 5000000,
      description: 'User A Salary',
      category: 'salary',
      txn_date: '2026-10-01',
    })
    .select()
    .single();
  assert(!txnAErr && txnA, `User A created transaction: ${txnAErr?.message}`);

  const { data: bSelectATxn } = await clientB
    .from('transactions')
    .select('*')
    .eq('id', txnA.id);
  assert(
    Array.isArray(bSelectATxn) && bSelectATxn.length === 0,
    'User B cannot SELECT User A transaction'
  );

  const { error: bInsertATxnErr } = await clientB.from('transactions').insert({
    id: crypto.randomUUID(),
    user_id: userA.id,
    type: 'expense',
    amount_minor: 99900,
    description: 'Spoofed Expense',
    category: 'shopping',
    txn_date: '2026-10-02',
  });
  assert(!!bInsertATxnErr, 'User B cannot INSERT transaction with User A user_id');

  const { data: bUpdateATxn } = await clientB
    .from('transactions')
    .update({ description: 'Tampered' })
    .eq('id', txnA.id)
    .select();
  assert(!bUpdateATxn || bUpdateATxn.length === 0, 'User B cannot UPDATE User A transaction');

  const { data: bDeleteATxn } = await clientB
    .from('transactions')
    .delete()
    .eq('id', txnA.id)
    .select();
  assert(!bDeleteATxn || bDeleteATxn.length === 0, 'User B cannot DELETE User A transaction');

  // ---------------------------------------------------------------------------
  // 4. BUDGETS TABLE
  // ---------------------------------------------------------------------------
  console.log('[4/6] Testing RLS on public.budgets...');
  const { data: budgetA, error: budgetAErr } = await clientA
    .from('budgets')
    .insert({
      user_id: userA.id,
      category: 'food_dining',
      limit_minor: 1000000,
    })
    .select()
    .single();
  assert(!budgetAErr && budgetA, `User A created budget: ${budgetAErr?.message}`);

  const { data: bSelectABudget } = await clientB
    .from('budgets')
    .select('*')
    .eq('id', budgetA.id);
  assert(
    Array.isArray(bSelectABudget) && bSelectABudget.length === 0,
    'User B cannot SELECT User A budget'
  );

  const { error: bInsertABudgetErr } = await clientB.from('budgets').insert({
    user_id: userA.id,
    category: 'transport',
    limit_minor: 500000,
  });
  assert(!!bInsertABudgetErr, 'User B cannot INSERT budget with User A user_id');

  const { data: bUpdateABudget } = await clientB
    .from('budgets')
    .update({ limit_minor: 100 })
    .eq('id', budgetA.id)
    .select();
  assert(!bUpdateABudget || bUpdateABudget.length === 0, 'User B cannot UPDATE User A budget');

  const { data: bDeleteABudget } = await clientB
    .from('budgets')
    .delete()
    .eq('id', budgetA.id)
    .select();
  assert(!bDeleteABudget || bDeleteABudget.length === 0, 'User B cannot DELETE User A budget');

  // ---------------------------------------------------------------------------
  // 5. GOALS TABLE
  // ---------------------------------------------------------------------------
  console.log('[5/6] Testing RLS on public.goals...');
  const { data: goalA, error: goalAErr } = await clientA
    .from('goals')
    .insert({
      user_id: userA.id,
      name: 'User A Emergency Goal',
      target_minor: 5000000,
      target_date: '2027-06-01',
    })
    .select()
    .single();
  assert(!goalAErr && goalA, `User A created goal: ${goalAErr?.message}`);

  const { data: bSelectAGoal } = await clientB
    .from('goals')
    .select('*')
    .eq('id', goalA.id);
  assert(
    Array.isArray(bSelectAGoal) && bSelectAGoal.length === 0,
    'User B cannot SELECT User A goal'
  );

  const { error: bInsertAGoalErr } = await clientB.from('goals').insert({
    user_id: userA.id,
    name: 'Spoofed Goal',
    target_minor: 100000,
  });
  assert(!!bInsertAGoalErr, 'User B cannot INSERT goal with User A user_id');

  const { data: bUpdateAGoal } = await clientB
    .from('goals')
    .update({ name: 'Tampered Goal' })
    .eq('id', goalA.id)
    .select();
  assert(!bUpdateAGoal || bUpdateAGoal.length === 0, 'User B cannot UPDATE User A goal');

  const { data: bDeleteAGoal } = await clientB
    .from('goals')
    .delete()
    .eq('id', goalA.id)
    .select();
  assert(!bDeleteAGoal || bDeleteAGoal.length === 0, 'User B cannot DELETE User A goal');

  // ---------------------------------------------------------------------------
  // 6. GOAL_CONTRIBUTIONS TABLE
  // ---------------------------------------------------------------------------
  console.log('[6/6] Testing RLS on public.goal_contributions...');
  const { data: contribA, error: contribAErr } = await clientA
    .from('goal_contributions')
    .insert({
      goal_id: goalA.id,
      user_id: userA.id,
      amount_minor: 100000,
      contributed_on: '2026-10-05',
      note: 'Initial deposit',
    })
    .select()
    .single();
  assert(!contribAErr && contribA, `User A created goal_contribution: ${contribAErr?.message}`);

  const { data: bSelectAContrib } = await clientB
    .from('goal_contributions')
    .select('*')
    .eq('id', contribA.id);
  assert(
    Array.isArray(bSelectAContrib) && bSelectAContrib.length === 0,
    'User B cannot SELECT User A goal_contribution'
  );

  const { error: bInsertAContribErr } = await clientB.from('goal_contributions').insert({
    goal_id: goalA.id,
    user_id: userA.id,
    amount_minor: 50000,
    contributed_on: '2026-10-06',
  });
  assert(
    !!bInsertAContribErr,
    'User B cannot INSERT goal_contribution with User A user_id / goal_id'
  );

  const { data: bUpdateAContrib } = await clientB
    .from('goal_contributions')
    .update({ amount_minor: 999999 })
    .eq('id', contribA.id)
    .select();
  assert(
    !bUpdateAContrib || bUpdateAContrib.length === 0,
    'User B cannot UPDATE User A goal_contribution'
  );

  const { data: bDeleteAContrib } = await clientB
    .from('goal_contributions')
    .delete()
    .eq('id', contribA.id)
    .select();
  assert(
    !bDeleteAContrib || bDeleteAContrib.length === 0,
    'User B cannot DELETE User A goal_contribution'
  );

  // Clean up test rows via reset_all_data() RPC for both users
  await clientA.rpc('reset_all_data');
  await clientB.rpc('reset_all_data');

  console.log('\n✅ ALL RLS CHECKS PASSED across all 6 tables (SELECT, INSERT, UPDATE, DELETE).');
}

runRlsVerification().catch((err) => {
  console.error('\n❌ RLS verification failed:', err.message || err);
  process.exit(1);
});
