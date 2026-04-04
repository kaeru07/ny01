-- ============================================
-- template_prompts テーブル
-- AI作業テンプレート（プロンプト管理画面用）
-- Supabase の SQL エディタで実行する
-- ============================================

create table if not exists template_prompts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null default '',
  category    text not null default '',
  description text not null default '',
  content     text not null default '',
  tags        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RLS を有効化
alter table template_prompts enable row level security;

-- 自分のデータのみ読み書き可能
create policy "users_own_template_prompts"
  on template_prompts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
