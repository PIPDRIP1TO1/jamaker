import Link from "next/link";
import { installTemplateAction } from "@/app/actions/marketplace";
import { marketplaceTemplates } from "@/lib/marketplace";
import { getModule } from "@/config/modules";

export function MarketplaceBoard() {
  return (
    <>
      <section className="catalog-intro"><span className="pill">Modèles vérifiés</span><h2>Installez un point de départ propre.</h2><p>Chaque modèle crée un projet privé dans votre organisation, sans compte externe ni secret. Vous le personnalisez ensuite.</p></section>
      <div className="catalog-grid">
        {marketplaceTemplates.map((template) => {
          const module = getModule(template.moduleSlug);
          return (
            <article className="catalog-card" key={template.id}>
              <div className="catalog-icon">{module?.icon || "▱"}</div>
              <div><h3>{template.name}</h3><p>{template.description}</p><p>Module : {module?.name || template.moduleSlug}</p></div>
              <div className="project-actions">
                <form action={installTemplateAction}>
                  <input type="hidden" name="templateId" value={template.id} />
                  <button className="button button-small" type="submit">Installer</button>
                </form>
                <Link className="project-open" href={`/dashboard/tools/${template.moduleSlug}`}>Voir</Link>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
