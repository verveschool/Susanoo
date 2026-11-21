# VerveSchool Workspace

Susanoo reads and writes internal hiring records in the Workspace | Verveschool Supabase project (iwayboxgzxhpjsdnfaek). The Next.js app uses the project's public key and each signed in user's access token. No fixture, service role key, or demo persona is used by the running workspace.

## Access

Create the operator's password account in this project's Supabase Authentication dashboard. Add the verified account UUID to public.workspace_members using the dashboard as an administrator. All members are trusted internal operators with shared access to operational records. Do not provision external partners in this table. Remove the membership to revoke database access immediately. On session expiry the operator signs in again.

## Operations

Start with a partner and a candidate. Create a requirement for the partner, then a submission linking the candidate and requirement. Record interviews and actual placements against that submission. Actions can be recorded and marked complete. Every screen reads from Postgres, including its empty state. Commercial posting and external partner access are unavailable.

## Development

Use Node 24. Run npm ci, npm test and npm run build. The versioned SQL migration is in supabase/migrations. For isolated development, configure a separate project in lib/workspace.ts before writing records. The SQLite model, draft SQL and test fixtures are development references only.
