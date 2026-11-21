import { ChoiceField, SaveButton } from "./form-controls";
import { RecordTable } from "./record-table";
import { Shell, href, type View } from "./workspace-shell";
import { Overview } from "./overview";
import { randomUUID } from "node:crypto";
import { save, signIn, signOut } from "./operations";
import {
  isSection,
  records,
  request,
  sections,
  session,
  type Section,
} from "../lib/workspace";

const notices: Record<string, string> = {
  signin: "Check your email and password and try again.",
  expired: "Your session has ended. Sign in again.",
  saved: "Saved to the workspace.",
  duplicate: "This record already exists.",
  invalid: "Complete all required fields.",
  failed: "The record could not be saved. Check your access and try again.",
};
const dependencies: Partial<Record<Section, Section[]>> = {
  requirements: ["partners"],
  submissions: ["candidates", "requirements"],
  interviews: ["submissions"],
  placements: ["submissions"],
};
const fieldNames: Partial<Record<Section, string>> = {
  partners: "partner_id",
  candidates: "candidate_id",
  requirements: "requirement_id",
  submissions: "submission_id",
};
const singular: Record<Section, string> = {
  partners: "partner",
  requirements: "requirement",
  candidates: "candidate",
  submissions: "submission",
  interviews: "interview",
  placements: "placement",
  actions: "action",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const key = typeof params.section === "string" ? params.section : "overview";
  const view: View =
    params.view === "partner"
      ? "partner"
      : params.view === "team" ||
          (!params.view &&
            ["candidates", "submissions", "interviews"].includes(key))
        ? "team"
        : "executive";
  const notice =
    typeof params.notice === "string" ? notices[params.notice] : "";
  const token = await session();
  const access = token
    ? await request("/rest/v1/workspace_members?select=user_id&limit=1", token)
    : null;
  if (!token || access?.status === 401)
    return (
      <main>
        <section className="card entry">
          <h1>VerveSchool Workspace</h1>
          <p>Sign in with your workspace account.</p>
          <form action={signIn}>
            <label className="field">
              Email
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </label>
            <label className="field">
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button className="verve-primary primary">Sign in</button>
          </form>
          <p role="status">{notice}</p>
        </section>
      </main>
    );
  if (!access?.ok) throw new Error("Workspace connection unavailable");
  const members = await access.json();
  if (!members.length)
    return (
      <main>
        <section className="card entry">
          <h1>Workspace access required</h1>
          <p>Ask your workspace administrator to enable your account.</p>
          <form action={signOut}>
            <button className="outline">Sign out</button>
          </form>
        </section>
      </main>
    );
  if (
    view === "partner" ||
    ["finance", "collections", "readiness", "earnings"].includes(key)
  ) {
    const info: Record<string, [string, string]> = {
      partner: [
        "Partner workspace",
        "Partner access is pending. Candidate profiles can be shared here once release permissions are connected.",
      ],
      finance: [
        "Finance",
        "Fee and invoice records have not been reconciled with the workspace yet.",
      ],
      collections: [
        "Collections",
        "Receipt allocations are pending reconciliation.",
      ],
      earnings: ["My earnings", "Verified commission records are pending."],
      readiness: [
        "Rules & readiness",
        "Internal hiring records are connected. Partner releases, invoice posting and commission calculations are pending.",
      ],
    };
    const [title, body] = info[view === "partner" ? "partner" : key];
    return (
      <Shell view={view} section={key}>
        <div className="page-title">
          <h1>{title}</h1>
        </div>
        <p className="notice">{body}</p>
      </Shell>
    );
  }
  if (!isSection(key))
    return (
      <Shell view={view} section="overview">
        <Overview view={view} token={token} />
      </Shell>
    );
  const section = key;
  const adding = params.add === "1";
  const page = Math.max(
    0,
    Math.min(1000000, Math.floor(Number(params.page) || 0)),
  );
  const searchable = [
    "candidates",
    "partners",
    "requirements",
    "actions",
  ].includes(section);
  const query =
    searchable && typeof params.q === "string"
      ? params.q.trim().slice(0, 150)
      : "";
  const [list, choices] = await Promise.all([
    records(section, token, page, query),
    Promise.all(
      (adding ? (dependencies[section] ?? []) : []).map(async (table) => {
        const options = [];
        let next = 0;
        while (true) {
          const result = await records(table, token, next++, "", 500);
          options.push(...result.items);
          if (!result.more) break;
        }
        return { table, options };
      }),
    ),
  ]);
  const linked = ["submissions", "interviews", "placements"].includes(section);
  const headers = linked
    ? [
        "Candidate",
        "Role",
        "Partner",
        section === "submissions"
          ? "Stage"
          : section === "placements"
            ? "Joining date"
            : "Interview",
      ]
    : section === "requirements"
      ? ["Role", "Partner"]
      : section === "actions"
        ? ["Action", "Status"]
        : section === "candidates"
          ? ["Candidate", "Email"]
          : ["Name"];
  const ready = choices.every((c) => c.options.length > 0);
  return (
    <Shell view={view} section={section}>
      <div className="page-title">
        <h1>{sections[section]}</h1>
        <a
          className="verve-primary primary"
          href={href(view, section) + (adding ? "" : "&add=1")}
        >
          {adding ? "Close form" : "Add " + singular[section]}
        </a>
      </div>
      <p role="status">{notice}</p>
      {adding && (
        <section className="card">
          <h2>Add {singular[section]}</h2>
          {!ready ? (
            <p>
              First add{" "}
              {choices
                .filter((c) => !c.options.length)
                .map((c) => singular[c.table])
                .join(" and ")}
              .
            </p>
          ) : (
            <form action={save}>
              <input type="hidden" name="section" value={section} />
              <input type="hidden" name="view" value={view} />
              <input type="hidden" name="request_id" value={randomUUID()} />
              {["partners", "candidates", "requirements", "actions"].includes(
                section,
              ) && (
                <label className="field">
                  {section === "partners" || section === "candidates"
                    ? "Name"
                    : "Title"}
                  <input
                    name={
                      section === "partners" || section === "candidates"
                        ? "name"
                        : "title"
                    }
                    required
                    maxLength={200}
                  />
                </label>
              )}
              {choices.map(({ table, options }) => (
                <ChoiceField
                  key={table}
                  name={fieldNames[table]!}
                  label={singular[table]}
                  options={options}
                />
              ))}
              {section === "interviews" && (
                <label className="field">
                  Scheduled time (UTC)
                  <input type="datetime-local" name="scheduled_at" required />
                </label>
              )}
              {section === "placements" && (
                <label className="field">
                  Joining date
                  <input type="date" name="joined_on" required />
                </label>
              )}
              <SaveButton>{"Save " + singular[section]}</SaveButton>
            </form>
          )}
        </section>
      )}
      <section className="section" aria-label={sections[section]}>
        {searchable && (
          <form className="record-search" role="search">
            <input type="hidden" name="view" value={view} />
            <input type="hidden" name="section" value={section} />
            <input
              type="search"
              name="q"
              aria-label={"Search all " + sections[section]}
              defaultValue={query}
              placeholder={"Search all " + sections[section].toLowerCase()}
            />
            <button className="outline">Search</button>
            {query && <a href={href(view, section)}>Clear</a>}
          </form>
        )}
        {!list.items.length ? (
          <p>
            {query
              ? "No matches for “" + query + "”."
              : "No " + sections[section].toLowerCase() + " on this page."}
          </p>
        ) : (
          <RecordTable
            view={view}
            filterPage={!searchable}
            headers={headers}
            rows={list.items.map((row) => ({
              id: row.id,
              source: row.source,
              openAction: section === "actions" && !row.complete,
              cells: (linked
                ? [row.person, row.role, row.partner, row.detail]
                : [row.label, ...(headers.length > 1 ? [row.detail] : [])]
              ).map((v) => v ?? ""),
            }))}
          />
        )}
        {page > 0 && (
          <a
            href={
              href(view, section) +
              "&q=" +
              encodeURIComponent(query) +
              "&page=" +
              (page - 1)
            }
          >
            Previous page{" "}
          </a>
        )}
        {list.more && (
          <a
            href={
              href(view, section) +
              "&q=" +
              encodeURIComponent(query) +
              "&page=" +
              (page + 1)
            }
          >
            Next page
          </a>
        )}
      </section>
    </Shell>
  );
}
