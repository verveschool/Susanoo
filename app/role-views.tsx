import Link from "next/link";
import { request, type Membership } from "../lib/workspace";
import { sendScoutMessage, revokeRelease } from "./operations";
import { SaveButton } from "./form-controls";

export type DirectoryEntry = { id: string; name: string };
export async function directory(
  token: string,
  table: "scouts" | "partners",
): Promise<DirectoryEntry[]> {
  const res = await request(
    "/rest/v1/" + table + "?select=id,name&order=name.asc",
    token,
  );
  if (!res.ok) throw new Error("Directory unavailable");
  return res.json();
}
async function count(token: string, path: string) {
  const res = await request("/rest/v1/" + path, token, undefined, "HEAD", {
    Prefer: "count=exact",
  });
  const n = res.headers.get("content-range")?.split("/").pop();
  if (!res.ok || !n || !/^\d+$/.test(n)) throw new Error("Count unavailable");
  return Number(n);
}
export async function ScoutWorkspace({
  token,
  member,
  selected,
  notice,
}: {
  token: string;
  member: Membership;
  selected?: string;
  notice?: string;
}) {
  const scouts = await directory(token, "scouts");
  const scout = scouts.find((s) => s.id === (member.scout_id ?? selected));
  const scope = scout ? "&scout_id=eq." + scout.id : "";
  const [submissions, actions, res, stageResponse, messageResponse] =
    await Promise.all([
      count(token, "submissions?select=id&limit=1" + scope),
      count(token, "actions?select=id&complete=eq.false&limit=1" + scope),
      request(
        "/rest/v1/submissions?select=id,display_stage,candidates(name),requirements(title,partners(name)),scouts(name)&order=created_at.desc&limit=12" +
          scope,
        token,
      ),
      request(
        "/rest/v1/scout_stage_totals?select=scout_id,stage,total" + scope,
        token,
      ),
      scout
        ? request(
            "/rest/v1/scout_messages?select=id,sender_id,body,created_at&scout_id=eq." +
              scout.id +
              "&order=created_at.desc&limit=50",
            token,
          )
        : null,
    ]);
  if (!res.ok || !stageResponse.ok || (messageResponse && !messageResponse.ok))
    throw new Error("Scout work unavailable");
  const stageRows: { scout_id: string; stage: string; total: number }[] =
    await stageResponse.json();
  const totals = new Map<string, number>();
  for (const row of stageRows)
    totals.set(row.stage, (totals.get(row.stage) ?? 0) + Number(row.total));
  const stages = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const scoutTotals = new Map<string, number>();
  for (const row of stageRows)
    scoutTotals.set(
      row.scout_id,
      (scoutTotals.get(row.scout_id) ?? 0) + Number(row.total),
    );
  const messages: {
    id: string;
    sender_id: string;
    body: string;
    created_at: string;
  }[] = messageResponse ? await messageResponse.json() : [];
  const rows: {
    id: string;
    display_stage: string | null;
    candidates: { name: string };
    requirements: { title: string; partners: { name: string } };
    scouts: { name: string } | null;
  }[] = await res.json();
  return (
    <>
      <div className="page-title">
        <div>
          <h1>{scout ? scout.name + "'s workspace" : "Talent operations"}</h1>
          <p>
            {scout
              ? "Your pipeline and follow ups"
              : "Scout activity across hiring partners"}
          </p>
        </div>
        {member.role === "scout" && (
          <Link
            className="primary verve-primary"
            href="/?view=team&section=candidates&add=1"
          >
            Add candidate
          </Link>
        )}
      </div>
      {notice && <p role="status">{notice}</p>}
      {member.role === "executive" && (
        <form className="record-search">
          <input type="hidden" name="view" value="team" />
          <input type="hidden" name="section" value="overview" />
          <label className="field">
            Scout
            <select name="scout" defaultValue={scout?.id ?? ""}>
              <option value="">All scouts</option>
              {scouts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button className="outline">View workspace</button>
        </form>
      )}
      <div className="stats three">
        <Link
          className="stat"
          href={
            "/?view=team&section=submissions" +
            (scout ? "&scout=" + scout.id : "")
          }
        >
          <span>Submissions</span>
          <strong>{submissions.toLocaleString("en-IN")}</strong>
          <small>Linked hiring records</small>
        </Link>
        <Link
          className="stat"
          href={
            "/?view=team&section=actions" + (scout ? "&scout=" + scout.id : "")
          }
        >
          <span>Open actions</span>
          <strong>{actions}</strong>
          <small>Follow ups to complete</small>
        </Link>
        <Link className="stat" href="/?view=team&section=requirements">
          <span>Hiring partners</span>
          <strong>View roles</strong>
          <small>Find requirements</small>
        </Link>
      </div>
      <section className="section">
        <div className="section-head">
          <h2>Pipeline by stage</h2>
        </div>
        <div className="card stage-grid">
          {stages.slice(0, 6).map(([stage, n]) => (
            <Stage key={stage} stage={stage} n={n} total={submissions} />
          ))}
          {!stages.length && <p>No activity recorded yet.</p>}
          {stages.length > 6 && (
            <details className="more-stages">
              <summary>View all {stages.length} stages</summary>
              <div className="stage-grid">
                {stages.slice(6).map(([stage, n]) => (
                  <Stage key={stage} stage={stage} n={n} total={submissions} />
                ))}
              </div>
            </details>
          )}
        </div>
      </section>
      {!scout && member.role === "executive" && (
        <section className="section">
          <div className="section-head">
            <h2>Scout directory</h2>
            <span>{scouts.length} scout profiles</span>
          </div>
          <div className="scout-directory">
            {scouts.map((s) => (
              <Link
                className="card scout-link"
                key={s.id}
                href={"/?view=team&section=overview&scout=" + s.id}
              >
                <strong>{s.name}</strong>
                <small>{scoutTotals.get(s.id) ?? 0} submissions</small>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="section">
        <div className="section-head">
          <h2>Recent candidate activity</h2>
          <Link
            href={
              "/?view=team&section=submissions" +
              (scout ? "&scout=" + scout.id : "")
            }
          >
            All submissions
          </Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {["Candidate", "Company", "Role", "Stage", "Scout"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  {[
                    r.candidates?.name,
                    r.requirements?.partners?.name,
                    r.requirements?.title,
                    r.display_stage,
                    r.scouts?.name,
                  ].map((v, i) => (
                    <td
                      key={i}
                      data-label={
                        ["Candidate", "Company", "Role", "Stage", "Scout"][i]
                      }
                    >
                      {v || "Not recorded"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p>No submissions yet.</p>}
        </div>
      </section>
      {scout && (
        <section className="section">
          <div className="section-head">
            <h2>Messages</h2>
            <small>Private conversation with the executive team</small>
          </div>
          <div className="card">
            <div className="chat-thread">
              {messages
                .slice()
                .reverse()
                .map((m) => (
                  <article key={m.id}>
                    <small>
                      {new Date(m.created_at).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })}
                    </small>
                    <p>{m.body}</p>
                  </article>
                ))}
              {!messages.length && <p>No messages yet.</p>}
            </div>
            <form action={sendScoutMessage}>
              <input type="hidden" name="scout_id" value={scout.id} />
              <label className="field">
                <span className="sr-only">Message</span>
                <textarea
                  name="body"
                  placeholder="Write a message"
                  required
                  maxLength={2000}
                />
              </label>
              <SaveButton>Send message</SaveButton>
            </form>
          </div>
        </section>
      )}
    </>
  );
}

function Stage({
  stage,
  n,
  total,
}: {
  stage: string;
  n: number;
  total: number;
}) {
  return (
    <div className="stage-row">
      <div>
        <span>{stage}</span>
        <strong>{n.toLocaleString("en-IN")}</strong>
      </div>
      <progress aria-label={stage} value={n} max={total || 1} />
    </div>
  );
}

export async function PartnerWorkspace({
  token,
  member,
  selected,
  section,
}: {
  token: string;
  member: Membership;
  selected?: string;
  section: string;
}) {
  const partners = await directory(token, "partners");
  const partner =
    partners.find((p) => p.id === (member.partner_id ?? selected)) ??
    partners[0];
  if (!partner) return <p>No partner workspace is configured.</p>;
  const filter = "&partner_id=eq." + partner.id;
  const [req, rel] = await Promise.all([
    request(
      "/rest/v1/requirements?select=id,title&order=title" + filter,
      token,
    ),
    request(
      "/rest/v1/partner_releases?select=id,candidate_name,requirement,stage&order=created_at.desc" +
        filter,
      token,
    ),
  ]);
  if (!req.ok || !rel.ok) throw new Error("Partner workspace unavailable");
  const roles: { id: string; title: string }[] = await req.json();
  const profiles: {
    id: string;
    candidate_name: string;
    requirement: string;
    stage: string;
  }[] = await rel.json();
  const onlyRoles = section === "requirements",
    onlyProfiles = section === "profiles";
  return (
    <>
      <div className="page-title">
        <div>
          <h1>{partner.name}</h1>
          <p>
            {member.role === "executive"
              ? "Partner preview · released records only"
              : "Hiring workspace"}
          </p>
        </div>
      </div>
      {member.role === "executive" && (
        <form className="record-search">
          <input type="hidden" name="view" value="partner" />
          <input type="hidden" name="section" value={section} />
          <label className="field">
            Partner
            <select name="partner" defaultValue={partner.id}>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button className="outline">View partner</button>
        </form>
      )}
      <div className="stats two">
        <div className="stat">
          <span>Hiring requirements</span>
          <strong>{roles.length}</strong>
        </div>
        <div className="stat">
          <span>Shared candidates</span>
          <strong>{profiles.length}</strong>
        </div>
      </div>
      {!onlyProfiles && (
        <section className="section">
          <h2>Requirements</h2>
          <div className="record-list">
            {roles.map((r) => (
              <div className="card" key={r.id}>
                {r.title}
              </div>
            ))}
            {!roles.length && <p>No requirements yet.</p>}
          </div>
        </section>
      )}
      {!onlyRoles && (
        <section className="section">
          <h2>Shared candidates</h2>
          {profiles.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Role</th>
                    <th>Stage</th>
                    {member.role === "executive" && <th>Access</th>}
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((r) => (
                    <tr key={r.id}>
                      <td data-label="Candidate">{r.candidate_name}</td>
                      <td data-label="Role">{r.requirement}</td>
                      <td data-label="Stage">{r.stage}</td>
                      {member.role === "executive" && (
                        <td data-label="Access">
                          <form action={revokeRelease}>
                            <input type="hidden" name="id" value={r.id} />
                            <input
                              type="hidden"
                              name="partner"
                              value={partner.id}
                            />
                            <button className="outline">Revoke sharing</button>
                          </form>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>
              Candidate introductions will appear here when shared by
              VerveSchool.
            </p>
          )}
        </section>
      )}
    </>
  );
}
