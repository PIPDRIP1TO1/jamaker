import Link from "next/link";
import { modules } from "@/config/modules";

const prioritySlugs = ["workflows", "automations", "recipe-creator", "animated-story", "video-editor", "cookbook-marketing"];

export function DashboardOverview() {
  const priorities = modules.filter((item) => prioritySlugs.includes(item.slug));
  const ready = modules.filter((item) => item.status === "foundation").length;
  const connections = modules.filter((item) => item.status === "connection").length;

  return (
    <>
      <section className="dashboard-summary">
        <div><span className="pill">Migration technique active</span><h2>Votre boîte à outils, sans les écrans vides.</h2><p>Les fonctions utiles de JADOMI HUB sont regroupées dans un espace SaaS unique. Commencez par un module prioritaire.</p></div>
        <Link className="button" href="/dashboard/modules">Explorer les {modules.length} modules</Link>
      </section>
      <section className="stat-grid stat-grid-four">
        <article className="stat-card"><p>Modules recensés</p><strong>{modules.length}</strong><small>Catalogue technique</small></article>
        <article className="stat-card"><p>Socles disponibles</p><strong>{ready}</strong><small>Prêts pour la logique métier</small></article>
        <article className="stat-card"><p>Connexions externes</p><strong>{connections}</strong><small>À brancher plus tard</small></article>
        <article className="stat-card"><p>Organisation</p><strong>1</strong><small>Espace de données isolé</small></article>
      </section>
      <section className="priority-section">
        <div className="section-row"><div><p className="eyebrow">Accès rapide</p><h2>Modules prioritaires</h2></div><Link href="/dashboard/modules">Voir tout →</Link></div>
        <div className="priority-grid">
          {priorities.map((item) => <Link className="priority-card" href={`/dashboard/tools/${item.slug}`} key={item.slug}><span className="catalog-icon">{item.icon}</span><div><h3>{item.name}</h3><p>{item.description}</p></div><b>→</b></Link>)}
        </div>
      </section>
      <section className="dashboard-grid compact-dashboard-grid">
        <article className="panel"><p className="eyebrow">Ordre de construction</p><h2>Base SaaS avant les connecteurs</h2><ol className="step-list"><li><span>1</span><div><strong>Workflows et données</strong><small>Projets, exécutions et journaux.</small></div></li><li><span>2</span><div><strong>Outils de création</strong><small>Recettes, histoires, images et montage.</small></div></li><li><span>3</span><div><strong>Connexions personnelles</strong><small>Meta, Google et IA après le socle.</small></div></li></ol></article>
        <article className="panel"><p className="eyebrow">Architecture</p><h2>Un compte, un espace privé</h2><p>Chaque client conserve ses projets, profils, médias et historiques dans son organisation. Aucun compte externe n&apos;est partagé.</p><Link className="inline-action" href="/dashboard/integrations">Voir les connexions prévues →</Link></article>
      </section>
    </>
  );
}
