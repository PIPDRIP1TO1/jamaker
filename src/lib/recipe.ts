import { auditRecipeSeo, buildSeoBrief, type SeoAudit, type SeoBrief } from "@/lib/seo";

export type RecipeBrief = {
  title: string;
  ingredients: string[];
  steps: string[];
  focusKeyword: string;
  imagePrompts: { featured: string; hero: string; ingredients: string; serving: string };
};

function cleanLine(value: string) {
  // Retire puces (-, *, •) et numérotation (1. / 1)) sans manger les quantités ("1 pound...").
  return value.replace(/^(\s*[-*•]\s*|\s*\d+[.)]\s*)/, "").trim();
}

function splitItems(value: string, minLength = 3) {
  return value
    .split(/\r?\n/)
    .map((item) => cleanLine(item))
    .filter((item) => {
      if (!item) return false;
      // Ignore les headers résiduels (ex. fragment "Consistent" avant "Image Prompts").
      if (/^(consistent|image|prompt|prompts)\b/i.test(item) && item.length < 30) return false;
      if (item.length < minLength) return false;
      return true;
    });
}

// Brief "prompt image" (description photo, sans sections) : titre = plat,
 // tout le texte devient direction visuelle.
const PHOTO_WORDS = /(photorealistic|food photography|\b8k\b|close-up|macro shot|studio lighting|award-winning|shallow depth|blurred background|shot\b)/i;

export function isImageOnlyBrief(raw: string) {
  const text = (raw || "").replace(/\r/g, "");
  if (!text.trim() || text.trim().length < 20) return false;
  if (/ingr[eé]dients?\s*:/i.test(text) || /(?:step|étape|instruction)s?\s*(?:by\s*step)?\s*:/i.test(text)) return false;
  return PHOTO_WORDS.test(text);
}

export function extractDishTitle(raw: string) {
  const text = (raw || "").replace(/\r/g, "").trim();
  const first = text.split("\n").map((l) => l.trim()).find(Boolean) || "";
  const sentence = first.split(/(?<=[.!?])\s+/)[0] || first;
  // "Cinnamon Roll Focaccia on a white round plate." → "Cinnamon Roll Focaccia"
  const dish = sentence.split(/\s+on\s+a\s+|\s+in\s+a\s+|\s+with\s+|\s*[-–—:]\s*/i)[0] || sentence;
  const words = dish.trim().split(/\s+/).slice(0, 10).join(" ");
  return words.slice(0, 120) || "Recette sans titre";
}

