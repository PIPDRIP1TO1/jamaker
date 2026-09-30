import Link from "next/link";
import { moduleGroups, modules } from "@/config/modules";
import { logoutAction } from "@/app/actions/auth";
import { requireSession } from "@/lib/auth/session";
import { billingStatusLabels, getBillingOverview } from "@/lib/billing";
import { PwaInstall } from "@/components/pwa-install";

const navItems = [
  { href: "/dashboard", label: "Vue d'ensemble", icon: "⌂" },
  { href: "/dashboard/modules", label: "Tous les modules", icon: "▦" },
  { href: "/dashboard/automations", label: "Automatisations", icon: "✦" },
  { href: "/dashboard/integrations", label: "Mes connexions", icon: "⌁" },
  { href: "/dashboard/team", label: "Équipe", icon: "♧" },
  { href: "/dashboard/billing", label: "Abonnement", icon: "◉" },
  { href: "/dashboard/audit", label: "Audit", icon: "▥" },
];

export async function DashboardShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  const session = await requireSession();
  const billing = await getBillingOverview(session.organization.id);
  const initials = session.user.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand sidebar-brand">
          <span className="brand-mark">JA</span><span>MAKER</span>
        </Link>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link href={item.href} key={item.href}>
              <span>{item.icon}</span>{item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-modules">
          {moduleGroups.map((group) => {
            const groupModules = modules.filter((module) => module.group === group.id);
            return (
              <section className="sidebar-group" key={group.id}>
                <p>{group.label}</p>
                {groupModules.map((module) => (
                  <Link href={`/dashboard/tools/${module.slug}`} key={module.slug} title={module.name}>
                    <span>{module.icon}</span>{module.name}
                  </Link>
                ))}
              </section>
            );
          })}
        </div>
        <div className="sidebar-foot">
          <div className="avatar">{initials}</div>
          <div><strong>{session.organization.name}</strong><small>{session.role} • {billingStatusLabels[billing.status]}</small></div>
          <form action={logoutAction}><button className="logout-mini" title="Déconnexion" aria-label="Déconnexion">↪</button></form>
        </div>
      </aside>
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>
          <div className="dashboard-header-actions"><PwaInstall /><button className="icon-button" aria-label="Notifications">●</button></div>
        </header>
        {children}
      </main>
    </div>
  );
}
