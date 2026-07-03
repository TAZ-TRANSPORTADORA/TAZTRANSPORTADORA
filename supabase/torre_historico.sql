create table if not exists public.torre_snapshots (
  id bigserial primary key,
  captured_at timestamptz not null,
  company text not null default '',
  vin text not null,
  vehicle_name text not null default '',
  plate text not null default '',
  horse_plate text not null default '',
  status text not null default '',
  speed_kmh numeric,
  odometer_km numeric,
  total_fuel_l numeric,
  diesel_pct numeric,
  arla_pct numeric,
  latitude numeric,
  longitude numeric,
  alert_count integer not null default 0,
  alerts jsonb not null default '[]'::jsonb,
  source text not null default 'scania',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (vin, captured_at)
);

create index if not exists torre_snapshots_captured_at_idx
  on public.torre_snapshots (captured_at desc);

create index if not exists torre_snapshots_vin_captured_at_idx
  on public.torre_snapshots (vin, captured_at desc);

create index if not exists torre_snapshots_company_captured_at_idx
  on public.torre_snapshots (company, captured_at desc);

alter table public.torre_snapshots enable row level security;

-- Sem politica de SELECT para usuarios comuns.
-- A leitura deve acontecer pela Netlify Function, que aplica os filtros de empresa.
-- A chave secreta do Supabase no Netlify consegue inserir/ler por ser chave de servidor.
