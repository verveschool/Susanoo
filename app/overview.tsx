import Link from "next/link";
import { records, request, type Section } from "../lib/workspace";
import { href, type View } from "./workspace-shell";

async function total(section: Section, token: string) {
  const res = await request(
    "/rest/v1/" + section + "?select=id&limit=1",
    token,
    undefined,
    "HEAD",
    { Prefer: "count=exact" },
  );
  const count = res.headers.get("content-range")?.split("/").pop();
  if (!res.ok || !count || !/^\d+$/.test(count))
    throw new Error("Workspace total unavailable");
  return Number(count).toLocaleString("en-IN");
}
const notes: Record<string, string> = {
  partners: "Hiring companies",
  requirements: "Recorded hiring briefs",
  submissions: "Candidates linked to roles",
  placements: "Recorded joinings",
  candidates: "People in the pipeline",
  interviews: "Recorded interview rounds",
};
export async function Overview({ view, token }: { view: View; token: string }) {
  const team = view === "team";
  const keys: Section[] = team
    ? ["candidates", "submissions", "interviews"]
    : ["partners", "requirements", "submissions", "placements"];
  const [counts, latest, actions] = await Promise.all([
    Promise.all(keys.map((k) => total(k, token))),
    records(team ? "interviews" : "placements", token),
    request(
      "/rest/v1/actions?select=id,title&complete=eq.false&order=created_at.desc&limit=5",
      token,
    ),
  ]);
  if (!actions.ok) throw new Error("Workspace actions unavailable");
  const queue: { id: string; title: string }[] = await actions.json();
  return (
    <>
      <div className="page-title">
        <h1>{team ? "My work" : "Company overview"}</h1>
        {team && (
          <Link
            prefetch={false}
            className="verve-primary primary"
            href={href(view, "candidates") + "&add=1"}
          >
            Add candidate
          </Link>
        )}
      </div>
      <div className={"stats " + (team ? "three" : "four")}>
        {keys.map((key, i) => (
          <Link
            prefetch={false}
            className="stat"
            href={href(key === "submissions" ? "team" : view, key)}
            key={key}
          >
            <span>{key[0].toUpperCase() + key.slice(1)}</span>
            <strong>{counts[i]}</strong>
            <small>{notes[key]}</small>
          </Link>
        ))}
      </div>
      <section className="section">
        <div className="section-head">
          <h2>{team ? "Your next actions" : "Needs a decision"}</h2>
          <Link prefetch={false} href={href(view, "actions")}>
            View actions
          </Link>
        </div>
        {queue.length ? (
          <ul>
            {queue.map((a) => (
              <li key={a.id}>{a.title}</li>
            ))}
          </ul>
        ) : (
          <p>No open actions.</p>
        )}
      </section>
      <section className="section">
        <div className="section-head">
          <h2>
            {team
              ? "Recently recorded interviews"
              : "Recently recorded placements"}
          </h2>
          <Link
            prefetch={false}
            href={href(view, team ? "interviews" : "placements")}
          >
            View all
          </Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  "Candidate",
                  "Role",
                  "Partner",
                  team ? "Interview" : "Joined",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {latest.items.slice(0, 6).map((r) => (
                <tr key={r.id}>
                  {[r.person, r.role, r.partner, r.detail].map((val, i) => (
                    <td
                      data-label={
                        [
                          "Candidate",
                          "Role",
                          "Partner",
                          team ? "Interview" : "Joined",
                        ][i]
                      }
                      key={i}
                    >
                      {val}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!latest.items.length && <p>No records yet.</p>}
        </div>
      </section>
    </>
  );
}
