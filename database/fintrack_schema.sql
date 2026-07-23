-- ============================================================
-- FinTrack Database Schema
-- Paste this entire script into Supabase SQL Editor and click "Run"
-- Project: rweyuqardptejnkzfqzw
-- ============================================================

-- Extension for UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. WALLETS (AED / INR)
-- ============================================================
create table wallets (
  id uuid primary key default uuid_generate_v4(),
  name text not null,              -- e.g. "Dubai Salary Wallet", "India Savings Wallet"
  currency text not null check (currency in ('AED','INR')),
  is_default boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- 2. CATEGORIES / SUBCATEGORIES
-- ============================================================
create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in ('expense','income')),
  icon text,                       -- icon name/emoji
  color text,                      -- hex color for charts
  is_custom boolean default true,
  created_at timestamptz default now()
);

create table subcategories (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid references categories(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- 3. TRANSACTIONS (expenses + income)
-- ============================================================
create table transactions (
  id uuid primary key default uuid_generate_v4(),
  wallet_id uuid references wallets(id) on delete restrict,
  type text not null check (type in ('expense','income')),
  amount numeric(14,2) not null,
  category_id uuid references categories(id),
  subcategory_id uuid references subcategories(id),
  description text,
  payment_method text,             -- cash, card, bank transfer, etc.
  notes text,
  location text,
  tags text[],                     -- array of custom tags
  receipt_url text,                -- storage path if photo attached
  is_recurring boolean default false,
  recurrence_rule text,            -- 'weekly','monthly','yearly','custom'
  status text default 'completed', -- completed, pending
  transaction_date date not null,
  transaction_time time,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_transactions_wallet on transactions(wallet_id);
create index idx_transactions_date on transactions(transaction_date);
create index idx_transactions_category on transactions(category_id);

-- ============================================================
-- 4. SALARY / INCOME SOURCES
-- ============================================================
create table salary_income (
  id uuid primary key default uuid_generate_v4(),
  wallet_id uuid references wallets(id) on delete restrict,
  month date not null,             -- first of month, e.g. 2026-07-01
  base_salary numeric(14,2) default 0,
  bonus numeric(14,2) default 0,
  allowance numeric(14,2) default 0,
  side_income numeric(14,2) default 0,
  investment_income numeric(14,2) default 0,
  other_income numeric(14,2) default 0,
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- 5. DEBTS (owed / receivable)
-- ============================================================
create table debts (
  id uuid primary key default uuid_generate_v4(),
  wallet_id uuid references wallets(id) on delete restrict,
  direction text not null check (direction in ('i_owe','owed_to_me')),
  person_name text not null,
  phone_number text,
  total_amount numeric(14,2) not null,
  remaining_amount numeric(14,2) not null,
  due_date date,
  priority text default 'normal',  -- low, normal, high
  status text default 'open',      -- open, partially_paid, settled
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table debt_payments (
  id uuid primary key default uuid_generate_v4(),
  debt_id uuid references debts(id) on delete cascade,
  amount numeric(14,2) not null,
  payment_date date not null,
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- 6. BUDGETS
-- ============================================================
create table budgets (
  id uuid primary key default uuid_generate_v4(),
  wallet_id uuid references wallets(id) on delete restrict,
  category_id uuid references categories(id),
  month date not null,             -- first of month
  budget_amount numeric(14,2) not null,
  created_at timestamptz default now()
);

-- ============================================================
-- 7. RECURRING TRANSACTION TEMPLATES
-- ============================================================
create table recurring_templates (
  id uuid primary key default uuid_generate_v4(),
  wallet_id uuid references wallets(id) on delete restrict,
  type text not null check (type in ('expense','income')),
  amount numeric(14,2) not null,
  category_id uuid references categories(id),
  description text,
  frequency text not null check (frequency in ('weekly','monthly','yearly','custom')),
  next_due_date date not null,
  active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- 8. SAVINGS GOALS
-- ============================================================
create table savings_goals (
  id uuid primary key default uuid_generate_v4(),
  wallet_id uuid references wallets(id) on delete restrict,
  goal_name text not null,
  target_amount numeric(14,2) not null,
  current_amount numeric(14,2) default 0,
  target_date date,
  created_at timestamptz default now()
);

-- ============================================================
-- 9. SETTINGS (single row, app-wide)
-- ============================================================
create table app_settings (
  id uuid primary key default uuid_generate_v4(),
  password_hash text,              -- hashed local PIN/password
  theme text default 'dark',
  default_wallet_id uuid references wallets(id),
  last_backup_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 10. AUDIT LOG
-- ============================================================
create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  action text not null,            -- created, updated, deleted
  table_name text not null,
  record_id uuid,
  details jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- 11. SPLIT EXPENSES
-- The app currently stores split-expense groups locally (per-friend
-- shares are pushed to the `debts` table above so Owed-to-Me totals
-- sync today); this table is provided so a future sync pass can push
-- the split group itself (title, total, friend list) for full
-- cross-device Expense History.
-- ============================================================
create table split_expenses (
  id uuid primary key default uuid_generate_v4(),
  wallet_id uuid references wallets(id) on delete restrict,
  title text not null,
  total_amount numeric(14,2) not null,
  expense_date date not null,
  notes text,
  created_at timestamptz default now()
);

create table split_expense_friends (
  id uuid primary key default uuid_generate_v4(),
  split_expense_id uuid references split_expenses(id) on delete cascade,
  debt_id uuid references debts(id) on delete cascade,
  friend_name text not null,
  share_amount numeric(14,2) not null,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Single-user app: access is protected by your in-app PIN, not
-- Supabase Auth. RLS is enabled but open to the anon/publishable
-- key so the app can sync freely. Do NOT share your Supabase
-- keys publicly.
-- ============================================================
alter table wallets enable row level security;
alter table categories enable row level security;
alter table subcategories enable row level security;
alter table transactions enable row level security;
alter table salary_income enable row level security;
alter table debts enable row level security;
alter table debt_payments enable row level security;
alter table budgets enable row level security;
alter table recurring_templates enable row level security;
alter table savings_goals enable row level security;
alter table app_settings enable row level security;
alter table audit_log enable row level security;
alter table split_expenses enable row level security;
alter table split_expense_friends enable row level security;

create policy "allow all - wallets" on wallets for all using (true) with check (true);
create policy "allow all - categories" on categories for all using (true) with check (true);
create policy "allow all - subcategories" on subcategories for all using (true) with check (true);
create policy "allow all - transactions" on transactions for all using (true) with check (true);
create policy "allow all - salary_income" on salary_income for all using (true) with check (true);
create policy "allow all - debts" on debts for all using (true) with check (true);
create policy "allow all - debt_payments" on debt_payments for all using (true) with check (true);
create policy "allow all - budgets" on budgets for all using (true) with check (true);
create policy "allow all - recurring_templates" on recurring_templates for all using (true) with check (true);
create policy "allow all - savings_goals" on savings_goals for all using (true) with check (true);
create policy "allow all - app_settings" on app_settings for all using (true) with check (true);
create policy "allow all - audit_log" on audit_log for all using (true) with check (true);
create policy "allow all - split_expenses" on split_expenses for all using (true) with check (true);
create policy "allow all - split_expense_friends" on split_expense_friends for all using (true) with check (true);

-- ============================================================
-- SEED DATA: default wallets + starter categories
-- ============================================================
insert into wallets (name, currency, is_default) values
  ('Dubai Wallet', 'AED', true),
  ('India Wallet', 'INR', false);

insert into categories (name, type, icon, color) values
  ('Food & Dining', 'expense', '🍽️', '#D4AF37'),
  ('Transport', 'expense', '🚗', '#334155'),
  ('Rent & Housing', 'expense', '🏠', '#0D1321'),
  ('Utilities', 'expense', '💡', '#2E7D6B'),
  ('Shopping', 'expense', '🛍️', '#D4AF37'),
  ('Health', 'expense', '⚕️', '#2E7D6B'),
  ('Family Transfer', 'expense', '💸', '#334155'),
  ('Entertainment', 'expense', '🎬', '#D4AF37'),
  ('Salary', 'income', '💰', '#2E7D6B'),
  ('Bonus', 'income', '🎁', '#2E7D6B'),
  ('Side Income', 'income', '💼', '#2E7D6B'),
  ('Investment', 'income', '📈', '#2E7D6B');

insert into app_settings (password_hash, theme)
  values (null, 'dark');
-- password_hash will be set by the app on first login (default PIN 5656)
