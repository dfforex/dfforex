-- DF Forex Pro v3.1 - MT5 Bridge migration
-- Rode este arquivo no Supabase SQL Editor depois do schema principal.

create extension if not exists pgcrypto;

create table if not exists public.mt5_bridge_status (
  bridge_id text primary key,
  status text default 'offline',
  bot_running boolean default false,
  account_login text,
  account_name text,
  account_server text,
  account_type text default 'demo',
  balance numeric,
  equity numeric,
  margin numeric,
  free_margin numeric,
  open_positions integer,
  terminal_connected boolean,
  trade_allowed boolean,
  last_error text,
  last_seen_at timestamptz,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.mt5_bridge_settings (
  bridge_id text primary key,
  broker_name text default 'Deriv MT5',
  account_login text,
  account_server text default 'Deriv-Demo',
  account_type text default 'demo',
  symbols jsonb default '["EURUSD","GBPUSD","USDJPY","XAUUSD"]'::jsonb,
  risk_per_trade_pct numeric default 0.5,
  fixed_lot numeric default 0.01,
  scan_interval_seconds integer default 60,
  updated_by text,
  secret_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.mt5_commands (
  id uuid primary key default gen_random_uuid(),
  bridge_id text not null default 'df-forex-main',
  action text not null,
  payload jsonb default '{}'::jsonb,
  status text not null default 'queued',
  source text default 'dashboard',
  requested_by text,
  response jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  sent_at timestamptz,
  processed_at timestamptz
);

alter table public.bot_runtime_logs add column if not exists bridge_id text;
alter table public.strategy_signals add column if not exists payload jsonb default '{}'::jsonb;
alter table public.trade_orders add column if not exists mt5_ticket text;
alter table public.trade_orders add column if not exists payload jsonb default '{}'::jsonb;

create unique index if not exists trade_orders_mt5_ticket_idx on public.trade_orders(mt5_ticket) where mt5_ticket is not null and mt5_ticket <> '';
create index if not exists mt5_commands_bridge_status_idx on public.mt5_commands(bridge_id,status,created_at);
create index if not exists mt5_bridge_status_last_seen_idx on public.mt5_bridge_status(last_seen_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_mt5_bridge_status_updated_at on public.mt5_bridge_status;
create trigger trg_mt5_bridge_status_updated_at before update on public.mt5_bridge_status for each row execute function public.set_updated_at();

drop trigger if exists trg_mt5_bridge_settings_updated_at on public.mt5_bridge_settings;
create trigger trg_mt5_bridge_settings_updated_at before update on public.mt5_bridge_settings for each row execute function public.set_updated_at();

alter table public.mt5_bridge_status enable row level security;
alter table public.mt5_bridge_settings enable row level security;
alter table public.mt5_commands enable row level security;

-- O painel usa Netlify Functions com service_role, então RLS pode ficar fechada.
do $$ begin
  create policy "service role full mt5 status" on public.mt5_bridge_status for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "service role full mt5 settings" on public.mt5_bridge_settings for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "service role full mt5 commands" on public.mt5_commands for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
exception when duplicate_object then null; end $$;
