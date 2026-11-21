import { randomUUID } from "node:crypto";
import { completeAction, save, signIn, signOut } from "./operations";
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
  const section =
    typeof params.section === "string" && isSection(params.section)
      ? params.section
      : "requirements";
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
            <button className="primary">Sign in</button>
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
  const page = Math.max(
    0,
    Math.min(1000000, Math.floor(Number(params.page) || 0)),
  );
  const [list, choices] = await Promise.all([
    records(section, token, page),
    Promise.all(
      (dependencies[section] ?? []).map(async (table) => {
        const options = [];
        let next = 0;
        while (true) {
          const result = await records(table, token, next++);
          options.push(...result.items);
          if (!result.more) break;
        }
        return { table, options };
      }),
    ),
  ]);
  const ready = choices.every((c) => c.options.length > 0);
  return (
    <div className="shell">
      <a className="skip-link" href="#content">
        Skip to records
      </a>
      <div className="body">
        <header className="topbar">
          <strong className="brand">VerveSchool Workspace</strong>
          <form action={signOut}>
            <button className="outline">Sign out</button>
          </form>
        </header>
        <main id="content">
          <nav className="workspace-nav" aria-label="Workspace">
            {(Object.keys(sections) as Section[]).map((s) => (
              <a
                key={s}
                href={"/?section=" + s}
                aria-current={s === section ? "page" : undefined}
              >
                {sections[s]}
              </a>
            ))}
          </nav>
          <div className="page-title">
            <h1>{sections[section]}</h1>
          </div>
          <p role="status">{notice}</p>
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
                  <label key={table} className="field">
                    {singular[table]}
                    <select name={fieldNames[table]} defaultValue="" required>
                      <option value="" disabled>
                        Select {singular[table]}
                      </option>
                      {options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                          {o.detail ? " · " + o.detail : ""}
                        </option>
                      ))}
                    </select>
                  </label>
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
                <button className="primary">Save {singular[section]}</button>
              </form>
            )}
          </section>
          <section className="section" aria-label={sections[section]}>
            {!list.items.length ? (
              <p>No {sections[section].toLowerCase()} on this page.</p>
            ) : (
              <ul className="record-list">
                {list.items.map((row) => (
                  <li className="card" key={row.id}>
                    <strong>{row.label}</strong>
                    {row.detail && <p>{row.detail}</p>}
                    {section === "actions" && !row.complete && (
                      <form action={completeAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <button className="outline">Mark complete</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {page > 0 && (
              <a href={"/?section=" + section + "&page=" + (page - 1)}>
                Previous page{" "}
              </a>
            )}
            {list.more && (
              <a href={"/?section=" + section + "&page=" + (page + 1)}>
                Next page
              </a>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
