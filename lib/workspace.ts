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
  headers: Record<string, string> = {},
) {
  return fetch(endpoint + path, {
    method,
    cache: "no-store",
    headers: {
      ...headers,
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

export type Membership = {
  role: "executive" | "scout" | "partner";
  scout_id: string | null;
  partner_id: string | null;
};
export async function membership(token: string): Promise<Membership | null> {
  const res = await request(
    "/rest/v1/workspace_members?select=role,scout_id,partner_id&limit=1",
    token,
  );
  if (!res.ok) return null;
  return (await res.json())[0] ?? null;
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
  candidates: "id,name,email",
  actions: "id,title,complete",
  requirements: "id,title,partners(name)",
  submissions:
    "id,display_stage,source_url,scouts(name),candidates(name),requirements(title,partners(name))",
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
  email?: string;
  scheduled_at?: string;
  scheduled_on?: string;
  round_label?: string;
  display_stage?: string;
  source_url?: string;
  scouts?: RecordLabel;
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

export async function records(
  table: Section,
  token: string,
  page = 0,
  query = "",
  pageSize = 50,
  scoutFilter = "",
) {
  const searchColumn =
    table === "candidates" || table === "partners" ? "name" : "title";
  const filter = query
    ? "&" +
      searchColumn +
      "=ilike." +
      encodeURIComponent("%" + query.replace(/[%_*\\]/g, "\\$&") + "%")
    : "";
  const res = await request(
    "/rest/v1/" +
      table +
      "?select=" +
      projections[table] +
      filter +
      (scoutFilter ? "&scout_id=eq." + encodeURIComponent(scoutFilter) : "") +
      "&order=created_at.desc,id.desc&limit=" +
      (pageSize + 1) +
      "&offset=" +
      page * pageSize,
    token,
  );
  if (!res.ok) throw new Error("Workspace records could not be loaded");
  const rows: Row[] = await res.json();
  return {
    more: rows.length > pageSize,
    items: rows.slice(0, pageSize).map((r) => ({
      id: r.id,
      complete: r.complete,
      scout: r.scouts?.name,
      source: r.source_url?.startsWith("https://docs.google.com/spreadsheets/")
        ? r.source_url
        : undefined,
      person: (r.submissions ?? r).candidates?.name,
      role: (r.submissions ?? r).requirements?.title,
      partner: (r.submissions ?? r).requirements?.partners?.name,
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
        : r.scheduled_on
          ? [r.round_label, r.scheduled_on].filter(Boolean).join(" · ")
          : (r.email ??
            r.display_stage ??
            r.joined_on ??
            r.partners?.name ??
            (r.complete === undefined ? "" : r.complete ? "Complete" : "Open")),
    })),
  };
}
