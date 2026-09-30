export type SeoSeverity = "pass" | "warning" | "critical";

export type SeoCheck = {
  id: string;
  label: string;
  severity: SeoSeverity;
  points: number;
  maximum: number;
  detail: string;
};

export type SeoBrief = {
  primaryKeyword: string;
  searchIntent: "informational";
  audience: string;
  secondaryKeywords: string[];
  outline: string[];
  questionsToAnswer: string[];
  internalLinkIdeas: string[];
  imageSeo: Array<{ role: string; fileName: string; altText: string }>;
};

export type SeoAudit = {
  score: number;
  grade: "Excellent" | "Bon" | "À améliorer" | "Bloqué";
  publishReady: boolean;
  criticalCount: number;
  checks: SeoCheck[];
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

function uniqueWords(keyword: string) {
  return keyword.toLowerCase().split(/\s+/).filter((word) => word.length > 2);
}

export function buildSeoBrief(input: { title: string; focusKeyword: string; ingredients: string[] }) : SeoBrief {
  const primaryKeyword = input.focusKeyword.trim().toLowerCase() || input.title.toLowerCase();
  const anchor = uniqueWords(primaryKeyword).slice(0, 3).join(" ") || "recipe";
  const ingredientTerms = input.ingredients
    .map((item) => item.replace(/^\s*[\d¼½¾⅓⅔⅛⅜⅝⅞.,/\-]+\s*(?:g|kg|ml|l|oz|lb|cup|cups|tbsp|tsp)?\s*/i, "").trim())
    .filter((item) => item.length > 3)
    .slice(0, 3);

  return {
    primaryKeyword,
    searchIntent: "informational",
    audience: "Home cooks looking for a reliable, practical recipe with clear steps",
    secondaryKeywords: [
      `easy ${anchor}`,
      `homemade ${anchor}`,
      `${anchor} ingredients`,
      `${anchor} storage`,
      ...ingredientTerms.map((term) => `${anchor} with ${term.toLowerCase()}`),
    ].slice(0, 7),
    outline: ["Why this recipe works", "Ingredients and substitutions", "Step-by-step instructions", "Expert tips", "Storage and reheating", "Frequently asked questions"],
    questionsToAnswer: [
      `How do you make ${input.title}?`,
      `Can ${input.title} be prepared ahead?`,
      `How should leftovers be stored?`,
      `Which substitutions work without changing the result?`,
    ],
    internalLinkIdeas: [
      "Link to one closely related recipe from the same category",
      "Link to an ingredient guide or cooking-technique article",
      "Link to a complementary side dish, dessert, or meal plan",
    ],
    imageSeo: [
      { role: "featured", fileName: `${slugify(primaryKeyword)}-recipe.jpg`, altText: `${input.title} finished and ready to serve` },
      { role: "hero", fileName: `${slugify(primaryKeyword)}-close-up.jpg`, altText: `Close-up of homemade ${input.title}` },
      { role: "ingredients", fileName: `${slugify(primaryKeyword)}-ingredients.jpg`, altText: `Ingredients needed to make ${input.title}` },
      { role: "serving", fileName: `${slugify(primaryKeyword)}-serving.jpg`, altText: `${input.title} plated for serving` },
    ],
  };
}

function containsKeyword(value: string, keyword: string) {
  return Boolean(keyword && value.toLowerCase().includes(keyword.toLowerCase()));
}

export function auditRecipeSeo(input: {
  title: string;
  seoTitle: string;
  metaDescription: string;
  focusKeyword: string;
  introduction: string;
  ingredients: string[];
  instructions: string[];
  faq: Array<{ q: string; a: string }>;
  schema: Record<string, unknown>;
  imageAltTexts: string[];
}): SeoAudit {
  const checks: SeoCheck[] = [];
  const add = (id: string, label: string, ok: boolean, maximum: number, detailOk: string, detailFail: string, severity: SeoSeverity = "warning") => {
    checks.push({ id, label, severity: ok ? "pass" : severity, points: ok ? maximum : 0, maximum, detail: ok ? detailOk : detailFail });
  };

  add("keyword-title", "Mot-clé dans le titre", containsKeyword(input.seoTitle, input.focusKeyword), 14, "Le titre SEO contient le mot-clé principal.", "Ajoutez le mot-clé principal au titre SEO.");
  add("title-length", "Longueur du titre SEO", input.seoTitle.length >= 35 && input.seoTitle.length <= 65, 8, `${input.seoTitle.length} caractères.`, `${input.seoTitle.length} caractères : cible recommandée 35–65.`);
  add("meta-length", "Meta description", input.metaDescription.length >= 120 && input.metaDescription.length <= 160, 10, `${input.metaDescription.length} caractères.`, `${input.metaDescription.length} caractères : cible recommandée 120–160.`);
  add("keyword-meta", "Mot-clé dans la meta", containsKeyword(input.metaDescription, input.focusKeyword), 8, "Mot-clé présent dans la meta description.", "Placez naturellement le mot-clé dans la meta description.");
  add("keyword-intro", "Mot-clé dans l’introduction", containsKeyword(input.introduction, input.focusKeyword), 8, "Mot-clé présent dès l’introduction.", "Mentionnez le mot-clé dans l’introduction.");
  add("ingredients", "Liste d’ingrédients", input.ingredients.length >= 3, 12, `${input.ingredients.length} ingrédients structurés.`, "Il faut au moins 3 ingrédients réels.", "critical");
  add("instructions", "Étapes exploitables", input.instructions.length >= 3 && input.instructions.every((step) => step.length >= 12), 14, `${input.instructions.length} étapes détaillées.`, "Il faut au moins 3 étapes claires et détaillées.", "critical");
  add("faq", "Réponses aux questions", input.faq.length >= 3 && input.faq.every((item) => item.a.length >= 35), 8, `${input.faq.length} réponses utiles.`, "Ajoutez au moins 3 réponses substantielles.");
  add("images", "SEO des images", input.imageAltTexts.length === 4 && input.imageAltTexts.every((alt) => alt.length >= 12), 8, "4 textes alternatifs préparés.", "Préparez un texte alternatif descriptif pour chaque image.");
  const schemaValid = input.schema["@type"] === "Recipe" && Array.isArray(input.schema.recipeIngredient) && Array.isArray(input.schema.recipeInstructions);
  add("schema", "Recipe Schema", schemaValid, 10, "Le JSON-LD Recipe contient les propriétés essentielles.", "Recipe Schema absent ou incomplet.", "critical");

  const maximum = checks.reduce((sum, check) => sum + check.maximum, 0);
  const score = Math.round((checks.reduce((sum, check) => sum + check.points, 0) / maximum) * 100);
  const criticalCount = checks.filter((check) => check.severity === "critical").length;
  const publishReady = criticalCount === 0;
  const grade = !publishReady ? "Bloqué" : score >= 90 ? "Excellent" : score >= 75 ? "Bon" : "À améliorer";
  return { score, grade, publishReady, criticalCount, checks };
}
