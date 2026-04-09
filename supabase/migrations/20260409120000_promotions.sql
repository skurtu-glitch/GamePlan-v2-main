-- Supabase-ready schema for promotions (optional; app defaults to data/promotions.json).
-- Run in Supabase SQL editor or via CLI when wired up.

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  service_id text not null,
  description text not null,
  type text not null check (type in ('free_trial', 'discount', 'bundle_credit')),
  free_months integer null,
  discount_percent numeric null,
  intro_price_usd numeric null,
  discount_amount_usd numeric null,
  duration_months integer null,
  expires_at timestamptz null,
  last_updated timestamptz not null default now(),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  source_label text not null default '',
  source_url text null,
  created_at timestamptz not null default now()
);

create unique index if not exists promotions_service_id_key on public.promotions (service_id);

comment on table public.promotions is 'Streaming promo rows; app can sync from JSON or this table.';
