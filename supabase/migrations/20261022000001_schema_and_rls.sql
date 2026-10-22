-- PocketPilot Migration 001: Core Schema, Indexes, Triggers, and Row Level Security (RLS)

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'txn_type') then
    create type public.txn_type as enum ('income','expense');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_frequency') then
    create type public.payment_frequency as enum ('once','weekly','monthly','quarterly','yearly');
  end if;
  if not exists (select 1 from pg_type where typname = 'category_key') then
    create type public.category_key as enum (
      'food_dining',
      'transport',
      'shopping',
      'bills_utilities',
      'housing_rent',
      'entertainment',
      'healthcare',
      'education',
      'subscriptions',
      'other_expense',
      'salary',
      'freelance',
      'gift',
      'refund',
      'other_income'
    );
  end if;
end
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text not null default 'there',
  currency text not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  starting_balance_minor bigint not null default 0,
  overall_monthly_budget_minor bigint check (overall_monthly_budget_minor > 0),
  warn_pct smallint not null default 80 check (warn_pct between 50 and 99),
  theme text not null default 'system' check (theme in ('light','dark','system')),
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  amount_minor bigint not null check (amount_minor between 1 and 10000000000),
  category public.category_key not null check (category not in ('salary','freelance','gift','refund','other_income')),
  frequency public.payment_frequency not null,
  next_due_date date not null,
  anchor_day smallint not null check (anchor_day between 1 and 31),
  is_paid boolean not null default false,
  last_paid_txn_id uuid,
  due_date_before_last_payment date,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  type public.txn_type not null,
  amount_minor bigint not null check (amount_minor between 1 and 10000000000),
  description text not null check (char_length(btrim(description)) between 1 and 120),
  category public.category_key not null,
  txn_date date not null,
  notes text check (char_length(notes) <= 500),
  recurring_payment_id uuid references public.recurring_payments(id) on delete set null,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (type = 'income' and category in ('salary','freelance','gift','refund','other_income'))
    or (type = 'expense' and category not in ('salary','freelance','gift','refund','other_income'))
  )
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  category public.category_key not null check (category not in ('salary','freelance','gift','refund','other_income')),
  limit_minor bigint not null check (limit_minor between 1 and 10000000000),
  is_sample boolean not null default false,
  unique (user_id, category)
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  target_minor bigint not null check (target_minor between 1 and 10000000000),
  target_date date,
  description text check (char_length(description) <= 300),
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  amount_minor bigint not null check (amount_minor <> 0),
  contributed_on date not null,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade
);

-- Required indexes on user_id and query access paths
create index if not exists idx_recurring_payments_user_id on public.recurring_payments (user_id);
create index if not exists idx_recurring_payments_user_due on public.recurring_payments (user_id, next_due_date);

create index if not exists idx_transactions_user_id on public.transactions (user_id);
create index if not exists idx_transactions_user_date on public.transactions (user_id, txn_date desc);
create index if not exists idx_transactions_user_category on public.transactions (user_id, category);

create index if not exists idx_budgets_user_id on public.budgets (user_id);
create index if not exists idx_goals_user_id on public.goals (user_id);
create index if not exists idx_goal_contributions_user_id on public.goal_contributions (user_id);
create index if not exists idx_goal_contributions_goal_id on public.goal_contributions (goal_id);

-- Trigger: updated_at on transactions
create or replace function public.set_transactions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at
before update on public.transactions
for each row
execute function public.set_transactions_updated_at();

-- Security definer trigger on auth.users insert that creates the profile row (including anonymous users)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
begin
  v_display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), ''),
    'there'
  );

  insert into public.profiles (user_id, display_name)
  values (new.id, v_display_name)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Enable Row Level Security (RLS) on every table
alter table public.profiles enable row level security;
alter table public.recurring_payments enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.goal_contributions enable row level security;

-- RLS Policies: profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (user_id = (select auth.uid()));

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (user_id = (select auth.uid()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete using (user_id = (select auth.uid()));

-- RLS Policies: recurring_payments
drop policy if exists "recurring_payments_select_own" on public.recurring_payments;
create policy "recurring_payments_select_own" on public.recurring_payments
  for select using (user_id = (select auth.uid()));

drop policy if exists "recurring_payments_insert_own" on public.recurring_payments;
create policy "recurring_payments_insert_own" on public.recurring_payments
  for insert with check (user_id = (select auth.uid()));

drop policy if exists "recurring_payments_update_own" on public.recurring_payments;
create policy "recurring_payments_update_own" on public.recurring_payments
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "recurring_payments_delete_own" on public.recurring_payments;
create policy "recurring_payments_delete_own" on public.recurring_payments
  for delete using (user_id = (select auth.uid()));

-- RLS Policies: transactions
drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions
  for select using (user_id = (select auth.uid()));

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own" on public.transactions
  for insert with check (user_id = (select auth.uid()));

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own" on public.transactions
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own" on public.transactions
  for delete using (user_id = (select auth.uid()));

-- RLS Policies: budgets
drop policy if exists "budgets_select_own" on public.budgets;
create policy "budgets_select_own" on public.budgets
  for select using (user_id = (select auth.uid()));

drop policy if exists "budgets_insert_own" on public.budgets;
create policy "budgets_insert_own" on public.budgets
  for insert with check (user_id = (select auth.uid()));

drop policy if exists "budgets_update_own" on public.budgets;
create policy "budgets_update_own" on public.budgets
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "budgets_delete_own" on public.budgets;
create policy "budgets_delete_own" on public.budgets
  for delete using (user_id = (select auth.uid()));

-- RLS Policies: goals
drop policy if exists "goals_select_own" on public.goals;
create policy "goals_select_own" on public.goals
  for select using (user_id = (select auth.uid()));

drop policy if exists "goals_insert_own" on public.goals;
create policy "goals_insert_own" on public.goals
  for insert with check (user_id = (select auth.uid()));

drop policy if exists "goals_update_own" on public.goals;
create policy "goals_update_own" on public.goals
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "goals_delete_own" on public.goals;
create policy "goals_delete_own" on public.goals
  for delete using (user_id = (select auth.uid()));

-- RLS Policies: goal_contributions
drop policy if exists "goal_contributions_select_own" on public.goal_contributions;
create policy "goal_contributions_select_own" on public.goal_contributions
  for select using (user_id = (select auth.uid()));

drop policy if exists "goal_contributions_insert_own" on public.goal_contributions;
create policy "goal_contributions_insert_own" on public.goal_contributions
  for insert with check (user_id = (select auth.uid()));

drop policy if exists "goal_contributions_update_own" on public.goal_contributions;
create policy "goal_contributions_update_own" on public.goal_contributions
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "goal_contributions_delete_own" on public.goal_contributions;
create policy "goal_contributions_delete_own" on public.goal_contributions
  for delete using (user_id = (select auth.uid()));
