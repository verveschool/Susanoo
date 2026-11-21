create view public.scout_stage_totals with (security_invoker=true) as
select scout_id,coalesce(display_stage,'Not recorded') as stage,count(*) as total
from public.submissions group by scout_id,coalesce(display_stage,'Not recorded');
revoke all on public.scout_stage_totals from public,anon,authenticated;
grant select on public.scout_stage_totals to authenticated;

create table public.scout_messages (
  id uuid primary key default gen_random_uuid(),
  scout_id uuid not null references public.scouts,
  sender_id uuid not null default auth.uid() references auth.users,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.scout_messages enable row level security;
revoke all on public.scout_messages from public,anon,authenticated;
grant select,insert(scout_id,body) on public.scout_messages to authenticated;
create policy read_scout_messages on public.scout_messages for select to authenticated using (
  exists(select 1 from public.workspace_members m where m.role='executive' or (m.role='scout' and m.scout_id=scout_messages.scout_id))
);
create policy send_scout_messages on public.scout_messages for insert to authenticated with check (
  sender_id=auth.uid() and exists(select 1 from public.workspace_members m where m.role='executive' or (m.role='scout' and m.scout_id=scout_messages.scout_id))
);
