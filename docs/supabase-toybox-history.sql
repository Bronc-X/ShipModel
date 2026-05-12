create table if not exists public.toybox_history (
  id text primary key,
  run_id text,
  title text not null,
  label text not null,
  status text not null check (status in ('saved', 'concept', 'ready', 'failed')),
  input jsonb not null,
  concepts jsonb not null default '[]'::jsonb,
  selected_concept_id text,
  preview_image_url text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

alter table public.toybox_history enable row level security;

drop policy if exists "toybox history public insert" on public.toybox_history;
drop policy if exists "toybox history public update" on public.toybox_history;
drop policy if exists "toybox history public read" on public.toybox_history;

create policy "toybox history public insert"
on public.toybox_history
for insert
to anon
with check (true);

create policy "toybox history public update"
on public.toybox_history
for update
to anon
using (true)
with check (true);

create policy "toybox history public read"
on public.toybox_history
for select
to anon
using (true);