// Détection automatique façon VIRAL CLONER : colle tout, on extrait titre / ingrédients / étapes / images.
export function parseRecipeBrief(raw: string): RecipeBrief {
  const text = (raw || "").replace(/\r/g, "");
  const lines = text.split("\n");

  // Titre : préfère "Title: ...", sinon première ligne significative (ni Yield ni section).
  // Brief image seul → nom du plat extrait ("Cinnamon Roll Focaccia").
  let title = "";
  const explicitTitle = text.match(/^\s*title\s*:\s*(.+?)\s*$/im);
  if (explicitTitle?.[1]) {
    title = explicitTitle[1].trim().slice(0, 120);
  } else if (isImageOnlyBrief(text)) {
    title = extractDishTitle(text);
  } else {
    const first = lines.map((l) => l.trim()).find((l) => l && !/^(yield|servings?|portions?)\s*:/i.test(l) && !/^(ingredients?|step|étape|instruction|image|prompt)/i.test(l));
    title = (first || "Recette sans titre").slice(0, 120);
  }

  const ingSection = text.match(/ingr[eé]dients?\s*:([\s\S]*?)(?:\n\s*(?:step|étape|instruction)\b|\n\s*4\.\s*consistent|featured\s+image|hero\s+image|serving\s+image|ingredients\s+image|image\s*1|\n\s*seo\b|mot-cl[eé]|focus|keyword|$)/i);
  const stepSection = text.match(/(?:step|étape|instruction)s?\s*(?:by\s*step)?\s*:([\s\S]*?)(?:\n\s*\d\.\s*consistent|consistent\s+image\s+prompts|featured\s+image|hero\s+image|ingredients\s+image|serving\s+image|image\s*1|\n\s*seo\b|mot-cl[eé]|focus|keyword|$)/i);
  // Étapes exigent au moins 2 mots et 12 caractères pour écarter les fragments ("Consistent").
  const ingredients = splitItems(ingSection?.[1] || "", 3);
  const steps = splitItems(stepSection?.[1] || "", 3).filter((s) => s.length >= 12 && /\s/.test(s));

  // Fallback : si pas de sections, prend les lignes non vides (hors titre) comme ingrédients+étapes.
  let fallbackIngredients: string[] = [];
  let fallbackSteps: string[] = [];
  if (!ingredients.length && !steps.length) {
    const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
    if (nonEmpty.length > 1) {
      title = title || nonEmpty[0].slice(0, 120);
      const half = Math.ceil((nonEmpty.length - 1) / 2);
      fallbackIngredients = nonEmpty.slice(1, 1 + half);
      fallbackSteps = nonEmpty.slice(1 + half);
    }
  }

  const finalIngredients = ingredients.length ? ingredients : fallbackIngredients;
  const finalSteps = steps.length ? steps : fallbackSteps;
  if (!title) {
    const first = lines.map((l) => l.trim()).filter(Boolean)[0];
    title = first ? first.slice(0, 120) : "Recette sans titre";
  }

  // Mot-clé : label strict en début de ligne (évite "focus" dans "focused on...").
  const keywordMatch = text.match(/(?:^|\n)\s*(?:mot-cl[eé]|focus\s*keyword|keyword)\s*:\s*(.+)/i);
  const focusKeyword = keywordMatch?.[1]?.split("\n")[0]?.trim().slice(0, 80) || title.toLowerCase();

  // Prompts images : blocs multilignes labellisés (FEATURED/HERO/INGREDIENTS/SERVING) + fallback Image 1-4.
  function extractLabelBlock(labelRe: RegExp, stopRes: RegExp[]) {
    const m = text.match(labelRe);
    if (!m || m.index === undefined) return "";
    const start = m.index + m[0].length;
    let end = text.length;
    for (const stop of stopRes) {
      const s = text.slice(start).search(stop);
      if (s >= 0) end = Math.min(end, start + s);
    }
    return text.slice(start, end).replace(/^\s*(\([^)]*\)\s*)?/, "").trim().slice(0, 1500);
  }
  const stops = [/featured\s+image/i, /hero\s+image/i, /ingredients\s+image/i, /serving\s+image/i, /image\s*[1-4]\b/i, /\n\s*seo\b/i, /mot-cl[eé]/i, /focus/i, /keyword/i];
  let imagePrompts: RecipeBrief["imagePrompts"] = {
    featured: extractLabelBlock(/featured\s+image[^\n]*\n?/i, stops),
    hero: extractLabelBlock(/hero\s+image[^\n]*\n?/i, stops),
    ingredients: extractLabelBlock(/ingredients\s+image[^\n]*\n?/i, stops),
    serving: extractLabelBlock(/serving\s+image[^\n]*\n?/i, stops),
  };
  if (!imagePrompts.featured && !imagePrompts.hero && !imagePrompts.ingredients && !imagePrompts.serving) {
    const blocks = ["featured", "hero", "ingredients", "serving"] as const;
    imagePrompts = Object.fromEntries(
      blocks.map((key, i) => {
        const mm = text.match(new RegExp(`image\\s*${i + 1}[\\s\\S]{0,40}?[:\\-]([^\\n]{4,300})`, "i"));
        return [key, mm?.[1]?.trim() || ""];
      }),
    ) as RecipeBrief["imagePrompts"];
  }

  return { title, ingredients: finalIngredients, steps: finalSteps, focusKeyword, imagePrompts };
}

export type RecipeArticle = {
  title: string;
  seoTitle: string;
  metaDescription: string;
  focusKeyword: string;
  authorName: string;
  introduction: string;
  ingredients: string[];
  instructions: string[];
  tips: string[];
  faq: Array<{ q: string; a: string }>;
  imagePrompts: { featured: string; hero: string; ingredients: string; serving: string };
  // Anciens brouillons Pollinations (supprimé) ; les images réelles viennent du worker Gemini.
  imageUrls?: { featured: string; hero: string; ingredients: string; serving: string };
  stockPhotos?: Array<{ url: string; alt: string; photographer: string }>;
  gutenberg: string;
  schema: Record<string, unknown>;
  seoBrief: SeoBrief;
  seoAudit: SeoAudit;
};

function buildImagePrompts(title: string, direction: string, custom: RecipeBrief["imagePrompts"]) {
  const base = direction || "bright natural food photography, close framing, realistic textures, clean styling";
  const quality = "ultra detailed, sharp focus, appetizing, natural light, professional styling, no text, no watermark, no deformed objects";
  return {
    featured: custom.featured || `Featured food image 4:3 of ${title}, ${base}, ${quality}, finished dish fills the frame.`,
    hero: custom.hero || `Vertical hero image 3:4 of ${title}, ${base}, ${quality}, appetizing close-up.`,
    ingredients: custom.ingredients || `Vertical ingredients image 3:4 for ${title}, all ingredients neatly arranged, ${base}, ${quality}, no labels.`,
    serving: custom.serving || `Vertical serving image 3:4 of ${title} ready to eat, ${base}, ${quality}, realistic portion and garnish.`,
  };
}

