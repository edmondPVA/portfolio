-- Portfolio admin: database setup (Phases 1-2: admin access + messages inbox)
-- Run this in Supabase: SQL Editor -> New query -> paste -> Run.
-- It is safe to run more than once.
--
-- Before running: create your admin user under Authentication -> Users
-- (use the same email as in section 3 below), and keep public sign-ups turned off.

-- ---------------------------------------------------------------------------
-- 1. Who is allowed to be an administrator
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- No policies on purpose: nobody can read or change this table through the public API.
revoke all on public.admins from anon, authenticated;

-- Helper used by the security rules and by the dashboard to confirm admin access.
-- It runs with the owner's rights so it can read the locked-down admins table.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Messages sent from the portfolio contact form
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null check (char_length(btrim(name))    between 1 and 100),
  email      text        not null check (char_length(email)          between 3 and 150
                                          and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  subject    text        not null check (char_length(btrim(subject)) between 1 and 150),
  message    text        not null check (char_length(btrim(message)) between 1 and 3000),
  is_read    boolean     not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_created_at_idx on public.messages (created_at desc);

alter table public.messages enable row level security;

-- Table privileges. Row Level Security below still decides which rows are allowed.
revoke all on public.messages from anon, authenticated;
-- Visitors may only fill in the four form fields (they cannot set id, date or read status).
grant insert (name, email, subject, message) on public.messages to anon, authenticated;
-- The admin may read, delete, and change ONLY the read/unread flag.
grant select, delete on public.messages to authenticated;
grant update (is_read) on public.messages to authenticated;

drop policy if exists "Visitors can send a message"  on public.messages;
drop policy if exists "Admins can read messages"     on public.messages;
drop policy if exists "Admins can update messages"   on public.messages;
drop policy if exists "Admins can delete messages"   on public.messages;

-- Visitors can ONLY add new, unread messages. They can never read, change or delete anything.
create policy "Visitors can send a message"
  on public.messages for insert
  to anon, authenticated
  with check (is_read = false);

create policy "Admins can read messages"
  on public.messages for select
  to authenticated
  using (public.is_admin());

create policy "Admins can update messages"
  on public.messages for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete messages"
  on public.messages for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. Make YOUR account an administrator
-- ---------------------------------------------------------------------------
-- Change the email below if you created your Supabase user with a different one.
insert into public.admins (user_id)
select id from auth.users where lower(email) = 'edmondpolinar@gmail.com'
on conflict do nothing;

-- Check: this should return one row with your email.
-- If it returns no rows, create the user under Authentication -> Users first, then run this again.
select u.email, a.created_at
from public.admins a
join auth.users u on u.id = a.user_id;
