export type MarketplaceTemplate = {
  id: string;
  moduleSlug: string;
  name: string;
  description: string;
  inputs: Record<string, string>;
};

// Modèles de démonstration sans chemin local, identifiant de compte ou secret.
// L'installation crée toujours une copie privée appartenant à l'organisation.
export const marketplaceTemplates: MarketplaceTemplate[] = [
  {
    id: "recipe-seo-starter",
    moduleSlug: "recipe-creator",
    name: "Article recette SEO",
    description: "Brief, article, audit SEO, Recipe Schema et brouillon WordPress.",
    inputs: {
      language: "en",
      imageDirection: "Natural food photography, realistic texture, close framing, no text, no watermark",
    },
  },
  {
    id: "recipe-video-starter",
    moduleSlug: "recipe-video",
    name: "Vidéo recette courte",
    description: "Découpage compact, prompts vidéo et contrôle de continuité.",
    inputs: {},
  },
  {
    id: "cookbook-campaign-starter",
    moduleSlug: "cookbook-marketing",
    name: "Campagne cookbook",
    description: "Planning éditorial, visuels Instagram et captions orientées conversion.",
    inputs: {},
  },
];
