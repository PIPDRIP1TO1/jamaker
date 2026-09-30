export type ModuleSetting = { key: string; label: string; type: "text" | "textarea" | "number" | "select" | "date" | "time" | "url" | "email" | "checkbox"; placeholder?: string; options?: Array<{ value: string; label: string }> };

// Catalogue SaaS des paramètres par module, repris de JADOMI HUB (VIRAL CLONER)
// sans jamais stocker de mot de passe, cookie ni chemin local : les comptes
// externes vivent dans les connexions chiffrées (/dashboard/integrations).
const settings: Record<string, ModuleSetting[]> = {
  "animated-story": [
    { key: "seriesName", label: "Nom de la série", type: "text", placeholder: "Ex. Gumbo & Pip" },
    { key: "episodeNumber", label: "Prochain épisode (auto)", type: "number", placeholder: "8" },
    { key: "chapterIdea", label: "Idée du premier chapitre", type: "textarea", placeholder: "Point de départ si la série commence…" },
    { key: "previousEpisode", label: "Épisode précédent / continuité", type: "textarea", placeholder: "Résumez précisément la dernière scène…" },
    { key: "direction", label: "Direction du prochain épisode", type: "textarea", placeholder: "Nouvelle aventure, émotion, rythme et évolution souhaitée…" },
    { key: "seriesBible", label: "Personnages et identité visuelle", type: "textarea", placeholder: "Apparence, proportions, décor, lumière et style à verrouiller…" },
    { key: "dialogueMode", label: "Narration", type: "select", options: [{ value: "visual", label: "Visuel + musique/SFX" }, { value: "dialogue", label: "Dialogue court autorisé" }] },
    { key: "endingMode", label: "Fin", type: "select", options: [{ value: "cliffhanger", label: "Payoff + cliffhanger léger" }, { value: "complete", label: "Fin complète" }] },
  ],
  "recipe-creator": [
    { key: "recipeTitle", label: "Titre de la recette", type: "text", placeholder: "Ex. pain au chocolat facile" },
    { key: "ingredients", label: "Ingrédients", type: "textarea", placeholder: "Un ingrédient par ligne…" },
    { key: "steps", label: "Étapes", type: "textarea", placeholder: "Une étape par ligne…" },
    { key: "focusKeyword", label: "Mot-clé principal", type: "text", placeholder: "Ex. easy chocolate bread" },
    { key: "seoTitle", label: "Titre SEO (optionnel)", type: "text", placeholder: "Ex. Easy Chocolate Bread (No Yeast)" },
    { key: "language", label: "Langue", type: "select", options: [{ value: "fr", label: "Français" }, { value: "en", label: "English" }, { value: "ar", label: "العربية" }] },
    { key: "authorName", label: "Auteur (rotation auto si vide)", type: "text", placeholder: "Ex. Salma B." },
    { key: "duplicatePolicy", label: "Anti-doublon", type: "select", options: [{ value: "ask", label: "Demander confirmation" }, { value: "force_new", label: "Toujours forcer" }, { value: "update_existing", label: "Préparer la mise à jour" }] },
    { key: "metaDescription", label: "Meta description", type: "textarea", placeholder: "145 à 158 caractères…" },
    { key: "imageDirection", label: "Direction des images", type: "textarea", placeholder: "Lumière, cadrage, vaisselle et identité visuelle…" },
    { key: "wordpressMode", label: "Sortie WordPress", type: "select", options: [{ value: "draft", label: "Brouillon uniquement" }, { value: "review", label: "Validation texte + images requise" }] },
  ],
  "recipe-video": [
    { key: "projectName", label: "Nom du projet", type: "text", placeholder: "Ex. Potato Omelet V2" },
    { key: "recipeName", label: "Nom de la recette", type: "text", placeholder: "Nom du plat" },
    { key: "creativeDirection", label: "Instruction créative", type: "textarea", placeholder: "Cadrage macro, lumière, rythme et actions culinaires…" },
    { key: "analysisInterval", label: "Intervalle d'analyse (secondes)", type: "number", placeholder: "0.8" },
    { key: "maxFrames", label: "Images d'analyse maximum (12-400)", type: "number", placeholder: "180" },
    { key: "aspectRatio", label: "Format", type: "select", options: [{ value: "9:16", label: "Vertical 9:16" }, { value: "4:5", label: "Instagram 4:5" }, { value: "1:1", label: "Carré 1:1" }] },
    { key: "maxScenes", label: "Micro-scènes maximum", type: "select", options: [{ value: "4", label: "4 scènes" }, { value: "6", label: "6 scènes" }, { value: "8", label: "8 scènes (défaut)" }, { value: "12", label: "12 scènes" }, { value: "16", label: "16 scènes" }] },
    { key: "sceneDuration", label: "Durée par scène", type: "select", options: [{ value: "4", label: "4 secondes" }, { value: "6", label: "6 secondes" }, { value: "8", label: "8 secondes" }] },
    { key: "publishingReport", label: "Rapport recette + publication", type: "checkbox", placeholder: "Ajoute métadonnées, voix off et prompts" },
  ],
  "cookbook-marketing": [
    { key: "bookTitle", label: "Titre du livre", type: "text", placeholder: "Titre commercial" },
    { key: "offerUrl", label: "Lien de l'offre", type: "url", placeholder: "https://…" },
    { key: "instagramHandle", label: "Compte Instagram cible", type: "text", placeholder: "@votrecompte" },
    { key: "startDate", label: "Première semaine", type: "date", placeholder: "AAAA-MM-JJ" },
    { key: "weeks", label: "Nombre de semaines", type: "select", options: [{ value: "2", label: "2 semaines" }, { value: "4", label: "4 semaines" }, { value: "8", label: "8 semaines" }, { value: "12", label: "12 semaines" }] },
    { key: "price", label: "Prix du bundle", type: "number", placeholder: "12.99" },
    { key: "visualCount", label: "Visuels par publication", type: "select", options: [{ value: "1", label: "1 image" }, { value: "2", label: "2 images — carousel" }, { value: "3", label: "3 images — carousel" }, { value: "4", label: "4 images — carousel" }] },
    { key: "campaignBrief", label: "Message de campagne", type: "textarea", placeholder: "Audience, bénéfice et appel à l'action…" },
    { key: "publishTime", label: "Heure de publication", type: "time", placeholder: "12:00" },
  ],
  "video-editor": [
    { key: "projectName", label: "Nom du projet", type: "text", placeholder: "Ex. Reel couscous" },
    { key: "projectFormat", label: "Format", type: "select", options: [{ value: "9:16", label: "Reel / TikTok 9:16" }, { value: "4:5", label: "Instagram 4:5" }, { value: "16:9", label: "Paysage 16:9" }, { value: "1:1", label: "Carré 1:1" }, { value: "21:9", label: "Cinéma 21:9" }] },
    { key: "resolution", label: "Résolution", type: "select", options: [{ value: "720p", label: "720p" }, { value: "1080p", label: "1080p" }, { value: "2k", label: "2K" }, { value: "4k", label: "4K" }] },
    { key: "fps", label: "Images par seconde", type: "select", options: [{ value: "24", label: "24 FPS" }, { value: "30", label: "30 FPS" }, { value: "60", label: "60 FPS" }] },
    { key: "exportFormat", label: "Export", type: "select", options: [{ value: "mp4", label: "MP4" }, { value: "webm", label: "WebM" }] },
    { key: "quality", label: "Qualité", type: "select", options: [{ value: "medium", label: "Moyenne" }, { value: "high", label: "Haute" }, { value: "ultra", label: "Ultra" }] },
    { key: "editingNotes", label: "Notes de montage", type: "textarea", placeholder: "Rythme, transitions, sous-titres…" },
  ],
  workflows: [
    { key: "objective", label: "Objectif du workflow", type: "textarea", placeholder: "Décrivez le résultat attendu…" },
    { key: "workflowMode", label: "Mode", type: "select", options: [{ value: "custom", label: "Personnalisé" }, { value: "spy", label: "Spy" }, { value: "pinterest", label: "Pinterest" }, { value: "gtrends", label: "Google Trends" }, { value: "generate", label: "Génération" }] },
    { key: "keyword", label: "Mot-clé / sujet", type: "text", placeholder: "Sujet du workflow…" },
    { key: "category", label: "Catégorie", type: "text", placeholder: "Catégorie de tri…" },
  ],
  automations: [
    { key: "objective", label: "Objectif de l'automation", type: "textarea", placeholder: "Décrivez la tâche récurrente…" },
  ],
  "facebook-spy": [
    { key: "source", label: "Page ou sujet public", type: "text", placeholder: "URL publique ou nom de page…" },
    { key: "category", label: "Catégorie", type: "text", placeholder: "Ex. recettes…" },
    { key: "maxPostAge", label: "Âge max des posts (jours)", type: "number", placeholder: "7" },
    { key: "minShares", label: "Partages minimum", type: "number", placeholder: "0" },
    { key: "minLikes", label: "Likes minimum", type: "number", placeholder: "0" },
    { key: "minComments", label: "Commentaires minimum", type: "number", placeholder: "0" },
    { key: "sortBy", label: "Tri", type: "select", options: [{ value: "now", label: "Plus récents" }, { value: "shares", label: "Partages" }, { value: "comments", label: "Commentaires" }, { value: "viral", label: "Viralité" }] },
    { key: "hideUsed", label: "Masquer les posts déjà utilisés", type: "checkbox", placeholder: "Exclut l'historique" },
  ],
  "instagram-spy": [
    { key: "accountUrl", label: "Compte à surveiller", type: "text", placeholder: "Ex. tasty ou instagram.com/tasty" },
    { key: "postsLimit", label: "Posts max (1-50)", type: "number", placeholder: "24" },
    { key: "minLikes", label: "Likes minimum", type: "number", placeholder: "0" },
    { key: "minComments", label: "Commentaires minimum", type: "number", placeholder: "0" },
    { key: "mediaType", label: "Type de média", type: "select", options: [{ value: "all", label: "Tous" }, { value: "reel", label: "Reels" }, { value: "image", label: "Images" }] },
    { key: "sortBy", label: "Tri", type: "select", options: [{ value: "recent", label: "Plus récents" }, { value: "likes", label: "Likes" }, { value: "comments", label: "Commentaires" }] },
    { key: "searchQuery", label: "Mot-clé", type: "text", placeholder: "Rechercher par mot-clé…" },
  ],
  "social-analytics": [
    { key: "automation", label: "Automation suivie", type: "text", placeholder: "Nom de l'automation…" },
    { key: "range", label: "Période", type: "select", options: [{ value: "24h", label: "24 heures" }, { value: "7d", label: "7 jours" }, { value: "30d", label: "30 jours" }, { value: "1y", label: "1 an" }] },
    { key: "errorCategory", label: "Catégorie d'erreur", type: "select", options: [{ value: "all", label: "Toutes" }, { value: "timeout", label: "Timeout" }, { value: "rate_limit", label: "Rate limit" }, { value: "auth", label: "Auth" }, { value: "network", label: "Réseau" }, { value: "api_error", label: "API" }] },
  ],
  "facebook-analytics": [
    { key: "pageType", label: "Type de page", type: "select", options: [{ value: "recipe", label: "Recettes" }, { value: "fitness", label: "Fitness" }, { value: "fashion", label: "Mode" }, { value: "travel", label: "Voyage" }, { value: "business", label: "Business" }, { value: "tech", label: "Tech" }, { value: "entertainment", label: "Divertissement" }, { value: "education", label: "Éducation" }, { value: "motivation", label: "Motivation" }, { value: "general", label: "Général" }] },
    { key: "analysisDepth", label: "Profondeur d'analyse", type: "select", options: [{ value: "30", label: "30 posts" }, { value: "50", label: "50 posts" }, { value: "100", label: "100 posts" }, { value: "200", label: "200 posts" }] },
    { key: "imageCount", label: "Images à analyser", type: "select", options: [{ value: "5", label: "5" }, { value: "10", label: "10" }, { value: "15", label: "15" }, { value: "20", label: "20" }] },
    { key: "objective", label: "Objectif de l'analyse", type: "textarea", placeholder: "Signaux et conclusions recherchés…" },
  ],
  "google-trends": [
    { key: "keyword", label: "Mot-clé", type: "text", placeholder: "Ex. easy bread" },
    { key: "region", label: "Région", type: "select", options: [{ value: "US", label: "États-Unis" }, { value: "GB", label: "Royaume-Uni" }, { value: "CA", label: "Canada" }, { value: "AU", label: "Australie" }, { value: "DE", label: "Allemagne" }, { value: "FR", label: "France" }, { value: "ES", label: "Espagne" }, { value: "MA", label: "Maroc" }, { value: "BR", label: "Brésil" }, { value: "", label: "Monde" }] },
    { key: "timeRange", label: "Période", type: "select", options: [{ value: "4h", label: "4 heures" }, { value: "24h", label: "24 heures" }, { value: "48h", label: "48 heures" }, { value: "7d", label: "7 jours" }] },
    { key: "category", label: "Catégorie", type: "text", placeholder: "Ex. Food & Drink…" },
  ],
  "pinterest-scanner": [
    { key: "username", label: "Compte Pinterest", type: "text", placeholder: "Nom d'utilisateur…" },
    { key: "pinsFilter", label: "Filtrer les pins", type: "text", placeholder: "Mot-clé…" },
    { key: "board", label: "Tableau", type: "text", placeholder: "Nom du tableau…" },
    { key: "sortBy", label: "Tri", type: "select", options: [{ value: "saves_desc", label: "Saves ↓" }, { value: "date_desc", label: "Date ↓" }, { value: "reactions_desc", label: "Réactions ↓" }, { value: "comments_desc", label: "Commentaires ↓" }, { value: "title_asc", label: "Titre A-Z" }] },
  ],
  "pinterest-keywords": [
    { key: "keyword", label: "Mot-clé", type: "text", placeholder: "Ex. oat bread" },
    { key: "country", label: "Pays", type: "select", options: [{ value: "US", label: "États-Unis" }, { value: "GB", label: "Royaume-Uni" }, { value: "CA", label: "Canada" }, { value: "AU", label: "Australie" }, { value: "FR", label: "France" }, { value: "DE", label: "Allemagne" }, { value: "BR", label: "Brésil" }, { value: "ES", label: "Espagne" }, { value: "IT", label: "Italie" }, { value: "MX", label: "Mexique" }] },
  ],
  "pinterest-analytics": [
    { key: "range", label: "Période", type: "select", options: [{ value: "7d", label: "7 jours" }, { value: "30d", label: "30 jours" }, { value: "60d", label: "60 jours" }, { value: "90d", label: "90 jours" }] },
    { key: "metric", label: "Métrique", type: "select", options: [{ value: "IMPRESSION", label: "Impressions" }, { value: "ENGAGEMENT", label: "Engagements" }, { value: "PIN_CLICK", label: "Clics" }, { value: "OUTBOUND_CLICK", label: "Clics sortants" }, { value: "SAVE", label: "Saves" }] },
  ],
  "facebook-pages": [
    { key: "pageName", label: "Nom de la page", type: "text", placeholder: "Ex. Easy Work Lunches" },
    { key: "pageUrl", label: "URL de la page Facebook", type: "url", placeholder: "https://facebook.com/…" },
    { key: "search", label: "Recherche", type: "text", placeholder: "Rechercher…" },
  ],
  "facebook-groups": [
    { key: "groupName", label: "Nom du groupe", type: "text", placeholder: "Ex. Recettes faciles" },
    { key: "groupUrl", label: "URL du groupe", type: "url", placeholder: "https://facebook.com/groups/…" },
    { key: "dailyCap", label: "Max posts / profil / jour (0-200)", type: "number", placeholder: "8" },
    { key: "commentDelayMin", label: "Délai 1er commentaire min (s)", type: "number", placeholder: "60" },
    { key: "commentDelayMax", label: "Délai 1er commentaire max (s)", type: "number", placeholder: "180" },
    { key: "humanMode", label: "Mode humain (délais aléatoires)", type: "checkbox", placeholder: "Comportement prudent" },
    { key: "autoScanInterval", label: "Re-scan auto (heures)", type: "number", placeholder: "24" },
  ],
  "pinterest-accounts": [
    { key: "boardName", label: "Tableau", type: "text", placeholder: "Ex. Easy Dinners" },
    { key: "trendCategory", label: "Catégorie tendances", type: "select", options: [{ value: "", label: "Aucune" }, { value: "food", label: "Food & Drinks" }, { value: "animals", label: "Animaux" }, { value: "beauty", label: "Beauté" }, { value: "diy", label: "DIY & Crafts" }, { value: "interior", label: "Intérieur" }, { value: "travel", label: "Voyage" }, { value: "health", label: "Santé" }, { value: "wedding", label: "Mariage" }, { value: "education", label: "Éducation" }] },
    { key: "trendCountry", label: "Pays tendances", type: "select", options: [{ value: "US", label: "États-Unis" }, { value: "GB", label: "Royaume-Uni" }, { value: "CA", label: "Canada" }, { value: "AU", label: "Australie" }, { value: "DE", label: "Allemagne" }, { value: "FR", label: "France" }, { value: "ES", label: "Espagne" }, { value: "IT", label: "Italie" }, { value: "BR", label: "Brésil" }, { value: "MX", label: "Mexique" }] },
    { key: "titlesPerAccount", label: "Titres par compte (1-200)", type: "number", placeholder: "5" },
    { key: "titlePrompt", label: "Prompt de titres (variable {BOARD_NAME})", type: "textarea", placeholder: "Ex. 5 titres viraux pour {BOARD_NAME}…" },
  ],
  "wordpress-category": [
    { key: "categoryName", label: "Catégorie", type: "text", placeholder: "Ex. Recettes" },
    { key: "categorySlug", label: "Slug", type: "text", placeholder: "ex-recettes" },
    { key: "postTitle", label: "Titre de l'article", type: "text", placeholder: "Titre…" },
    { key: "postContent", label: "Contenu (HTML ou texte)", type: "textarea", placeholder: "<p>Votre contenu…</p>" },
  ],
};

