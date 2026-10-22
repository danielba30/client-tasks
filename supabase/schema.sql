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

create table public.user_sites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  site_id bigint not null references public.sites(id) on delete cascade,
  primary key (user_id, site_id)
);

create table public.statuses (
  id bigint generated always as identity primary key,
  name text not null unique,
  color text not null default 'gray',
  sort_order int not null default 0,
  is_default boolean not null default false,        -- status for new / imported tasks
  awaiting_client boolean not null default false,   -- client may change the status of tasks in it
  client_selectable boolean not null default false, -- client may move a task into it
  created_at timestamptz not null default now()
);

insert into public.statuses (name, color, sort_order, is_default, awaiting_client, client_selectable) values
  ('ממתין לאישור לקוח', 'amber',   1, true,  true,  false),
  ('מאושר, ממתין',      'sky',     2, false, false, true),
  ('בעבודה',            'indigo',  3, false, false, true),
  ('בדיקות לקוח',       'purple',  4, false, true,  false),
  ('עלה לייצור',        'emerald', 5, false, false, false);

create table public.tasks (
  id bigint generated always as identity primary key,
  title text not null,
  subject text not null default '',
  site_id bigint references public.sites(id) on delete set null,
  status_id bigint not null references public.statuses(id) on delete restrict,
  estimated_hours numeric(8,2),
  actual_hours numeric(8,2),
  billed boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_site_idx on public.tasks(site_id);

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
alter table public.statuses enable row level security;
alter table public.user_sites enable row level security;
alter table public.sites enable row level security;
alter table public.tasks enable row level security;
alter table public.task_events enable row level security;

-- Bootstrap the first Elad user after creating them in Supabase Auth
-- (Authentication -> Users -> Add user, with email + password), then:
-- insert into public.profiles (id, username, email, full_name, role)
-- values ('<auth user uuid>', 'elad', 'you@elad.co.il', 'אלעד', 'elad');
