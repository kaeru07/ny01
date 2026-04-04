-- ============================================
-- AICOMPANY / Claude Dev Studio — Supabase セットアップ
-- Supabase の SQL エディタで実行する
-- ============================================

-- projects テーブル
-- todos は JSONB で保存（配列）
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default '',
  summary text default '',
  target text default '',
  problem text default '',
  mvp_features text default '',
  future_features text default '',
  tech_stack text default '',
  design_policy text default '',
  memo text default '',
  status text default 'planning',
  todos jsonb default '[]'::jsonb,
  next_action text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- url カラム追加（既存テーブルに追加する場合はこちらを実行）
alter table projects add column if not exists url text default '';

-- projects に RLS を有効化
alter table projects enable row level security;

-- 自分のデータのみ読み書き可能
create policy "users_own_projects"
  on projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- prompts テーブル
create table if not exists prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade not null,
  category text not null default 'new',
  version text default 'v1',
  title text not null default '',
  body text default '',
  change_memo text default '',
  target_role text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- prompts に RLS を有効化
alter table prompts enable row level security;

create policy "users_own_prompts"
  on prompts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================
-- Supabase Auth 設定（ダッシュボード側で行う）
-- Authentication > Providers > Email を有効化
-- "Confirm email" を OFF にする（magic link のみ使用のため）
-- または "Enable email OTP" を ON にする
-- ============================================
