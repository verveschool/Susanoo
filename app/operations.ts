"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSection, request, session, sessionCookie } from "../lib/workspace";

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
