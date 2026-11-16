# Susanoo — VerveSchool OS synthetic operational foundation

A separate local Next.js / React / TypeScript design-and-operations demo based on the 16 November 2026 Verveschool OS Complete Blueprint. All records, personas, names, amounts and dates are fixtures. Do not put real candidate, employee, partner or financial data in this build.

## Run locally

Requires Node.js 20.9+ and npm. `npm install`, then `npm run dev`; open the local URL printed by Next.js. `npm test` checks the illustrative money stages and the partner demo projection; `npm run build` checks the app build.

Workspace navigation, record drill-downs, filtering, temporary task completion and reset are available. Task changes live only in memory and disappear on refresh. No outbound messages, payments, document upload, service integration or deployment are configured.

## Boundaries and gaps

This is an early synthetic experience, not the blueprint's completed Phase 1A/1B or a system for live operations. The app has no authentication, server-enforced authorisation, database, persistence, audit, private document storage, backups, import staging, posting transactions or partner isolation. The allowlisted sample projection demonstrates presentation only and **is not security**. No actual external partner access is enabled or safe. Never deploy it as a portal for real data.

The example calculations distinguish estimates, earned fees, invoice gross and allocated bank cash; they do not implement contract eligibility, tax, receipt allocation, posting or commission policy. Approval of executed agreements, fee rules, commission basis, tax treatment, approval authority, privacy policy and other U decisions in the blueprint remains necessary. The 20% / 60% example is an illustrative fixture only.

Next steps: agree a backend/provider and deployment separately; implement default-deny server authorisation and scoped read models, transactional Postgres schema and audit, private storage and restore testing; then deliver reviewed operational write flows and financial invariants. Test partner isolation, sharing and revocation before any real external access. No source data import until the secured-foundation gates pass.

## Verification in this environment

The project has its own npm lockfile. `npm test` covers the synthetic SQLite store and a default-deny PostgreSQL draft in the isolated PGlite test engine. `npm run build` builds the current Next.js app with its pinned dependencies. These checks do not verify a live Supabase installation, browser-to-database requests or operational access policies. The web interface remains a synthetic session-only demo.

## Talent Ops and local source references

On phones the workspace switcher and navigation menu stay at the top, with frequently used actions in a bottom bar. The Talent Ops “Add candidate” flow accepts fictional names only and stores drafts in browser memory for the session. The account panel is a visual preview, not authentication or user provisioning.

The local-only `.env.local` lists company names observed in pipeline filenames. Those names do not establish current partner relationships or validate any account or pipeline figures. Never deploy this local environment file or its compiled output. The attempted shareable preview sends selected source files without `.env.local`; real source names and all actual candidate, employee and financial data are excluded.

## Local operational-domain work (synthetic only)

`lib/operational-store.mjs` is a standalone local Node SQLite development store and is **not connected to the web UI or to Supabase**. It is exercised by `tests/operational-store.test.mjs` using a temporary on-disk database and synthetic actors. It records relationships, actions and events, outcome assertions, invoice/receipt/allocation records and allocation reversals. Run its tests with Node 24 using `npm test`.

These tests validate library behaviour, not authentication or production authorisation. The role argument is trusted by the library and must never be accepted from a browser. The SQLite store has no Postgres RLS, and its role rules are provisional test constraints, not an approved access matrix. A dedicated development project, managed identity, authenticated server operations and enforced data policies are required before exposing the store or loading real records. Finance calculations are illustrative: invoice issuance, approval, tax, reporting periods, reconciliation, credits and revenue recognition require approved business definitions and additional implementation. No code here establishes contractual eligibility or approved financial amounts.

The web interface continues to show the existing session-only demo; it does not claim this development store is its backend. The theme setting remains unimplemented because no existing OS user settings, authenticated users or OS Supabase project could be verified.

## Supabase development draft

`supabase/config.toml` is local configuration only and is not linked to a hosted project. Public self-signup is disabled in that local configuration. `supabase/drafts/20261116163520_core_foundation.sql.draft` is deliberately outside the migrations directory: it must not be applied until reviewed and tested in the selected development project. It enables RLS and denies operational table access by default, while defining owner-only policies for theme settings that require an active Talent Ops or partner membership. It does not yet include operational access policies, secure transaction functions, audit enforcement or a connected theme UI. A passing PGlite test uses a simulated `auth.uid()` and does not replace tests against actual Supabase Auth or the Data API.