const researchFallback = [
  { key: "source", label: "Source ou sujet public", type: "text", placeholder: "URL publique, compte ou sujet…" },
  { key: "keywords", label: "Mots-clés", type: "text", placeholder: "Séparés par des virgules" },
  { key: "limit", label: "Limite de résultats", type: "number", placeholder: "25" },
  { key: "objective", label: "Objectif de l'analyse", type: "textarea", placeholder: "Signaux et conclusions recherchés…" },
] as ModuleSetting[];

const socialFallback = [
  { key: "contentTitle", label: "Titre interne", type: "text", placeholder: "Nom de la publication" },
  { key: "caption", label: "Texte de publication", type: "textarea", placeholder: "Caption à valider avant publication…" },
  { key: "publishAt", label: "Date souhaitée", type: "text", placeholder: "AAAA-MM-JJ HH:mm" },
  { key: "accountConnection", label: "Connexion requise", type: "select", options: [{ value: "not-connected", label: "À connecter" }, { value: "draft-only", label: "Brouillon uniquement" }] },
] as ModuleSetting[];

const studioFallback = [
  { key: "brief", label: "Brief créatif", type: "textarea", placeholder: "Décrivez le résultat visuel attendu…" },
  { key: "outputFormat", label: "Format de sortie", type: "select", options: [{ value: "1080x1350", label: "Instagram 4:5" }, { value: "1080x1920", label: "Vertical 9:16" }, { value: "1080x1080", label: "Carré 1:1" }] },
  { key: "quality", label: "Qualité", type: "select", options: [{ value: "standard", label: "Standard" }, { value: "high", label: "Haute" }] },
] as ModuleSetting[];

const manageFallback = [
  { key: "objective", label: "Objectif", type: "textarea", placeholder: "Décrivez l'organisation ou l'opération attendue…" },
  { key: "retention", label: "Conservation", type: "select", options: [{ value: "30", label: "30 jours" }, { value: "90", label: "90 jours" }, { value: "unlimited", label: "Sans limite" }] },
] as ModuleSetting[];

export function getModuleSettings(slug: string): ModuleSetting[] {
  if (settings[slug]) return settings[slug];
  if (["facebook", "instagram", "pinterest"].includes(slug)) return socialFallback;
  if (["mini-canvas", "image-cleaner", "reel-studio", "watermark-cleaner"].includes(slug)) return studioFallback;
  if (["structures", "mailboxes", "backups", "community", "marketplace"].includes(slug)) return manageFallback;
  return [{ key: "objective", label: "Objectif du projet", type: "textarea", placeholder: "Décrivez ce que ce projet doit accomplir…" }];
}
