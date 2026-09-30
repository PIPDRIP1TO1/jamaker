export type ModuleStatus = "foundation" | "planned" | "connection";

export type JaMakerModule = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  group: "create" | "research" | "manage" | "social" | "studio";
  status: ModuleStatus;
  source: string;
};

export const moduleGroups = [
  { id: "create", label: "Créer & automatiser" },
  { id: "research", label: "Recherche & analyse" },
  { id: "manage", label: "Gestion" },
  { id: "social", label: "Réseaux sociaux" },
  { id: "studio", label: "Studio" },
] as const;

export const modules: JaMakerModule[] = [
  { slug: "workflows", name: "Workflows", description: "Construire des chaînes d'actions claires et réutilisables.", icon: "⇢", group: "create", status: "foundation", source: "JADOMI HUB" },
  { slug: "automations", name: "Automatisations", description: "Programmer, suivre et relancer les exécutions.", icon: "✦", group: "create", status: "foundation", source: "JADOMI HUB" },
  { slug: "recipe-creator", name: "Générateur de recettes", description: "Transformer une idée culinaire en recette structurée.", icon: "▤", group: "create", status: "foundation", source: "JADOMI HUB" },
  { slug: "recipe-video", name: "Recipe Video", description: "Préparer une vidéo de recette cohérente scène par scène.", icon: "▶", group: "create", status: "foundation", source: "JADOMI HUB" },
  { slug: "cookbook-marketing", name: "Marketing des livres", description: "Créer les campagnes, visuels et calendriers des cookbooks.", icon: "◉", group: "create", status: "foundation", source: "JADOMI HUB" },
  { slug: "animated-story", name: "Histoire animée 30s", description: "Écrire des épisodes rapides en deux séquences de 15 secondes.", icon: "◆", group: "create", status: "foundation", source: "JADOMI HUB" },
  { slug: "facebook-spy", name: "Facebook Spy", description: "Collecter des signaux publics utiles pour l'inspiration.", icon: "f", group: "research", status: "connection", source: "JADOMI HUB" },
  { slug: "instagram-spy", name: "Instagram Spy", description: "Analyser des comptes et publications publiques autorisées.", icon: "◎", group: "research", status: "connection", source: "JADOMI HUB" },
  { slug: "social-analytics", name: "Analytics social", description: "Centraliser les performances Facebook et Instagram.", icon: "↗", group: "research", status: "connection", source: "JADOMI HUB" },
  { slug: "structures", name: "Structures", description: "Organiser profils, projets, comptes et environnements.", icon: "▦", group: "manage", status: "foundation", source: "JADOMI HUB" },
  { slug: "mailboxes", name: "Boîtes mail", description: "Regrouper les messages utiles aux workflows.", icon: "✉", group: "manage", status: "connection", source: "JADOMI HUB" },
  { slug: "backups", name: "Sauvegardes", description: "Exporter et restaurer les données d'une organisation.", icon: "↻", group: "manage", status: "planned", source: "JADOMI HUB" },
  { slug: "facebook", name: "Facebook", description: "Gérer les pages et planifications autorisées.", icon: "f", group: "social", status: "connection", source: "JADOMI HUB" },
  { slug: "instagram", name: "Instagram", description: "Préparer et publier via les connexions officielles Meta.", icon: "◎", group: "social", status: "connection", source: "JADOMI HUB" },
  { slug: "pinterest", name: "Pinterest", description: "Comptes, recherche de mots-clés et planification.", icon: "P", group: "social", status: "connection", source: "JADOMI HUB" },
  { slug: "mini-canvas", name: "Mini Canvas", description: "Composer rapidement des visuels adaptés aux réseaux sociaux.", icon: "▧", group: "studio", status: "foundation", source: "JADOMI HUB" },
  { slug: "video-editor", name: "Éditeur vidéo", description: "Monter, ajuster et exporter les formats courts essentiels.", icon: "▷", group: "studio", status: "foundation", source: "JADOMI HUB" },
  { slug: "image-cleaner", name: "Nettoyage d'image", description: "Retoucher et préparer les images avant publication.", icon: "✧", group: "studio", status: "foundation", source: "JADOMI HUB" },
  { slug: "reel-studio", name: "Reel Studio", description: "Assembler les éléments d'un Reel vertical prêt à valider.", icon: "▻", group: "studio", status: "foundation", source: "JADOMI HUB" },
  { slug: "wordpress-category", name: "WordPress Auto Category", description: "Créer et alimenter des catégories de contenu.", icon: "W", group: "create", status: "connection", source: "JADOMI HUB" },
  { slug: "google-trends", name: "Google Trends", description: "Repérer les sujets et requêtes en progression.", icon: "G", group: "research", status: "connection", source: "JADOMI HUB" },
  { slug: "reports", name: "Rapports", description: "Rassembler les résultats, erreurs et exports.", icon: "▥", group: "research", status: "foundation", source: "JADOMI HUB" },
  { slug: "facebook-pages", name: "Facebook Pages", description: "Gérer les pages et leurs publications autorisées.", icon: "f", group: "social", status: "connection", source: "JADOMI HUB" },
  { slug: "facebook-groups", name: "Facebook Groups", description: "Préparer les publications de groupes autorisés.", icon: "F", group: "social", status: "connection", source: "JADOMI HUB" },
  { slug: "facebook-analytics", name: "Facebook Analytics", description: "Suivre pages, posts et audiences.", icon: "ƒ", group: "research", status: "connection", source: "JADOMI HUB" },
  { slug: "pinterest-accounts", name: "Pinterest Accounts", description: "Organiser comptes, tableaux et profils.", icon: "P", group: "social", status: "connection", source: "JADOMI HUB" },
  { slug: "pinterest-keywords", name: "Pinterest Keywords", description: "Créer et classer les mots-clés Pinterest.", icon: "K", group: "social", status: "connection", source: "JADOMI HUB" },
  { slug: "pinterest-scanner", name: "Pinterest Scanner", description: "Scanner les tendances et pins publics.", icon: "⌕", group: "research", status: "connection", source: "JADOMI HUB" },
  { slug: "pinterest-analytics", name: "Pinterest Analytics", description: "Mesurer comptes, boards et pins.", icon: "↟", group: "research", status: "connection", source: "JADOMI HUB" },
  { slug: "watermark-cleaner", name: "Gemini Image Cleaner", description: "Préparer les créations Gemini pour le montage.", icon: "◇", group: "studio", status: "planned", source: "JADOMI HUB" },
  { slug: "community", name: "Communauté", description: "Partager ressources et méthodes validées.", icon: "♧", group: "manage", status: "planned", source: "JADOMI HUB" },
  { slug: "marketplace", name: "Marketplace", description: "Installer des modèles de workflow vérifiés.", icon: "▱", group: "manage", status: "planned", source: "JADOMI HUB" },
];

export function getModule(slug: string) {
  return modules.find((module) => module.slug === slug);
}

export const statusLabels: Record<ModuleStatus, string> = {
  foundation: "Socle prêt",
  planned: "Construction planifiée",
  connection: "Connexion requise",
};
