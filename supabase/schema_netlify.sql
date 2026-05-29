-- DF Forex Pro v2 - Supabase schema para Netlify/Node sem Python local
-- Seguro para aplicar no SQL Editor do Supabase.
-- Não coloque tokens neste SQL. Chaves ficam nas Environment Variables do Netlify.

begin;

create extension if not exists pgcrypto;

-- Tipos
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('owner', 'admin', 'operator', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.trade_direction AS ENUM ('buy', 'sell', 'none');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.trade_status AS ENUM ('dry_run', 'pending', 'open', 'closed', 'cancelled', 'blocked', 'error', 'backtest');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bot_log_level AS ENUM ('debug', 'info', 'warn', 'error', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role public.user_role not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trading_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'DF Forex Pro Demo',
  broker text not null default 'deriv_api',
  account_type text not null default 'demo',
  login_id text,
  currency text default 'USD',
  balance numeric(18, 6) default 0,
  equity numeric(18, 6) default 0,
  margin numeric(18, 6) default 0,
  free_margin numeric(18, 6) default 0,
  daily_loss_pct numeric(10, 4) default 0,
  weekly_loss_pct numeric(10, 4) default 0,
  monthly_drawdown_pct numeric(10, 4) default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forex_symbols (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  display_name text,
  broker_symbol text,
  market text default 'forex',
  enabled boolean not null default true,
  min_spread numeric(18, 6),
  max_spread numeric(18, 6),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategy_versions (
  id uuid primary key default gen_random_uuid(),
  strategy_name text not null,
  version text not null,
  enabled boolean not null default true,
  description text,
  parameters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(strategy_name, version)
);

create table if not exists public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  timeframe text not null,
  candle_time timestamptz,
  open numeric(18, 8),
  high numeric(18, 8),
  low numeric(18, 8),
  close numeric(18, 8),
  spread numeric(18, 8),
  atr_value numeric(18, 8),
  ema20 numeric(18, 8),
  ema50 numeric(18, 8),
  ema200 numeric(18, 8),
  market_regime text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.economic_events (
  id uuid primary key default gen_random_uuid(),
  event_time timestamptz not null,
  currency text,
  title text not null,
  impact text,
  source text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.strategy_signals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  symbol text not null,
  timeframe text,
  strategy_name text not null,
  direction public.trade_direction not null default 'none',
  entry_price numeric(18, 8),
  stop_loss numeric(18, 8),
  take_profit numeric(18, 8),
  risk_reward numeric(10, 4),
  score numeric(10, 2) not null default 0,
  market_regime text,
  spread_points numeric(18, 8),
  atr_value numeric(18, 8),
  news_blocked boolean not null default false,
  approved boolean not null default false,
  rejection_reason text,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.strategy_rejections (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  symbol text not null,
  strategy_name text not null,
  direction public.trade_direction not null default 'none',
  score numeric(10, 2) not null default 0,
  reason text not null,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.trade_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  account_id uuid references public.trading_accounts(id) on delete set null,
  signal_id uuid references public.strategy_signals(id) on delete set null,
  broker text not null default 'deriv_api',
  broker_order_id text,
  symbol text not null,
  strategy_name text,
  direction public.trade_direction not null,
  lot_size numeric(18, 6) default 0,
  stake numeric(18, 6),
  entry_price numeric(18, 8),
  stop_loss numeric(18, 8),
  take_profit numeric(18, 8),
  status public.trade_status not null default 'dry_run',
  profit numeric(18, 6),
  profit_r numeric(18, 6),
  spread_at_entry numeric(18, 8),
  slippage numeric(18, 8),
  closed_at timestamptz,
  close_reason text,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.trade_positions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  account_id uuid references public.trading_accounts(id) on delete cascade,
  order_id uuid references public.trade_orders(id) on delete set null,
  symbol text not null,
  direction public.trade_direction not null,
  size numeric(18, 6) default 0,
  entry_price numeric(18, 8),
  current_price numeric(18, 8),
  unrealized_profit numeric(18, 6),
  stop_loss numeric(18, 8),
  take_profit numeric(18, 8),
  status text not null default 'open',
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.risk_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null,
  severity text not null default 'info',
  symbol text,
  message text not null,
  action_taken text,
  bot_paused boolean not null default false,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.daily_performance (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.trading_accounts(id) on delete cascade,
  trade_date date not null default current_date,
  starting_balance numeric(18, 6) default 0,
  ending_balance numeric(18, 6) default 0,
  realized_profit numeric(18, 6) default 0,
  unrealized_profit numeric(18, 6) default 0,
  trades_count integer default 0,
  wins_count integer default 0,
  losses_count integer default 0,
  max_drawdown_pct numeric(10, 4) default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id, trade_date)
);

create table if not exists public.bot_runtime_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  level public.bot_log_level not null default 'info',
  message text not null,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.bot_heartbeats (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null default 'netlify',
  status text not null default 'alive',
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.bot_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  is_secret boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.backtest_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  strategy_name text not null,
  symbol text,
  timeframe text,
  started_at timestamptz,
  finished_at timestamptz,
  metrics jsonb not null default '{}'::jsonb,
  parameters jsonb not null default '{}'::jsonb,
  notes text
);

create table if not exists public.backtest_trades (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.backtest_runs(id) on delete cascade,
  opened_at timestamptz,
  closed_at timestamptz,
  symbol text,
  direction public.trade_direction,
  entry_price numeric(18, 8),
  stop_loss numeric(18, 8),
  take_profit numeric(18, 8),
  exit_price numeric(18, 8),
  profit numeric(18, 6),
  profit_r numeric(18, 6),
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid,
  action text not null,
  target_table text,
  target_id uuid,
  payload jsonb not null default '{}'::jsonb
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','trading_accounts','forex_symbols','trade_orders','trade_positions','daily_performance']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

create or replace view public.v_df_forex_dashboard as
select
  (select count(*) from public.strategy_signals where created_at >= now() - interval '24 hours') as signals_24h,
  (select count(*) from public.strategy_signals where approved = true and created_at >= now() - interval '24 hours') as approved_signals_24h,
  (select count(*) from public.strategy_rejections where created_at >= now() - interval '24 hours') as rejections_24h,
  (select count(*) from public.trade_orders where created_at >= now() - interval '24 hours') as orders_24h,
  (select coalesce(sum(profit),0) from public.trade_orders where created_at >= now() - interval '24 hours') as profit_24h,
  now() as generated_at;

create or replace function public.get_account_daily_loss_pct(p_account_id uuid, p_trade_date date default current_date)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
    when starting_balance is null or starting_balance = 0 then 0
    else greatest(0, ((starting_balance - ending_balance) / starting_balance) * 100)
  end
  from public.daily_performance
  where account_id = p_account_id and trade_date = p_trade_date
  limit 1;
$$;

-- RLS: o painel desta versão não lê Supabase diretamente no navegador.
-- O backend Netlify usa service_role e bypassa RLS. Mantemos tabelas protegidas.
alter table public.profiles enable row level security;
alter table public.trading_accounts enable row level security;
alter table public.forex_symbols enable row level security;
alter table public.strategy_versions enable row level security;
alter table public.market_snapshots enable row level security;
alter table public.economic_events enable row level security;
alter table public.strategy_signals enable row level security;
alter table public.strategy_rejections enable row level security;
alter table public.trade_orders enable row level security;
alter table public.trade_positions enable row level security;
alter table public.risk_events enable row level security;
alter table public.daily_performance enable row level security;
alter table public.bot_runtime_logs enable row level security;
alter table public.bot_heartbeats enable row level security;
alter table public.bot_settings enable row level security;
alter table public.backtest_runs enable row level security;
alter table public.backtest_trades enable row level security;
alter table public.audit_logs enable row level security;

-- Dados base
insert into public.forex_symbols(symbol, display_name, broker_symbol, market, enabled)
values
  ('frxEURUSD', 'EUR/USD', 'frxEURUSD', 'forex', true),
  ('frxGBPUSD', 'GBP/USD', 'frxGBPUSD', 'forex', true),
  ('frxUSDJPY', 'USD/JPY', 'frxUSDJPY', 'forex', true),
  ('frxAUDUSD', 'AUD/USD', 'frxAUDUSD', 'forex', true),
  ('frxUSDCAD', 'USD/CAD', 'frxUSDCAD', 'forex', true)
on conflict(symbol) do update set
  display_name = excluded.display_name,
  broker_symbol = excluded.broker_symbol,
  enabled = true,
  updated_at = now();

insert into public.strategy_versions(strategy_name, version, enabled, description, parameters)
values
  ('DF_TREND_PULLBACK_CORE', '2.0.0', true, 'Trend Pullback H1/H4 adaptado para Deriv candles via Netlify Functions.', '{"min_score":80,"risk_reward":1.8,"martingale":false,"grid":false}'::jsonb),
  ('DF_LONDON_BREAKOUT', 'planned', false, 'Módulo reservado para rompimento de Londres.', '{}'::jsonb),
  ('DF_RANGE_REVERSION', 'planned', false, 'Módulo reservado para reversão à média em range.', '{}'::jsonb)
on conflict(strategy_name, version) do nothing;

insert into public.bot_settings(key, value, description, is_secret)
values
  ('safety_mode', '{"bot_mode":"dry_run","account_type":"demo","enable_order_execution":false,"allow_live_trading":false}'::jsonb, 'Configuração segura inicial. Secrets ficam no Netlify, não nesta tabela.', false),
  ('risk_limits', '{"max_risk_per_trade_pct":0.5,"max_daily_loss_pct":2,"max_weekly_loss_pct":5,"max_monthly_drawdown_pct":10}'::jsonb, 'Limites iniciais de risco.', false)
on conflict(key) do update set value = excluded.value, description = excluded.description, updated_at = now();

commit;


-- Include MT5 Bridge migration from supabase/mt5_bridge_schema.sql when applying v3.1.
