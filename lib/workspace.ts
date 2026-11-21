import "server-only";
import { cookies } from "next/headers";

// The Supabase publishable key identifies this project. Each request uses the operator's own JWT.
const endpoint = "https://iwayboxgzxhpjsdnfaek.supabase.co";
const publishableKey = "sb_publishable_r-h_uRIPoy0cho2XDcoHfA_7oMFNgap";
export const sessionCookie = "susanoo_access";

export async function request(
  path: string,
  token?: string,
  body?: object,
  method = body ? "POST" : "GET",
) {
  return fetch(endpoint + path, {
    method,
    cache: "no-store",
    headers: {
      apikey: publishableKey,
      ...(token ? { Authorization: "Bearer " + token } : {}),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function session() {
  return (await cookies()).get(sessionCookie)?.value;
}

export const sections = {
  partners: "Partners",
  requirements: "Requirements",
  candidates: "Candidates",
  submissions: "Submissions",
  interviews: "Interviews",
  placements: "Placements",
  actions: "Actions",
} as const;
export type Section = keyof typeof sections;
export function isSection(key: string): key is Section {
  return Object.hasOwn(sections, key);
}

const projections: Record<Section, string> = {
  partners: "id,name",
  candidates: "id,name",
  actions: "id,title,complete",
  requirements: "id,title,partners(name)",
  submissions: "id,display_stage,candidates(name),requirements(title,partners(name))",
  interviews:
    "id,scheduled_at,scheduled_on,round_label,submissions(candidates(name),requirements(title,partners(name)))",
  placements:
    "id,joined_on,submissions(candidates(name),requirements(title,partners(name)))",
};
type RecordLabel = { name: string };
type Requirement = { title: string; partners: RecordLabel };
type Submission = { candidates: RecordLabel; requirements: Requirement };
type Row = Partial<Requirement & Submission> & {
  id: string;
  name?: string;
  scheduled_at?: string;
  scheduled_on?: string;
  round_label?: string;
  display_stage?: string;
  joined_on?: string;
  submissions?: Submission;
  complete?: boolean;
};
function submissionLabel(submission: Submission) {
  return [
    submission.candidates.name,
    submission.requirements.title,
    submission.requirements.partners.name,
  ].join(" · ");
}

export async function records(table: Section, token: string, page = 0) {
  const res = await request(
    "/rest/v1/" +
      table +
      "?select=" +
      projections[table] +
      "&order=created_at.desc,id.desc&limit=51&offset=" +
      page * 50,
    token,
  );
  if (!res.ok) throw new Error("Workspace records could not be loaded");
  const rows: Row[] = await res.json();
  return {
    more: rows.length > 50,
    items: rows.slice(0, 50).map((r) => ({
      id: r.id,
      complete: r.complete,
      label: r.submissions
        ? submissionLabel(r.submissions)
        : r.candidates && r.requirements
          ? submissionLabel({
              candidates: r.candidates,
              requirements: r.requirements,
            })
          : (r.name ?? r.title ?? ""),
      detail: r.scheduled_at
        ? new Date(r.scheduled_at)
            .toISOString()
            .replace("T", " ")
            .slice(0, 16) + " UTC"
        : (r.scheduled_on ? [r.round_label, r.scheduled_on].filter(Boolean).join(" · ") : r.display_stage ?? r.joined_on ??
          r.partners?.name ??
          (r.complete === undefined ? "" : r.complete ? "Complete" : "Open")),
    })),
  };
}
