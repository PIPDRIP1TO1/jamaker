export type EbookIngredient = { item: string; amount: string };

export type EbookRecipe = {
  id: string;
  url: string;
  title: string;
  category: string;
  prepTime: string;
  cookTime: string;
  servings: string;
  ingredients: EbookIngredient[];
  steps: string[];
  tips?: string;
  imageUrl: string;
  imageSource: "ai" | "original" | "custom";
  status: "imported" | "generated" | "edited";
};

export type EbookTheme = "gourmet" | "minimal" | "rustic" | "vibrant";

export type EbookProject = {
  id: string;
  title: string;
  subtitle: string;
  author: string;
  brandName: string;
  language: "en" | "fr";
  theme: EbookTheme;
  accentColor: string;
  coverImage: string;
  backCoverImage?: string;
  useCustomFrontCover?: boolean;
  useCustomBackCover?: boolean;
  introTitle: string;
  introText: string;
  backCoverText: string;
  backCoverAuthorBio: string;
  socialLinks: { website?: string; instagram?: string; store?: string };
  recipes: EbookRecipe[];
  selectedCategories?: string[];
  createdAt: string;
  updatedAt: string;
};

export type EbookSummary = EbookProject & { persisted: true };

export function createEmptyEbook(): EbookProject {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "My Recipe Cookbook",
    subtitle: "Delicious recipes for everyday cooking",
    author: "Your Name",
    brandName: "JA MAKER PRESS",
    language: "en",
    theme: "gourmet",
    accentColor: "#c2410c",
    coverImage: "",
    introTitle: "Welcome to Your Cookbook",
    introText: "A practical collection of delicious recipes, organized for easy everyday cooking.",
    backCoverText: "Discover approachable recipes with clear ingredients, reliable steps and useful chef tips.",
    backCoverAuthorBio: "Created with care for home cooks who want dependable results.",
    socialLinks: {},
    recipes: [],
    createdAt: now,
    updatedAt: now,
  };
}
