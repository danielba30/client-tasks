-- Run once in the Supabase SQL editor on an existing database.
-- Moves task statuses from a hard-coded check constraint to an editable table.

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
alter table public.statuses enable row level security;

insert into public.statuses (name, color, sort_order, is_default, awaiting_client, client_selectable) values
  ('ממתין לאישור לקוח', 'amber',   1, true,  true,  false),
  ('מאושר, ממתין',      'sky',     2, false, false, true),
  ('בעבודה',            'indigo',  3, false, false, true),
  ('בדיקות לקוח',       'purple',  4, false, true,  false),
  ('עלה לייצור',        'emerald', 5, false, false, false);

alter table public.tasks add column status_id bigint references public.statuses(id) on delete restrict;

update public.tasks t set status_id = s.id from public.statuses s where s.name = case t.status
  when 'pending_approval' then 'ממתין לאישור לקוח'
  when 'approved_waiting' then 'מאושר, ממתין'
  when 'in_progress'      then 'בעבודה'
  when 'client_testing'   then 'בדיקות לקוח'
  when 'in_production'    then 'עלה לייצור' end;

alter table public.tasks alter column status_id set not null;
alter table public.tasks drop column status;
