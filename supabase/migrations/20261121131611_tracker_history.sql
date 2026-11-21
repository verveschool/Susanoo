alter table public.candidates add column email text;
create unique index candidates_email_identity on public.candidates(lower(email)) where email is not null;
alter table public.submissions add column source_url text, add column source_date_text text, add column source_stage text;
alter table public.interviews alter column scheduled_at drop not null, add column scheduled_on date, add column round_label text, add constraint interview_has_date check (num_nonnulls(scheduled_at,scheduled_on)=1);
create unique index interviews_tracking_round on public.interviews(submission_id,scheduled_on,round_label) where scheduled_on is not null;
