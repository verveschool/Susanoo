alter table public.partner_releases add column submission_id uuid unique references public.submissions(id);
grant insert(submission_id) on public.partner_releases to authenticated;
grant delete on public.partner_releases to authenticated;
create policy revoke_release on public.partner_releases for delete to authenticated using (exists(select 1 from public.workspace_members m where m.role='executive'));
