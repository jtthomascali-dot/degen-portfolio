-- Run this in your Supabase SQL editor (supabase.com → your project → SQL Editor)

create table analyses (
  id            uuid default gen_random_uuid() primary key,
  share_id      text unique not null,
  created_at    timestamp with time zone default now(),
  holdings      jsonb not null,
  score         integer not null,
  verdict       text not null,
  vibes         text,
  roast         text,
  diversification text,
  volatility    text,
  risk_summary  text,
  one_good_thing text,
  holdings_breakdown jsonb,
  is_public     boolean default true
);

-- Allow anyone to read public analyses (for leaderboard + share links)
alter table analyses enable row level security;

create policy "Public analyses are viewable by everyone"
  on analyses for select
  using (is_public = true);

create policy "Anyone can insert"
  on analyses for insert
  with check (true);

-- Index for leaderboard query performance
create index analyses_score_idx on analyses(score desc) where is_public = true;
create index analyses_share_id_idx on analyses(share_id);
