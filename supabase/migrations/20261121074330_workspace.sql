-- Single internal VerveSchool workspace. Membership is provisioned by an administrator.
create table public.workspace_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.workspace_members enable row level security;
revoke all on public.workspace_members from public, anon, authenticated;
grant select on public.workspace_members to authenticated;
create policy own_membership on public.workspace_members for select to authenticated using (user_id = (select auth.uid()));

create table public.partners (id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name)) between 1 and 200), created_at timestamptz not null default now());
create table public.candidates (id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name)) between 1 and 200), created_at timestamptz not null default now());
create table public.requirements (id uuid primary key default gen_random_uuid(), title text not null check (length(trim(title)) between 1 and 200), partner_id uuid not null references public.partners, created_at timestamptz not null default now());
create table public.submissions (id uuid primary key default gen_random_uuid(), candidate_id uuid not null references public.candidates, requirement_id uuid not null references public.requirements, created_at timestamptz not null default now(), unique(candidate_id,requirement_id));
create table public.interviews (id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.submissions, scheduled_at timestamptz not null, created_at timestamptz not null default now(), unique(submission_id, scheduled_at));
create table public.placements (id uuid primary key default gen_random_uuid(), submission_id uuid not null unique references public.submissions, joined_on date not null, created_at timestamptz not null default now());
create table public.actions (id uuid primary key default gen_random_uuid(), title text not null check (length(trim(title)) between 1 and 200), complete boolean not null default false, created_at timestamptz not null default now());

do $migration$
declare relation text;
declare columns text;
begin
  for relation, columns in select * from (values ('partners','id,name'),('candidates','id,name'),('requirements','id,title,partner_id'),('submissions','id,candidate_id,requirement_id'),('interviews','id,submission_id,scheduled_at'),('placements','id,submission_id,joined_on'),('actions','id,title')) as allowed(tbl,cols) loop
    execute format('alter table public.%I enable row level security', relation);
    execute format('revoke all on public.%I from public, anon, authenticated', relation);
    execute format('grant select, insert (%s) on public.%I to authenticated', columns, relation);
    execute format('create policy workspace_access on public.%I to authenticated using (exists(select 1 from public.workspace_members)) with check (exists(select 1 from public.workspace_members))', relation);
  end loop;
end $migration$;
grant update(complete) on public.actions to authenticated;
