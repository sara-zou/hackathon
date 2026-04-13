-- LiveCheck — Supabase schema
-- Run this in the Supabase SQL editor: https://supabase.com/dashboard/project/_/sql

-- ── Extensions ────────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";

-- ── Tables ────────────────────────────────────────────────────────────────────

create table public.videos (
  id           text        primary key,    -- YouTube video ID (e.g. "dQw4w9WgXcQ")
  title        text        not null default '',
  channel      text        not null default '',
  type         text        not null check (type in ('live', 'vod')),
  status       text        not null default 'processing'
                           check (status in ('processing', 'complete', 'failed')),
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

create table public.fact_checks (
  id             uuid        primary key default gen_random_uuid(),
  video_id       text        not null references public.videos(id) on delete cascade,
  claim_text     text        not null,
  verdict        text        not null
                             check (verdict in (
                               'true', 'mostly-true', 'misleading',
                               'mostly-false', 'false', 'unverifiable'
                             )),
  confidence     integer     not null check (confidence >= 0 and confidence <= 100),
  summary        text        not null default '',
  timestamp_secs integer     not null default 0,
  sources        jsonb       not null default '[]',
  reasoning      jsonb       not null default '[]',
  checked_at     timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index on public.fact_checks (video_id);
create index on public.fact_checks (checked_at desc);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- The extension talks to the backend (service role), not Supabase directly.
-- RLS is enabled with no public-read policies by default.
-- Add policies here when you build a web dashboard or public API.

alter table public.videos     enable row level security;
alter table public.fact_checks enable row level security;
