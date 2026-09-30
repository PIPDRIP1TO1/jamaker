import Link from "next/link";
import type { JaMakerModule } from "@/config/modules";
import { statusLabels } from "@/config/modules";
import { getModuleCapabilities } from "@/config/module-blueprints";
import type { ModuleProject } from "@/lib/module-projects";
import { createProjectAction, deleteProjectAction, duplicateExampleAction } from "@/app/actions/projects";

export function ModuleWorkspace({ module, projects = [] }: { module: JaMakerModule; projects?: ModuleProject[] }) {
  const capabilities = getModuleCapabilities(module);
  return (
    <>
      <section className="module-header-card">
        <div className="module-hero-icon">{module.icon}</div>
        <div className="module-hero-copy"><span className={`module-status status-${module.status}`}>{statusLabels[module.status]}</span><h2>{module.description}</h2><p>Fonction issue de {module.source}, réorganisée pour les permissions et historiques du SaaS.</p></div>
        <div className="module-header-actions"><form action={createProjectAction}><input type="hidden" name="moduleSlug" value={module.slug} /><button className="button" type="submit">Nouveau projet</button></form><Link className="button button-secondary" href="/dashboard/modules">Tous les modules</Link></div>
      </section>
      <section className="module-console">
        <article className="panel module-workspace"><div className="workspace-topline"><span>Espace de travail</span><small>Données de votre organisation uniquement</small></div><div className="capability-grid">{capabilities.map((capability, index) => <div className="capability-card" key={capability}><span>{String(index + 1).padStart(2, "0")}</span><strong>{capability}</strong><small>{module.status === "foundation" ? "Infrastructure disponible" : "À connecter pendant la migration"}</small></div>)}</div><div className="project-list">{projects.map((project) => <article className="project-row" key={project.id}><div className="project-kind">{project.is_example ? "EX" : "PR"}</div><div><div className="project-title-line"><strong>{project.name}</strong>{project.is_example ? <span className="example-badge">Exemple supprimable</span> : <span className="draft-badge">Brouillon</span>}</div><p>{project.description}</p></div><div className="project-actions"><Link className="project-open" href={`/dashboard/tools/${module.slug}/projects/${project.id}`}>Ouvrir</Link>{Boolean(project.is_example) && <form action={duplicateExampleAction}><input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="moduleSlug" value={module.slug} /><button className="button button-small" type="submit">Utiliser cet exemple</button></form>}<form action={deleteProjectAction}><input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="moduleSlug" value={module.slug} /><button className="project-delete" type="submit">Supprimer</button></form></div></article>)}</div></article>
        <aside className="panel technical-panel"><p className="eyebrow">État technique</p><h2>{statusLabels[module.status]}</h2><div className="technical-list"><div><span>Interface SaaS</span><b>Prête</b></div><div><span>Isolation client</span><b>Prête</b></div><div><span>Logique métier</span><b>{module.status === "foundation" ? "Socle prêt" : "À migrer"}</b></div><div><span>Service externe</span><b>{module.status === "connection" ? "Requis" : "Optionnel"}</b></div></div>{module.status === "connection" && <Link className="inline-action" href="/dashboard/integrations">Préparer les connexions →</Link>}</aside>
      </section>
    </>
  );
}
