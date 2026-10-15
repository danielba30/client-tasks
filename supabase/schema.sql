-- Run in Supabase SQL editor. All app data access goes through the server
-- (service-role key) so RLS is enabled with no policies: anon/auth keys get nothing.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text not null,
  full_name text not null default '',
  role text not null check (role in ('elad', 'client')),
  created_at timestamptz not null default now()
);

create table public.sites (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id bigint generated always as identity primary key,
  title text not null,
  subject text not null default '',
  site_id bigint references public.sites(id) on delete set null,
  client_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending_approval'
    check (status in ('pending_approval','approved_waiting','in_progress','client_testing','in_production')),
  estimated_hours numeric(8,2),
  actual_hours numeric(8,2),
  billed boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_client_idx on public.tasks(client_id);

-- Timeline: kind = 'comment' (correspondence) or 'change' (history log)
create table public.task_events (
  id bigint generated always as identity primary key,
  task_id bigint not null references public.tasks(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('comment','change')),
  body text not null,
  created_at timestamptz not null default now()
);
create index task_events_task_idx on public.task_events(task_id, created_at);

alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.tasks enable row level security;
alter table public.task_events enable row level security;

-- Bootstrap the first Elad user after creating them in Supabase Auth
-- (Authentication -> Users -> Add user, with email + password), then:
-- insert into public.profiles (id, username, email, full_name, role)
-- values ('<auth user uuid>', 'elad', 'you@elad.co.il', 'אלעד', 'elad');
