create extension if not exists pgcrypto;

create table reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  report_data jsonb not null,
  summary jsonb not null,
  pdf_filename text,
  view_count integer default 0
);

-- public read, no auth required
alter table reports enable row level security;
create policy "Public read" on reports for select using (true);
create policy "Public insert" on reports for insert with check (true);
create policy "Public update" on reports for update using (true) with check (true);
