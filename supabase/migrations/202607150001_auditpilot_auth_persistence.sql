create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  encrypted_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint api_keys_user_id_key unique (user_id)
);

create index if not exists api_keys_user_id_idx on public.api_keys(user_id);

create table if not exists public.audit_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  repo_url text not null,
  chain text not null check (chain in ('solidity', 'solana', 'unknown')),
  status text not null check (status in ('running', 'completed', 'failed')),
  findings jsonb not null default '[]'::jsonb,
  pr_url text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists audit_runs_user_id_created_at_idx on public.audit_runs(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists api_keys_set_updated_at on public.api_keys;
create trigger api_keys_set_updated_at
before update on public.api_keys
for each row execute function public.set_updated_at();

alter table public.api_keys enable row level security;
alter table public.audit_runs enable row level security;

drop policy if exists "Users can select own api key" on public.api_keys;
create policy "Users can select own api key"
on public.api_keys for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own api key" on public.api_keys;
create policy "Users can insert own api key"
on public.api_keys for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own api key" on public.api_keys;
create policy "Users can update own api key"
on public.api_keys for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own api key" on public.api_keys;
create policy "Users can delete own api key"
on public.api_keys for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can select own audit runs" on public.audit_runs;
create policy "Users can select own audit runs"
on public.audit_runs for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own audit runs" on public.audit_runs;
create policy "Users can insert own audit runs"
on public.audit_runs for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own audit runs" on public.audit_runs;
create policy "Users can update own audit runs"
on public.audit_runs for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());