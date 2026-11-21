import Link from "next/link";
import type { ReactNode } from "react";
import { sections, type Membership } from "../lib/workspace";
import { signOut } from "./operations";

export type View = "executive" | "team" | "partner";
const menus = {
  executive: [
    "overview",
    "actions",
    "partners",
    "requirements",
    "calendar",
    "placements",
    "finance",
    "collections",
    "readiness",
  ],
  team: [
    "overview",
    "actions",
    "candidates",
    "requirements",
    "submissions",
    "interviews",
    "calendar",
    "placements",
    "earnings",
  ],
  partner: ["overview", "requirements", "profiles"],
};
const labels: Record<string, string> = {
  ...sections,
  overview: "Overview",
  finance: "Finance",
  collections: "Collections",
  readiness: "Rules & readiness",
  earnings: "My earnings",
  profiles: "Shared candidates",
  calendar: "Calendar",
};
export function href(view: View, section: string) {
  return "/?view=" + view + "&section=" + section;
}
export function Shell({
  view,
  section,
  children,
  member,
  partner,
}: {
  view: View;
  section: string;
  children: ReactNode;
  member: Membership;
  partner?: string;
}) {
  const navigation = menus[view].map((key) => (
    <Link
      prefetch={false}
      key={key}
      aria-current={key === section ? "page" : undefined}
      href={
        href(view, key) +
        (view === "partner" && partner
          ? "&partner=" + encodeURIComponent(partner)
          : "")
      }
    >
      {view === "team" && key === "overview" ? "My work" : labels[key]}
    </Link>
  ));
  return (
    <div className="shell restored">
      <a href="#content" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="brand">VerveSchool</div>
        <nav aria-label="Workspace navigation">{navigation}</nav>
      </aside>
      <div className="body">
        <header className="topbar">
          <details className="mobile-nav">
            <summary>Menu</summary>
            <nav>{navigation}</nav>
          </details>
          <nav className="workspace-switch" aria-label="Workspace views">
            {(["executive", "team", "partner"] as const)
              .filter((v) => member.role === "executive" || v === view)
              .map((v) => (
                <Link
                  prefetch={false}
                  key={v}
                  className={v === view ? "verve-primary" : undefined}
                  aria-current={v === view ? "page" : undefined}
                  href={href(v, "overview")}
                >
                  {
                    {
                      executive: "Executive",
                      team: "Talent Ops",
                      partner: "Partner",
                    }[v]
                  }
                </Link>
              ))}
          </nav>
          <form className="account" action={signOut}>
            <button className="outline">Sign out</button>
          </form>
        </header>
        <main id="content">{children}</main>
        <nav className="mobile-bottom" aria-label="Quick navigation">
          {menus[view].slice(0, 5).map((key) => (
            <Link
              prefetch={false}
              href={
                href(view, key) +
                (view === "partner" && partner
                  ? "&partner=" + encodeURIComponent(partner)
                  : "")
              }
              key={key}
              aria-current={section === key ? "page" : undefined}
            >
              {key === "overview" ? "Home" : labels[key]}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
