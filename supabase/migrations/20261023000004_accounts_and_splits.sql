-- PocketPilot Migration 004: Multi-Account Payment Modes & Split / Reimbursable Transactions

alter table public.transactions
  add column if not exists payment_method text not null default 'upi'
    check (payment_method in ('bank', 'upi', 'cash', 'credit_card')),
  add column if not exists is_split boolean not null default false,
  add column if not exists split_with text
    check (split_with is null or char_length(btrim(split_with)) <= 120),
  add column if not exists reimbursable_minor bigint not null default 0
    check (reimbursable_minor >= 0 and reimbursable_minor < amount_minor),
  add column if not exists is_reimbursed boolean not null default false;

create index if not exists idx_transactions_user_payment_method
  on public.transactions (user_id, payment_method);

create index if not exists idx_transactions_user_split
  on public.transactions (user_id, is_split, is_reimbursed)
  where is_split = true;

-- Update seed_sample_data(p_today date) to populate realistic payment methods and split transactions
create or replace function public.seed_sample_data(
  p_today date default current_date
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_m0_start date := date_trunc('month', p_today)::date;
  v_m1_start date := (date_trunc('month', p_today) - interval '1 month')::date;
  v_m2_start date := (date_trunc('month', p_today) - interval '2 months')::date;
  v_m3_start date := (date_trunc('month', p_today) - interval '3 months')::date;
  v_goal1_id uuid := gen_random_uuid();
  v_goal2_id uuid := gen_random_uuid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (user_id, display_name, onboarded)
  values (v_uid, 'Aarav', true)
  on conflict (user_id) do update
  set onboarded = true;

  -- Clear any existing sample rows first
  perform public.clear_sample_data();

  -- Insert 4 months of realistic INR transactions with payment_method & split examples
  insert into public.transactions (
    id, user_id, type, amount_minor, description, category, txn_date, notes,
    payment_method, is_split, split_with, reimbursable_minor, is_reimbursed, is_sample
  )
  values
    -- Month -3 (3 months ago)
    (gen_random_uuid(), v_uid, 'income', 8500000, 'Monthly Salary Credit', 'salary', v_m3_start, 'TechCorp India Pvt Ltd', 'bank', false, null, 0, false, true),
    (gen_random_uuid(), v_uid, 'expense', 2200000, 'Apartment Rent - Indiranagar', 'housing_rent', v_m3_start + 2, 'Monthly rent', 'bank', false, null, 0, false, true),
    (gen_random_uuid(), v_uid, 'expense', 640000, 'Supermarket & Fresh Produce', 'food_dining', v_m3_start + 6, 'Weekly groceries & dining', 'upi', false, null, 0, false, true),
    (gen_random_uuid(), v_uid, 'expense', 280000, 'Metro Card & Auto Rides', 'transport', v_m3_start + 11, 'Commute', 'cash', false, null, 0, false, true),
    (gen_random_uuid(), v_uid, 'expense', 310000, 'BESCOM Electricity & Water', 'bills_utilities', v_m3_start + 14, 'Utility bills', 'upi', false, null, 0, false, true),
    (gen_random_uuid(), v_uid, 'expense', 450000, 'Work Backpack & Apparel', 'shopping', v_m3_start + 19, 'Shopping', 'credit_card', false, null, 0, false, true),

    -- Month -2 (2 months ago)
    (gen_random_uuid(), v_uid, 'income', 8500000, 'Monthly Salary Credit', 'salary', v_m2_start, 'TechCorp India Pvt Ltd', 'bank', false, null, 0, false, true),
    (gen_random_uuid(), v_uid, 'income', 1800000, 'UI Audit Freelance Milestone', 'freelance', v_m2_start + 12, 'Client invoice #104', 'bank', false, null, 0, false, true),
    (gen_random_uuid(), v_uid, 'expense', 2200000, 'Apartment Rent - Indiranagar', 'housing_rent', v_m2_start + 2, 'Monthly rent', 'bank', false, null, 0, false, true),
    (gen_random_uuid(), v_uid, 'expense', 780000, 'Groceries, Coffee & Team Lunch', 'food_dining', v_m2_start + 8, 'Dining & groceries', 'upi', false, null, 0, false, true),
    (gen_random_uuid(), v_uid, 'expense', 320000, 'Cab & Metro Pass', 'transport', v_m2_start + 15, 'City commute', 'upi', false, null, 0, false, true),
    (gen_random_uuid(), v_uid, 'expense', 295000, 'Electricity & Fiber Internet', 'bills_utilities', v_m2_start + 18, 'Monthly utilities', 'upi', false, null, 0, false, true),
    (gen_random_uuid(), v_uid, 'expense', 520000, 'Running Shoes & Gear', 'shopping', v_m2_start + 22, 'Fitness gear', 'credit_card', false, null, 0, false, true),

    -- Month -1 (Last month)
    (gen_random_uuid(), v_uid, 'income', 8500000, 'Monthly Salary Credit', 'salary', v_m1_start, 'TechCorp India Pvt Ltd', 'bank', false, null, 0, false, true),
    (gen_random_uuid(), v_uid, 'expense', 2200000, 'Apartment Rent - Indiranagar', 'housing_rent', v_m1_start + 2, 'Monthly rent', 'bank', false, null, 0, false, true),
    (gen_random_uuid(), v_uid, 'expense', 810000, 'Groceries & Weekend Dining', 'food_dining', v_m1_start + 7, 'Groceries & restaurants', 'upi', true, 'Rohan', 200000, true, true),
    (gen_random_uuid(), v_uid, 'expense', 260000, 'Namma Metro & Fuel', 'transport', v_m1_start + 12, 'Commute', 'cash', false, null, 0, false, true),
    (gen_random_uuid(), v_uid, 'expense', 340000, 'Electricity, Gas & Mobile', 'bills_utilities', v_m1_start + 16, 'Utilities', 'upi', false, null, 0, false, true),
    (gen_random_uuid(), v_uid, 'expense', 610000, 'Festive Gifts & Home Decor', 'shopping', v_m1_start + 21, 'Shopping', 'credit_card', false, null, 0, false, true),
    (gen_random_uuid(), v_uid, 'expense', 129900, 'Cloud Storage & Streaming Bundle', 'subscriptions', v_m1_start + 24, 'Recurring subscriptions', 'credit_card', false, null, 0, false, true),

    -- Month 0 (Current month up to p_today)
    (gen_random_uuid(), v_uid, 'income', 8500000, 'Monthly Salary Credit', 'salary', v_m0_start, 'TechCorp India Pvt Ltd', 'bank', false, null, 0, false, true),
    (gen_random_uuid(), v_uid, 'income', 2400000, 'Design System Consulting', 'freelance', least(v_m0_start + 3, p_today), 'Freelance retainer', 'bank', false, null, 0, false, true),
    (gen_random_uuid(), v_uid, 'expense', 2200000, 'Apartment Rent - Indiranagar', 'housing_rent', v_m0_start, 'Monthly rent', 'bank', false, null, 0, false, true),
    -- Food & Dining: ₹8,600 spent against ₹10,000 budget (86% -> Near limit / Approaching!)
    (gen_random_uuid(), v_uid, 'expense', 520000, 'Monthly Organic Groceries & Pantry', 'food_dining', v_m0_start, 'BigBasket order', 'upi', false, null, 0, false, true),
    (gen_random_uuid(), v_uid, 'expense', 340000, 'Weekend Cafes & Dinner with Friends', 'food_dining', least(v_m0_start + 1, p_today), 'Split 50/50 with Rahul & Priya', 'upi', true, 'Rahul & Priya', 170000, false, true),
    -- Shopping: ₹9,500 spent against ₹8,000 budget (118.75% -> Over limit / Exceeded!)
    (gen_random_uuid(), v_uid, 'expense', 950000, 'Ergonomic Mechanical Keyboard & Stand', 'shopping', least(v_m0_start + 1, p_today), 'Home office upgrade', 'credit_card', false, null, 0, false, true),
    -- Transport: ₹2,400 spent against ₹5,000 budget (48% -> Normal)
    (gen_random_uuid(), v_uid, 'expense', 240000, 'Metro Smart Card & Airport Cab', 'transport', p_today, 'Local transit', 'cash', false, null, 0, false, true),
    -- Subscriptions: ₹1,299 spent against ₹3,000 budget (43.3% -> Normal)
    (gen_random_uuid(), v_uid, 'expense', 129900, 'Spotify, iCloud & Developer Tools', 'subscriptions', p_today, 'Monthly plans', 'credit_card', false, null, 0, false, true),
    -- Healthcare
    (gen_random_uuid(), v_uid, 'expense', 180000, 'Annual Dental Checkup & Pharmacy', 'healthcare', p_today, 'Preventive care', 'upi', false, null, 0, false, true);

  -- Budgets:
  insert into public.budgets (user_id, category, limit_minor, is_sample)
  values
    (v_uid, 'shopping', 800000, true),
    (v_uid, 'food_dining', 1000000, true),
    (v_uid, 'transport', 500000, true),
    (v_uid, 'subscriptions', 300000, true)
  on conflict (user_id, category) do update
  set limit_minor = excluded.limit_minor,
      is_sample = excluded.is_sample;

  -- Goals:
  insert into public.goals (id, user_id, name, target_minor, target_date, description, is_sample)
  values
    (
      v_goal1_id,
      v_uid,
      'Emergency Safety Cushion',
      15000000,
      (p_today + interval '6 months')::date,
      'Six months of core living expenses held in high-yield reserve.',
      true
    ),
    (
      v_goal2_id,
      v_uid,
      'MacBook Pro Upgrade Fund',
      18000000,
      (p_today + interval '9 months')::date,
      'Workstation replacement for freelance design & engineering projects.',
      true
    );

  insert into public.goal_contributions (goal_id, user_id, amount_minor, contributed_on, note)
  values
    (v_goal1_id, v_uid, 2500000, v_m2_start + 5, 'Initial emergency fund transfer'),
    (v_goal1_id, v_uid, 2000000, v_m1_start + 5, 'Monthly reserve top-up'),
    (v_goal2_id, v_uid, 3000000, v_m1_start + 14, 'Freelance milestone allocation');

  -- Recurring Payments:
  insert into public.recurring_payments (
    user_id, name, amount_minor, category, frequency, next_due_date, anchor_day, is_paid, is_sample
  )
  values
    (
      v_uid,
      'ACT Fibernet Broadband',
      117900,
      'bills_utilities',
      'monthly',
      (p_today - interval '3 days')::date,
      extract(day from (p_today - interval '3 days'))::smallint,
      false,
      true
    ),
    (
      v_uid,
      'BESCOM Electricity Bill',
      245000,
      'bills_utilities',
      'monthly',
      (p_today + interval '3 days')::date,
      extract(day from (p_today + interval '3 days'))::smallint,
      false,
      true
    ),
    (
      v_uid,
      'Indiranagar Apartment Rent',
      2200000,
      'housing_rent',
      'monthly',
      (p_today + interval '14 days')::date,
      extract(day from (p_today + interval '14 days'))::smallint,
      false,
      true
    );
end;
$$;
