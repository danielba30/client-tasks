-- Run after 001_statuses.sql. A "client" is now a site: client users are linked
-- to sites and see only the tasks of those sites.

create table public.user_sites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  site_id bigint not null references public.sites(id) on delete cascade,
  primary key (user_id, site_id)
);
alter table public.user_sites enable row level security;

-- Keep existing access: link each client user to the sites of their current tasks.
insert into public.user_sites (user_id, site_id)
select distinct client_id, site_id from public.tasks where site_id is not null
on conflict do nothing;

alter table public.tasks drop column client_id;
