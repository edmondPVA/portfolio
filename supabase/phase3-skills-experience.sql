-- Portfolio admin: Phase 3 (Skills and Work Experience managers)
-- Run this in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- Run supabase/schema.sql first (it creates public.is_admin()).
--
-- What it does:
--   * Creates two tables: skills (your tools and platforms) and experience (your roles).
--   * Visitors may only READ rows that are marked visible. Only you (an admin) can add, change or delete.
--   * Fills both tables with what your portfolio shows today, so the public page does not change.

-- ---------------------------------------------------------------------------
-- 1. Skills (the "Tools & platforms" chips, grouped)
-- ---------------------------------------------------------------------------
create table if not exists public.skills (
  id         uuid primary key default gen_random_uuid(),
  group_name text    not null check (char_length(btrim(group_name)) between 1 and 60),
  name       text    not null check (char_length(btrim(name)) between 1 and 80),
  sort_order integer not null default 0,
  visible    boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Work experience
--    start_label / end_label are free text such as "Sept 2024". Both are optional.
--    is_current shows "Present" as the end. bullets holds one point per line.
-- ---------------------------------------------------------------------------
create table if not exists public.experience (
  id          uuid primary key default gen_random_uuid(),
  role        text    not null check (char_length(btrim(role)) between 1 and 150),
  company     text    not null default '' check (char_length(company) <= 150),
  start_label text    not null default '' check (char_length(start_label) <= 30),
  end_label   text    not null default '' check (char_length(end_label) <= 30),
  is_current  boolean not null default false,
  bullets     text    not null default '' check (char_length(bullets) <= 4000),
  sort_order  integer not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Security rules
-- ---------------------------------------------------------------------------
alter table public.skills     enable row level security;
alter table public.experience enable row level security;

revoke all on public.skills, public.experience from anon, authenticated;
grant select on public.skills, public.experience to anon, authenticated;
grant insert, update, delete on public.skills, public.experience to authenticated;

drop policy if exists "Anyone can read visible skills"   on public.skills;
drop policy if exists "Admins manage skills"             on public.skills;
drop policy if exists "Anyone can read visible roles"    on public.experience;
drop policy if exists "Admins manage experience"         on public.experience;

create policy "Anyone can read visible skills"
  on public.skills for select to anon, authenticated
  using (visible = true or public.is_admin());

create policy "Admins manage skills"
  on public.skills for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Anyone can read visible roles"
  on public.experience for select to anon, authenticated
  using (visible = true or public.is_admin());

create policy "Admins manage experience"
  on public.experience for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. Starting content (copied from the live portfolio; only added if the tables are empty)
-- ---------------------------------------------------------------------------
insert into public.skills (group_name, name, sort_order)
select v.g, v.n, v.o from (values
  ($q$Spreadsheets & documents$q$, $q$Google Sheets$q$, 1),
  ($q$Spreadsheets & documents$q$, $q$Google Workspace$q$, 2),
  ($q$Spreadsheets & documents$q$, $q$Microsoft Excel$q$, 3),
  ($q$Spreadsheets & documents$q$, $q$Microsoft Office$q$, 4),
  ($q$Communication$q$, $q$Slack$q$, 5),
  ($q$Communication$q$, $q$Microsoft Teams$q$, 6),
  ($q$Communication$q$, $q$Zoom$q$, 7),
  ($q$Communication$q$, $q$Skype$q$, 8),
  ($q$Communication$q$, $q$Outlook$q$, 9),
  ($q$Communication$q$, $q$WhatsApp$q$, 10),
  ($q$Communication$q$, $q$Missive$q$, 11),
  ($q$CRM & tracking$q$, $q$Pipedrive$q$, 12),
  ($q$CRM & tracking$q$, $q$Jira$q$, 13),
  ($q$CRM & tracking$q$, $q$AI-Generated CRM Practice Environment$q$, 14),
  ($q$AI tools$q$, $q$ChatGPT$q$, 15),
  ($q$AI tools$q$, $q$Claude$q$, 16),
  ($q$AI tools$q$, $q$Gemini$q$, 17)
) as v(g, n, o)
where not exists (select 1 from public.skills);

insert into public.experience (role, company, start_label, end_label, is_current, bullets, sort_order)
select v.r, v.c, v.s, v.e, false, v.b, v.o from (values
  ($q$Quality Assurance Analyst: Software Tester & SME Assistant$q$, $q$LotusFlare | T-Mobile Fiber Project$q$, $q$$q$, $q$Feb 2025$q$, $q$Designed an automation that stores order data in Google Sheets after a buyflow runs through order submission, and built an automated buyflow testing script.
Created and maintained 1000+ detailed test cases and documentation, kept organized, accurate, and easy to follow.
Identified and documented 100+ bugs and defects and caught major defects before production deployment.
Supported the live production deployment as one of the QA testers, contributing to a smooth launch.
Created Master Information Documents on key processes and workflows to help new team members learn the project.
Trusted assistant to the SME on the team's most crucial shift, providing reliable support by handling daily responsibilities.
Trained new team members on project workflows, testing procedures, and quality standards to support effective onboarding.$q$, 1),
  ($q$Chat & Email Support / Logistics$q$, $q$Red Wireless$q$, $q$Sept 2024$q$, $q$$q$, $q$Achieved 95% of available QA evaluation points, showing consistent accuracy and quality.
Documented ticket dates and details in a spreadsheet for tracking and accuracy.
Resolved customer inquiries by chat and email, handled logistics issues, and recommended products based on customer needs.$q$, 2),
  ($q$Office Assistant (SPES)$q$, $q$Integrated Barangay Affairs, City Hall$q$, $q$July 2023$q$, $q$$q$, $q$Assisted the office with day-to-day records work — encoding and maintaining data in Excel, and receiving, sorting, and filing incoming documents — so staff could stay focused on higher-priority community programs.$q$, 3),
  ($q$Office Assistant (SPES)$q$, $q$COMELEC$q$, $q$March 2022$q$, $q$$q$, $q$Assisted election officers with day-to-day verification work — reviewing voter information for accuracy and handling confidential records with discretion — so officers could stay focused on higher-priority election preparations.$q$, 4)
) as v(r, c, s, e, b, o)
where not exists (select 1 from public.experience);

-- Check: should show how many rows were created.
select (select count(*) from public.skills) as skills, (select count(*) from public.experience) as roles;
