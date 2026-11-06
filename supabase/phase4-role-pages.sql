-- Portfolio admin: Phase 4 (choose which page each role shows on)
-- Run this once in the Supabase SQL editor BEFORE publishing the new dashboard code.
-- It adds a "track" column: 'va' (Virtual assistant page), 'qa' (Quality Assurance page) or 'both'.

alter table public.experience
  add column if not exists track text not null default 'both'
  check (track in ('va', 'qa', 'both'));

-- Sensible starting values for the roles you already have. You can change any of them in the dashboard afterwards.
update public.experience set track = 'qa'
  where track = 'both' and role ilike any (array['%tester%', '%QA%', '%quality assurance%']) and role not ilike '%assistant%';
update public.experience set track = 'va'
  where track = 'both' and role ilike '%assistant%' and role not ilike '%tester%' and role not ilike '%quality%';

select role, company, track from public.experience order by sort_order, created_at;
