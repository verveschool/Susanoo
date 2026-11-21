create table public.scouts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);
alter table public.scouts enable row level security;
revoke all on public.scouts from public, anon, authenticated;
grant select on public.scouts to authenticated;

alter table public.workspace_members
  add column role text not null default 'executive' check (role in ('executive','scout','partner')),
  add column scout_id uuid references public.scouts,
  add column partner_id uuid references public.partners,
  add constraint valid_workspace_identity check (
    (role='executive' and scout_id is null and partner_id is null) or
    (role='scout' and scout_id is not null and partner_id is null) or
    (role='partner' and partner_id is not null and scout_id is null)
  );
alter table public.workspace_members alter column role drop default;
alter table public.submissions add column scout_id uuid references public.scouts, add column scout_source text;
alter table public.candidates add column scout_id uuid references public.scouts;
alter table public.actions add column scout_id uuid references public.scouts;
create index submissions_scout_id on public.submissions(scout_id);
create index candidates_scout_id on public.candidates(scout_id);
create index actions_scout_id on public.actions(scout_id);

create policy scout_directory on public.scouts for select to authenticated using (
  exists(select 1 from public.workspace_members m where m.role='executive' or m.scout_id=scouts.id)
);

-- Partner accounts only see explicitly released, narrow snapshots. Internal source URLs
-- and personal contact details cannot be selected from the underlying tables.
create table public.partner_releases (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners,
  candidate_name text not null,
  requirement text not null,
  stage text not null,
  created_at timestamptz not null default now()
);
alter table public.partner_releases enable row level security;
revoke all on public.partner_releases from public,anon,authenticated;
grant select,insert(partner_id,candidate_name,requirement,stage) on public.partner_releases to authenticated;
create policy read_releases on public.partner_releases for select to authenticated using (
 exists(select 1 from public.workspace_members m where m.role='executive' or (m.role='partner' and m.partner_id=partner_releases.partner_id))
);
create policy create_releases on public.partner_releases for insert to authenticated with check (
 exists(select 1 from public.workspace_members m where m.role='executive')
);

drop policy workspace_access on public.partners;
create policy read_partners on public.partners for select to authenticated using (
 exists(select 1 from public.workspace_members m where m.role in ('executive','scout') or m.partner_id=partners.id)
);
create policy create_partners on public.partners for insert to authenticated with check (
 exists(select 1 from public.workspace_members m where m.role='executive')
);
drop policy workspace_access on public.requirements;
create policy read_requirements on public.requirements for select to authenticated using (
 exists(select 1 from public.workspace_members m where m.role in ('executive','scout') or m.partner_id=requirements.partner_id)
);
create policy create_requirements on public.requirements for insert to authenticated with check (
 exists(select 1 from public.workspace_members m where m.role='executive')
);

drop policy workspace_access on public.submissions;
create policy read_submissions on public.submissions for select to authenticated using (
 exists(select 1 from public.workspace_members m where m.role='executive' or (m.role='scout' and m.scout_id=submissions.scout_id))
);
drop policy workspace_access on public.candidates;
create policy read_candidates on public.candidates for select to authenticated using (
 exists(select 1 from public.workspace_members m where m.role='executive' or (m.role='scout' and (
   m.scout_id=candidates.scout_id or exists(select 1 from public.submissions s where s.candidate_id=candidates.id and s.scout_id=m.scout_id)
 )))
);
grant insert(scout_id,email) on public.candidates to authenticated;
create policy create_candidates on public.candidates for insert to authenticated with check (
 exists(select 1 from public.workspace_members m where m.role='executive' or (m.role='scout' and m.scout_id=candidates.scout_id))
);
grant insert(scout_id) on public.submissions to authenticated;
create policy create_submissions on public.submissions for insert to authenticated with check (
 exists(select 1 from public.workspace_members m where m.role='executive' or (m.role='scout' and m.scout_id=submissions.scout_id and exists(select 1 from public.candidates c where c.id=submissions.candidate_id)))
);
drop policy workspace_access on public.interviews;
create policy read_interviews on public.interviews for select to authenticated using (exists(select 1 from public.submissions s where s.id=interviews.submission_id));
create policy create_interviews on public.interviews for insert to authenticated with check (exists(select 1 from public.submissions s where s.id=interviews.submission_id));
drop policy workspace_access on public.placements;
create policy read_placements on public.placements for select to authenticated using (exists(select 1 from public.submissions s where s.id=placements.submission_id));
create policy create_placements on public.placements for insert to authenticated with check (
 exists(select 1 from public.workspace_members m where m.role='executive')
);
drop policy workspace_access on public.actions;
grant insert(scout_id) on public.actions to authenticated;
create policy read_actions on public.actions for select to authenticated using (
 exists(select 1 from public.workspace_members m where m.role='executive' or (m.role='scout' and m.scout_id=actions.scout_id))
);
create policy create_actions on public.actions for insert to authenticated with check (
 exists(select 1 from public.workspace_members m where m.role='executive' or (m.role='scout' and m.scout_id=actions.scout_id))
);
create policy update_actions on public.actions for update to authenticated using (
 exists(select 1 from public.workspace_members m where m.role='executive' or (m.role='scout' and m.scout_id=actions.scout_id))
) with check (
 exists(select 1 from public.workspace_members m where m.role='executive' or (m.role='scout' and m.scout_id=actions.scout_id))
);
