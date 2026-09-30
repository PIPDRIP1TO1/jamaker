import type { JaMakerModule } from "@/config/modules";

const specificCapabilities: Record<string, string[]> = {
  workflows: ["Canvas de workflow", "Entrées et sorties typées", "Historique d'exécution", "Relance après erreur"],
  automations: ["Planification", "Files d'exécution", "Statuts et journaux", "Activation par organisation"],
  "recipe-creator": ["Brief SEO", "Article optimisé", "Audit E-E-A-T et GEO", "Recipe Schema", "Brouillon WordPress"],
  "recipe-video": ["Découpage des scènes", "Prompts de génération", "Contrôle de continuité", "Pack d'export"],
  "cookbook-marketing": ["Ebook Studio", "Import Sitemap", "Recettes assistées par IA", "Couvertures et PDF", "Planning éditorial", "Carrousels 4:5", "Captions et CTA", "Suivi des ventes"],
  "animated-story": ["Idée du chapitre", "Continuité des épisodes", "Deux prompts de 15 s", "Cover et caption"],
  "video-editor": ["Timeline magnétique", "Coupe et vitesse", "Couleur et filtres", "Export MP4"],
  "mini-canvas": ["Templates", "Texte et images", "Formats sociaux", "Export PNG"],
  structures: ["Projets", "Profils navigateur", "Comptes liés", "Affectation aux workflows"],
  backups: ["Export complet", "Restauration", "Historique", "Contrôle d'intégrité"],
};

const groupCapabilities: Record<JaMakerModule["group"], string[]> = {
  create: ["Nouveau projet", "Configuration", "Exécution", "Résultat exportable"],
  research: ["Source publique", "Filtres", "Collection", "Rapport"],
  manage: ["Configuration", "Permissions", "Historique", "Export"],
  social: ["Compte autorisé", "Composition", "Validation", "Publication"],
  studio: ["Importer", "Éditer", "Prévisualiser", "Exporter"],
};

export function getModuleCapabilities(module: JaMakerModule) {
  return specificCapabilities[module.slug] || groupCapabilities[module.group];
}
