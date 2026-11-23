import Link from "next/link";
import type { ReactNode } from "react";
import { sections, type Membership } from "../lib/workspace";
import { signOut } from "./operations";
import { LayoutDashboard, CheckSquare, Building2, BriefcaseBusiness, UsersRound, FileText, CalendarDays, UserCheck, Wallet, Receipt, ShieldCheck, LogOut, PanelLeft, ChevronRight } from "lucide-react";

const icons: Record<string, typeof LayoutDashboard> = {
  overview: LayoutDashboard, actions: CheckSquare, partners: Building2,
  requirements: BriefcaseBusiness, candidates: UsersRound, submissions: FileText,
  interviews: UserCheck, calendar: CalendarDays, placements: UserCheck,
  finance: Wallet, collections: Receipt, readiness: ShieldCheck,
  earnings: Wallet, profiles: UsersRound,
};

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
      {(() => { const Icon = icons[key]; return <Icon size={18} strokeWidth={1.75} aria-hidden="true"/>; })()}
      <span>{view === "team" && key === "overview" ? "My work" : labels[key]}</span>
    </Link>
  ));
  return (
    <div className="shell restored">
      <a href="#content" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="brand"><img className="brand-mark" src="/icon.png" width={36} height={36} alt=""/><span>verveschool<small>workspace</small></span></div>
        <nav aria-label="Workspace navigation">{navigation}</nav>
      </aside>
      <div className="body">
        <header className="topbar">
          <details className="mobile-nav">
            <summary aria-label="Open navigation"><PanelLeft size={21} strokeWidth={1.8} aria-hidden="true"/></summary>
            <nav>{navigation}</nav>
          </details>
          <div className="workspace-location"><span>Workspace</span><ChevronRight size={14} aria-hidden="true"/><strong>{labels[section] ?? "Overview"}</strong></div>
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
            <button className="outline" aria-label="Sign out"><LogOut size={16} strokeWidth={1.8} aria-hidden="true"/><span>Sign out</span></button>
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
              {(() => { const Icon = icons[key]; return <Icon size={20} strokeWidth={1.8} aria-hidden="true"/>; })()}
              <span>{key === "overview" ? "Home" : labels[key]}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
