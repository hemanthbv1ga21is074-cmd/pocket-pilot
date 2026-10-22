-- PocketPilot Migration 002: Atomic SECURITY INVOKER RPC Functions and Sample Data Seeding

-- Helper: Days in a given (year, month)
create or replace function public.days_in_month(p_year int, p_month int)
returns int
language plpgsql
immutable
as $$
begin
  return extract(day from (make_date(p_year, p_month, 1) + interval '1 month - 1 day'))::int;
end;
$$;

-- Helper: Advance due date anchored on anchor_day (Rule 7)
create or replace function public.advance_due_date(
  p_current_due date,
  p_frequency public.payment_frequency,
  p_anchor_day smallint
)
returns date
language plpgsql
immutable
as $$
declare
  v_anchor int := least(greatest(coalesce(p_anchor_day, 1)::int, 1), 31);
  v_target_month_start date;
  v_year int;
  v_month int;
  v_max_day int;
begin
  if p_frequency = 'once' then
    return p_current_due;
  elsif p_frequency = 'weekly' then
    return (p_current_due + interval '7 days')::date;
  elsif p_frequency = 'monthly' then
    v_target_month_start := (date_trunc('month', p_current_due) + interval '1 month')::date;
  elsif p_frequency = 'quarterly' then
    v_target_month_start := (date_trunc('month', p_current_due) + interval '3 months')::date;
  elsif p_frequency = 'yearly' then
    v_target_month_start := (date_trunc('month', p_current_due) + interval '1 year')::date;
  else
    return p_current_due;
  end if;

  v_year := extract(year from v_target_month_start)::int;
  v_month := extract(month from v_target_month_start)::int;
  v_max_day := public.days_in_month(v_year, v_month);

  return make_date(v_year, v_month, least(v_anchor, v_max_day));
end;
$$;