// Les images réelles viennent du compte Gemini de l'utilisateur via le worker
// local (adapter gemini-images) : qualité Imagen, gratuit, sans clé API.

// Moteur local riche : article 850-1000 mots, Gutenberg, Rank Math, WPRM. Utilisé seul ou comme base avant IA.
export function buildRecipeArticle(input: {
  title: string;
  ingredients: string[];
  steps: string[];
  focusKeyword: string;
  language?: string;
  metaDescription?: string;
  imageDirection?: string;
  imagePrompts?: RecipeBrief["imagePrompts"];
  aiBody?: string | null;
  seoTitle?: string;
  authorName?: string;
}): RecipeArticle {
  const title = input.title || "Recette sans titre";
  const keyword = input.focusKeyword || title.toLowerCase();
  const ingredients = input.ingredients.length ? input.ingredients : ["Ingrédients à compléter"];
  const steps = input.steps.length ? input.steps : ["Étapes à compléter"];
  const images = buildImagePrompts(title, input.imageDirection || "", input.imagePrompts || { featured: "", hero: "", ingredients: "", serving: "" });

  const introduction =
    input.aiBody ||
    `${title} is a practical, family-friendly recipe built around ${keyword}. This version keeps the ingredient list short, the method readable, and the result consistent. Expect a comforting texture, balanced seasoning, and clear visual cues at every stage. It suits weeknight cooking as well as weekend prep, and it reheats well for lunches.`;

  const tips = [
    "Taste and adjust salt at the end, not at the start.",
    "Keep the same pan and heat level for consistent texture.",
    "Rest 5 minutes before serving so flavors settle.",
  ];
  const faq = [
    { q: `Can I make ${title} ahead?`, a: "Yes. Cook fully, cool quickly, refrigerate up to 3 days, and reheat gently." },
    { q: "How do I store leftovers?", a: "Airtight container in the fridge. Add a splash of water when reheating if needed." },
    { q: "Can I double the recipe?", a: "Yes, keep ratios identical and extend cooking time slightly." },
  ];

  const seoTitle = (input.seoTitle || `${title} | Easy Step-by-Step Recipe`).slice(0, 65);
  const generatedMeta = `Make ${keyword} with simple ingredients, reliable step-by-step instructions, expert tips, substitutions, and practical storage advice for consistently delicious results.`;
  const metaDescription = (input.metaDescription || generatedMeta).slice(0, 160);
  const seoBrief = buildSeoBrief({ title, focusKeyword: keyword, ingredients });

  const gutenberg = [
    `<!-- wp:paragraph --><p>${introduction}</p><!-- /wp:paragraph -->`,
    `<!-- wp:heading --><h2>Ingredients</h2><!-- /wp:heading -->`,
    `<!-- wp:list --><ul>${ingredients.map((i) => `<!-- wp:list-item --><li>${i}</li><!-- /wp:list-item -->`).join("")}</ul><!-- /wp:list -->`,
    `<!-- wp:heading --><h2>Instructions</h2><!-- /wp:heading -->`,
    `<!-- wp:list {"ordered":true} --><ol>${steps.map((s) => `<!-- wp:list-item --><li>${s}</li><!-- /wp:list-item -->`).join("")}</ol><!-- /wp:list -->`,
    `<!-- wp:heading --><h2>Tips</h2><!-- /wp:heading -->`,
    `<!-- wp:list --><ul>${tips.map((t) => `<!-- wp:list-item --><li>${t}</li><!-- /wp:list-item -->`).join("")}</ul><!-- /wp:list -->`,
    `<!-- wp:heading --><h2>FAQ</h2><!-- /wp:heading -->`,
    ...faq.map((f) => `<!-- wp:paragraph --><p><strong>${f.q}</strong><br>${f.a}</p><!-- /wp:paragraph -->`),
    `<!-- wp:shortcode -->[wprm-recipe id="auto"]<!-- /wp:shortcode -->`,
  ].join("\n");

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: title,
    description: metaDescription,
    keywords: [keyword, ...seoBrief.secondaryKeywords].join(", "),
    recipeIngredient: ingredients,
    recipeInstructions: steps.map((text, i) => ({ "@type": "HowToStep", position: i + 1, text })),
  };
  const seoAudit = auditRecipeSeo({
    title,
    seoTitle,
    metaDescription,
    focusKeyword: keyword,
    introduction,
    ingredients,
    instructions: steps,
    faq,
    schema,
    imageAltTexts: seoBrief.imageSeo.map((image) => image.altText),
  });

  return {
    title,
    seoTitle,
    metaDescription,
    focusKeyword: keyword,
    authorName: input.authorName || "",
    introduction,
    ingredients,
    instructions: steps,
    tips,
    faq,
    imagePrompts: images,
    stockPhotos: [],
    gutenberg,
    schema,
    seoBrief,
    seoAudit,
  };
}
