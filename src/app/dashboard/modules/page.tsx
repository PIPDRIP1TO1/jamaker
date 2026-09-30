import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { moduleGroups, modules, statusLabels } from "@/config/modules";

export default function ModulesPage() {
  return (
    <DashboardShell eyebrow="Espace de travail" title="Tous les modules">
      <section className="catalog-intro">
        <div>
          <span className="pill">{modules.length} modules recensés</span>
          <h2>Les fonctions de JADOMI HUB, organisées pour le SaaS.</h2>
          <p>Chaque outil conserve sa fonction métier, avec des données et connexions isolées pour chaque client.</p>
        </div>
      </section>

      <div className="module-catalog">
        {moduleGroups.map((group) => {
          const groupModules = modules.filter((module) => module.group === group.id);
          return (
            <section className="catalog-group" key={group.id}>
              <div className="catalog-heading">
                <h2>{group.label}</h2>
                <span>{groupModules.length} modules</span>
              </div>
              <div className="catalog-grid">
                {groupModules.map((module) => (
                  <Link className="catalog-card" href={`/dashboard/tools/${module.slug}`} key={module.slug}>
                    <span className="catalog-icon">{module.icon}</span>
                    <div><h3>{module.name}</h3><p>{module.description}</p></div>
                    <small className={`status-text status-text-${module.status}`}>{statusLabels[module.status]}</small>
                    <b>→</b>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </DashboardShell>
  );
}