-- 1. balance_summary()
-- Returns total income, total expenses, net goal contributions, and starting balance
create or replace function public.balance_summary()
returns table (
  starting_balance_minor bigint,
  total_income_minor bigint,
  total_expense_minor bigint,
  net_goal_contributions_minor bigint
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_starting bigint := 0;
  v_income bigint := 0;
  v_expense bigint := 0;
  v_goal_net bigint := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(p.starting_balance_minor, 0)
  into v_starting
  from public.profiles p
  where p.user_id = v_uid;

  select
    coalesce(sum(case when t.type = 'income' then t.amount_minor else 0 end), 0),
    coalesce(sum(case when t.type = 'expense' then t.amount_minor else 0 end), 0)
  into v_income, v_expense
  from public.transactions t
  where t.user_id = v_uid;

  select coalesce(sum(gc.amount_minor), 0)
  into v_goal_net
  from public.goal_contributions gc
  where gc.user_id = v_uid;

  return query
  select
    coalesce(v_starting, 0)::bigint,
    coalesce(v_income, 0)::bigint,
    coalesce(v_expense, 0)::bigint,
    coalesce(v_goal_net, 0)::bigint;
end;
$$;

-- 2. add_goal_contribution(goal_id, amount_minor, on_date, note)
-- Positive amount must not exceed Available to spend; negative amount must not exceed goal's saved amount.
create or replace function public.add_goal_contribution(
  p_goal_id uuid,
  p_amount_minor bigint,
  p_on_date date default current_date,
  p_note text default null
)
returns public.goal_contributions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_goal public.goals;
  v_starting bigint := 0;
  v_income bigint := 0;
  v_expense bigint := 0;
  v_goal_net bigint := 0;
  v_available bigint := 0;
  v_goal_saved bigint := 0;
  v_inserted public.goal_contributions;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount_minor is null or p_amount_minor = 0 then
    raise exception 'Contribution amount must be non-zero';
  end if;

  select *
  into v_goal
  from public.goals g
  where g.id = p_goal_id and g.user_id = v_uid
  for update;

  if not found then
    raise exception 'Savings goal not found';
  end if;

  select
    bs.starting_balance_minor,
    bs.total_income_minor,
    bs.total_expense_minor,
    bs.net_goal_contributions_minor
  into v_starting, v_income, v_expense, v_goal_net
  from public.balance_summary() bs;

  v_available := (v_starting + v_income - v_expense) - v_goal_net;

  select coalesce(sum(gc.amount_minor), 0)
  into v_goal_saved
  from public.goal_contributions gc
  where gc.goal_id = p_goal_id and gc.user_id = v_uid;

  if p_amount_minor > 0 and p_amount_minor > v_available then
    raise exception 'Contribution amount exceeds your Available to spend balance';
  end if;

  if p_amount_minor < 0 and abs(p_amount_minor) > v_goal_saved then
    raise exception 'Withdrawal amount exceeds the goal''s saved balance';
  end if;

  insert into public.goal_contributions (
    goal_id,
    user_id,
    amount_minor,
    contributed_on,
    note
  )
  values (
    p_goal_id,
    v_uid,
    p_amount_minor,
    coalesce(p_on_date, current_date),
    nullif(btrim(coalesce(p_note, '')), '')
  )
  returning * into v_inserted;

  return v_inserted;
end;
$$;

-- 3. create_goal(...) with optional opening contribution
create or replace function public.create_goal(
  p_name text,
  p_target_minor bigint,
  p_target_date date default null,
  p_description text default null,
  p_opening_contribution_minor bigint default 0,
  p_contributed_on date default current_date
)
returns public.goals
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_goal public.goals;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.goals (
    user_id,
    name,
    target_minor,
    target_date,
    description,
    is_sample
  )
  values (
    v_uid,
    btrim(p_name),
    p_target_minor,
    p_target_date,
    nullif(btrim(coalesce(p_description, '')), ''),
    false
  )
  returning * into v_goal;

  if coalesce(p_opening_contribution_minor, 0) > 0 then
    perform public.add_goal_contribution(
      v_goal.id,
      p_opening_contribution_minor,
      coalesce(p_contributed_on, current_date),
      'Opening contribution'
    );
  end if;

  return v_goal;
end;
$$;

-- 4. mark_payment_paid(payment_id, paid_on, amount_minor)
create or replace function public.mark_payment_paid(
  p_payment_id uuid,
  p_paid_on date default current_date,
  p_amount_minor bigint default null
)
returns public.recurring_payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_payment public.recurring_payments;
  v_final_amount bigint;
  v_txn_id uuid := gen_random_uuid();
  v_next_due date;
  v_updated public.recurring_payments;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_payment
  from public.recurring_payments rp
  where rp.id = p_payment_id and rp.user_id = v_uid
  for update;

  if not found then
    raise exception 'Recurring payment not found';
  end if;

  if v_payment.frequency = 'once' and v_payment.is_paid then
    raise exception 'This one-time payment is already marked as paid';
  end if;

  v_final_amount := coalesce(p_amount_minor, v_payment.amount_minor);
  if v_final_amount < 1 or v_final_amount > 10000000000 then
    raise exception 'Invalid payment amount';
  end if;

  insert into public.transactions (
    id,
    user_id,
    type,
    amount_minor,
    description,
    category,
    txn_date,
    notes,
    recurring_payment_id,
    is_sample
  )
  values (
    v_txn_id,
    v_uid,
    'expense',
    v_final_amount,
    v_payment.name,
    v_payment.category,
    coalesce(p_paid_on, current_date),
    'Marked paid from Upcoming Payments',
    v_payment.id,
    v_payment.is_sample
  );

  if v_payment.frequency = 'once' then
    v_next_due := v_payment.next_due_date;
  else
    v_next_due := public.advance_due_date(
      v_payment.next_due_date,
      v_payment.frequency,
      v_payment.anchor_day
    );
  end if;

  update public.recurring_payments
  set
    due_date_before_last_payment = v_payment.next_due_date,
    last_paid_txn_id = v_txn_id,
    next_due_date = v_next_due,
    is_paid = (v_payment.frequency = 'once')
  where id = v_payment.id and user_id = v_uid
  returning * into v_updated;

  return v_updated;
end;
$$;

-- 5. undo_last_payment(payment_id)
create or replace function public.undo_last_payment(
  p_payment_id uuid
)
returns public.recurring_payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_payment public.recurring_payments;
  v_updated public.recurring_payments;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_payment
  from public.recurring_payments rp
  where rp.id = p_payment_id and rp.user_id = v_uid
  for update;

  if not found then
    raise exception 'Recurring payment not found';
  end if;

  if v_payment.last_paid_txn_id is null and v_payment.due_date_before_last_payment is null then
    raise exception 'No recorded payment to undo';
  end if;

  if v_payment.last_paid_txn_id is not null then
    delete from public.transactions
    where id = v_payment.last_paid_txn_id and user_id = v_uid;
  end if;

  update public.recurring_payments
  set
    next_due_date = coalesce(v_payment.due_date_before_last_payment, v_payment.next_due_date),
    is_paid = false,
    last_paid_txn_id = null,
    due_date_before_last_payment = null
  where id = v_payment.id and user_id = v_uid
  returning * into v_updated;

  return v_updated;
end;
$$;

-- 6. clear_sample_data()
-- Touches only flagged sample rows
create or replace function public.clear_sample_data()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.goal_contributions
  where user_id = v_uid
    and goal_id in (select id from public.goals where user_id = v_uid and is_sample = true);

  delete from public.goals
  where user_id = v_uid and is_sample = true;

  delete from public.transactions
  where user_id = v_uid and is_sample = true;

  delete from public.recurring_payments
  where user_id = v_uid and is_sample = true;

  delete from public.budgets
  where user_id = v_uid and is_sample = true;
end;
$$;

-- 7. seed_sample_data(p_today date)
-- Covers 4 months, realistic INR amounts, 1 budget over limit, 1 budget near limit,
-- a goal with a target date, an overdue payment, and a payment due in 3 days.
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

  -- Insert 4 months of realistic INR transactions (all dates <= p_today)
  insert into public.transactions (
    id, user_id, type, amount_minor, description, category, txn_date, notes, is_sample
  )
  values
    -- Month -3 (3 months ago)
    (gen_random_uuid(), v_uid, 'income', 8500000, 'Monthly Salary Credit', 'salary', v_m3_start, 'TechCorp India Pvt Ltd', true),
    (gen_random_uuid(), v_uid, 'expense', 2200000, 'Apartment Rent - Indiranagar', 'housing_rent', v_m3_start + 2, 'Monthly rent', true),
    (gen_random_uuid(), v_uid, 'expense', 640000, 'Supermarket & Fresh Produce', 'food_dining', v_m3_start + 6, 'Weekly groceries & dining', true),
    (gen_random_uuid(), v_uid, 'expense', 280000, 'Metro Card & Auto Rides', 'transport', v_m3_start + 11, 'Commute', true),
    (gen_random_uuid(), v_uid, 'expense', 310000, 'BESCOM Electricity & Water', 'bills_utilities', v_m3_start + 14, 'Utility bills', true),
    (gen_random_uuid(), v_uid, 'expense', 450000, 'Work Backpack & Apparel', 'shopping', v_m3_start + 19, 'Shopping', true),

    -- Month -2 (2 months ago)
    (gen_random_uuid(), v_uid, 'income', 8500000, 'Monthly Salary Credit', 'salary', v_m2_start, 'TechCorp India Pvt Ltd', true),
    (gen_random_uuid(), v_uid, 'income', 1800000, 'UI Audit Freelance Milestone', 'freelance', v_m2_start + 12, 'Client invoice #104', true),
    (gen_random_uuid(), v_uid, 'expense', 2200000, 'Apartment Rent - Indiranagar', 'housing_rent', v_m2_start + 2, 'Monthly rent', true),
    (gen_random_uuid(), v_uid, 'expense', 780000, 'Groceries, Coffee & Team Lunch', 'food_dining', v_m2_start + 8, 'Dining & groceries', true),
    (gen_random_uuid(), v_uid, 'expense', 320000, 'Cab & Metro Pass', 'transport', v_m2_start + 15, 'City commute', true),
    (gen_random_uuid(), v_uid, 'expense', 295000, 'Electricity & Fiber Internet', 'bills_utilities', v_m2_start + 18, 'Monthly utilities', true),
    (gen_random_uuid(), v_uid, 'expense', 520000, 'Running Shoes & Gear', 'shopping', v_m2_start + 22, 'Fitness gear', true),

    -- Month -1 (Last month)
    (gen_random_uuid(), v_uid, 'income', 8500000, 'Monthly Salary Credit', 'salary', v_m1_start, 'TechCorp India Pvt Ltd', true),
    (gen_random_uuid(), v_uid, 'expense', 2200000, 'Apartment Rent - Indiranagar', 'housing_rent', v_m1_start + 2, 'Monthly rent', true),
    (gen_random_uuid(), v_uid, 'expense', 810000, 'Groceries & Weekend Dining', 'food_dining', v_m1_start + 7, 'Groceries & restaurants', true),
    (gen_random_uuid(), v_uid, 'expense', 260000, 'Namma Metro & Fuel', 'transport', v_m1_start + 12, 'Commute', true),
    (gen_random_uuid(), v_uid, 'expense', 340000, 'Electricity, Gas & Mobile', 'bills_utilities', v_m1_start + 16, 'Utilities', true),
    (gen_random_uuid(), v_uid, 'expense', 610000, 'Festive Gifts & Home Decor', 'shopping', v_m1_start + 21, 'Shopping', true),
    (gen_random_uuid(), v_uid, 'expense', 129900, 'Cloud Storage & Streaming Bundle', 'subscriptions', v_m1_start + 24, 'Recurring subscriptions', true),

    -- Month 0 (Current month up to p_today)
    (gen_random_uuid(), v_uid, 'income', 8500000, 'Monthly Salary Credit', 'salary', v_m0_start, 'TechCorp India Pvt Ltd', true),
    (gen_random_uuid(), v_uid, 'income', 2400000, 'Design System Consulting', 'freelance', least(v_m0_start + 3, p_today), 'Freelance retainer', true),
    (gen_random_uuid(), v_uid, 'expense', 2200000, 'Apartment Rent - Indiranagar', 'housing_rent', v_m0_start, 'Monthly rent', true),
    -- Food & Dining: ₹8,600 spent against ₹10,000 budget (86% -> Near limit / Approaching!)
    (gen_random_uuid(), v_uid, 'expense', 520000, 'Monthly Organic Groceries & Pantry', 'food_dining', v_m0_start, 'BigBasket order', true),
    (gen_random_uuid(), v_uid, 'expense', 340000, 'Weekend Cafes & Dinner with Friends', 'food_dining', least(v_m0_start + 1, p_today), 'Dining out', true),
    -- Shopping: ₹9,500 spent against ₹8,000 budget (118.75% -> Over limit / Exceeded!)
    (gen_random_uuid(), v_uid, 'expense', 950000, 'Ergonomic Mechanical Keyboard & Stand', 'shopping', least(v_m0_start + 1, p_today), 'Home office upgrade', true),
    -- Transport: ₹2,400 spent against ₹5,000 budget (48% -> Normal)
    (gen_random_uuid(), v_uid, 'expense', 240000, 'Metro Smart Card & Airport Cab', 'transport', p_today, 'Local transit', true),
    -- Subscriptions: ₹1,299 spent against ₹3,000 budget (43.3% -> Normal)
    (gen_random_uuid(), v_uid, 'expense', 129900, 'Spotify, iCloud & Developer Tools', 'subscriptions', p_today, 'Monthly plans', true),
    -- Healthcare
    (gen_random_uuid(), v_uid, 'expense', 180000, 'Annual Dental Checkup & Pharmacy', 'healthcare', p_today, 'Preventive care', true);

  -- Budgets:
  -- 1. shopping: ₹8,000 limit (₹9,500 spent = 118.8% EXCEEDED)
  -- 2. food_dining: ₹10,000 limit (₹8,600 spent = 86.0% APPROACHING)
  -- 3. transport: ₹5,000 limit (₹2,400 spent = 48.0% NORMAL)
  -- 4. subscriptions: ₹3,000 limit (₹1,299 spent = 43.3% NORMAL)
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
  -- Goal 1 with target date (6 months out)
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
  -- 1. Overdue payment (p_today - 3 days)
  -- 2. Payment due in 3 days (p_today + 3 days)
  -- 3. Upcoming payment due in 14 days (p_today + 14 days)
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

-- 8. reset_all_data()
-- Wipes all financial records for the current user and resets profile balances
create or replace function public.reset_all_data()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.goal_contributions where user_id = v_uid;
  delete from public.goals where user_id = v_uid;
  delete from public.transactions where user_id = v_uid;
  delete from public.recurring_payments where user_id = v_uid;
  delete from public.budgets where user_id = v_uid;

  update public.profiles
  set
    starting_balance_minor = 0,
    overall_monthly_budget_minor = null,
    warn_pct = 80,
    onboarded = true
  where user_id = v_uid;
end;
$$;
