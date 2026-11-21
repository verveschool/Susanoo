"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  isSection,
  membership,
  request,
  session,
  sessionCookie,
} from "../lib/workspace";

export async function signIn(form: FormData) {
  const res = await request("/auth/v1/token?grant_type=password", undefined, {
    email: String(form.get("email")).trim(),
    password: String(form.get("password")),
  });
  if (!res.ok) redirect("/?notice=signin");
  const { access_token, expires_in } = await res.json();
  (await cookies()).set(sessionCookie, access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: expires_in,
  });
  redirect("/");
}

export async function signOut() {
  const token = await session();
  (await cookies()).delete(sessionCookie);
  if (token)
    await request("/auth/v1/logout?scope=local", token, {}, "POST").catch(
      () => undefined,
    );
  redirect("/");
}

export async function save(form: FormData) {
  const table = String(form.get("section"));
  if (!isSection(table)) throw new Error("Unknown section");
  const token = await session();
  if (!token) redirect("/?notice=expired");
  const member = await membership(token);
  if (!member || member.role === "partner") redirect("/");
  const fields = {
    partners: ["name"],
    candidates: ["name"],
    requirements: ["title", "partner_id"],
    submissions: ["candidate_id", "requirement_id"],
    interviews: ["submission_id", "scheduled_at"],
    placements: ["submission_id", "joined_on"],
    actions: ["title"],
  }[table];
  const destination =
    "/?view=" +
    (form.get("view") === "team" ? "team" : "executive") +
    "&section=" +
    table;
  const values: Record<string, string> = { id: String(form.get("request_id")) };
  if (
    member.scout_id &&
    ["candidates", "submissions", "actions"].includes(table)
  )
    values.scout_id = member.scout_id;
  if (
    member.role === "executive" &&
    ["submissions", "actions", "candidates"].includes(table)
  ) {
    const scout = String(form.get("scout_id") ?? "");
    if (scout) values.scout_id = scout;
  }
  if (table === "candidates") {
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    if (email) values.email = email;
  }
  for (const field of fields) {
    const value = String(form.get(field) ?? "").trim();
    if (!value) redirect(destination + "&add=1&notice=invalid");
    values[field] = field === "scheduled_at" ? value + "Z" : value;
  }
  const res = await request("/rest/v1/" + table, token, values);
  redirect(
    destination +
      (res.ok ? "" : "&add=1") +
      "&notice=" +
      (res.ok
        ? "saved"
        : res.status === 409
          ? "duplicate"
          : res.status === 401
            ? "expired"
            : "failed"),
  );
}

export async function completeAction(form: FormData) {
  const token = await session();
  if (!token) redirect("/?notice=expired");
  const id = String(form.get("id"));
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error("Invalid action");
  const res = await request(
    "/rest/v1/actions?id=eq." + id,
    token,
    { complete: true },
    "PATCH",
  );
  redirect(
    "/?view=" +
      (form.get("view") === "team" ? "team" : "executive") +
      "&section=actions&notice=" +
      (res.ok ? "saved" : "failed"),
  );
}

export async function sendScoutMessage(form: FormData) {
  const token = await session();
  if (!token) redirect("/?notice=expired");
  const member = await membership(token);
  if (!member || member.role === "partner") redirect("/");
  const scout = member.scout_id ?? String(form.get("scout_id") ?? "");
  const body = String(form.get("body") ?? "").trim();
  const destination =
    "/?view=team&section=overview&scout=" + encodeURIComponent(scout);
  if (!body || body.length > 2000 || !/^[\da-f-]{36}$/i.test(scout))
    redirect(destination + "&notice=invalid");
  const res = await request("/rest/v1/scout_messages", token, {
    scout_id: scout,
    body,
  });
  redirect(destination + "&notice=" + (res.ok ? "saved" : "failed"));
}

export async function releaseSubmission(form:FormData){
  const token=await session();
  if(!token)redirect("/?notice=expired");
  const member=await membership(token);
  if(member?.role!=="executive")redirect("/");
  const id=String(form.get("id")??"");
  const destination="/?view=team&section=submissions";
  if(!/^[\da-f-]{36}$/i.test(id)||form.get("confirm")!=="yes")redirect(destination+"&notice=invalid");
  const res=await request("/rest/v1/submissions?select=id,display_stage,candidates(name),requirements(title,partner_id)&id=eq."+id,token);
  if(!res.ok)redirect(destination+"&notice=failed");
  const [s]=await res.json();
  if(!s?.candidates?.name||!s?.requirements?.partner_id)redirect(destination+"&notice=invalid");
  const saved=await request("/rest/v1/partner_releases",token,{submission_id:id,partner_id:s.requirements.partner_id,candidate_name:s.candidates.name,requirement:s.requirements.title,stage:s.display_stage??"Introduced"});
  redirect(destination+"&notice="+(saved.ok?"saved":saved.status===409?"duplicate":"failed"));
}

export async function revokeRelease(form:FormData){
  const token=await session();
  if(!token)redirect("/?notice=expired");
  const member=await membership(token);
  if(member?.role!=="executive")redirect("/");
  const id=String(form.get("id")??""),partner=String(form.get("partner")??"");
  if(!/^[\da-f-]{36}$/i.test(id)||! /^[\da-f-]{36}$/i.test(partner))redirect("/");
  const res=await request("/rest/v1/partner_releases?id=eq."+id+"&partner_id=eq."+partner,token,undefined,"DELETE");
  redirect("/?view=partner&section=profiles&partner="+partner+"&notice="+(res.ok?"saved":"failed"));
}
