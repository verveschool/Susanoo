# Phase 3 operational intelligence handover

## Incremental audit

| Area | Existing foundation | Phase 3 |
| --- | --- | --- |
| Actions | Demo open/completed tasks, independent SQLite actions and events | Six states, contextual assignment and closure in the demo, blocked review queue, and version-checked transitions in SQLite |
| Outcomes | SQLite consideration and placement assertions with correction links | Reference reasons by workflow, source and evidence for confirmed outcomes, linked follow-up, date and stage, and append-only correction with version-chain checks |
| Hiring | Brand and legal-entity links, agreement and placement keys, consideration per role, introduction and interview relationships | Requirement lifecycle and reopening, introduction detail and history, and requirement-bound evidence and assessment records in SQLite |
| Finance | Minor-unit amounts, allocations, duplicate protection and reversals | Read trace from invoice to immutable agreement version and legal entity, entitlement basis, allocation history and adjustments. Executive demo drill-down goes to the underlying synthetic finance view |
| Hosted surface | Fixture-only Next.js demo with no authenticated operational API | Interactive synthetic workflows use the existing desktop and mobile design. Demo edits remain session-only. The SQLite store remains an independent development store |
| Supabase | Hosted Susanoo project with no operational tables or migrations at audit time. Repository PostgreSQL draft denies operational access | No hosted DDL or data changes. SQLite permissions and the existing draft are tested locally, while authenticated posting and tenant isolation require deployment work against a provisioned backend |

## Workflow rules

- Open actions can start, block, complete or cancel. In-progress actions can block, complete, fail or cancel. Blocked actions can resume or cancel. Closed actions can reopen through a recorded transition, retaining their prior entries.
- Blocked work requires a blocker, responsible party and review date. Reviews and overdue active tasks are ordered by urgency then review or due date. Closing through the new path requires a reason and an account of what happened.
- The reason catalog covers actions, considerations, introductions, requirements, interviews, placements, commercial obligations and collections. Unknown, not confirmed, not provided and other are available. Other requires context. Confirmed statements require a source and evidence. Corrections point to the previous statement and retain its original text and actor. Local rollups count current assertions by reason and verification, so conflicting independent assertions can remain visible.
- Requirements move from draft and brief confirmation through sourcing and interviewing. The same record can pause and resume, or reopen from cancelled or unsuccessful with a new draft state. The roles and source data in the Partner demo remain the existing released projection.
- One candidate can have a separate consideration per requirement. Introductions and interviews link through that consideration. Each assessment criterion belongs to a requirement, and a local review requires job-relevant observation and evidence from a human reviewer. The recommendation is optional and requires its reasoning. No composite candidate score is produced.

## Financial lineage

The SQLite trace returns the invoice, the original agreement version and contracting entity, its entitlement lines and placements, the receipts and allocations with reversals, and documented invoice adjustments. Unverified agreement versions and missing basis can be identified without assigning an inferred fee. Existing agreement versions are immutable through the store interface, and a new version does not change old invoices. Allocation and adjustment rules run inside write transactions. Cross-currency and excessive allocations fail, as do adjustments that would place an invoice below its already allocated balance. Adjustments are signed minor-unit entries. Reversal adds a compensating entry with its own actor and rationale. A collection assertion does not move cash.

## Validation and public review

- The original tests remain alongside new tests for legacy upgrade, stale writes from independent connections, blocked and failed outcomes, requirement resumption, evidence and correction validation, same-requirement assessments, finance capabilities and minor-unit adjustments. The PostgreSQL test uses a local emulator and checks the existing default-deny draft.
- The public candidate page now links to the existing sharing and correction policy where applicants learn what happens next. The hiring journey already describes scope, sourcing and assessment, employer selection, and post-placement support. The exact material included in an introduction was not verified and no new representation was published. Editorial copy and existing commercial figures were preserved.
- Business-owner decisions: confirm how fixed annual CTC is defined and any exclusions or agreement variations, which event starts Net 30 and its exceptions, and the replacement period's start, eligibility, exclusions and remedy. Confirm the approved profile material shared during introductions and the role matrix for real data and financial posting.
