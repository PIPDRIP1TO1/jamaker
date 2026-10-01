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

export type InternalLink = { label: string; url: string };

// Liens internes réels vers le site de l'utilisateur : un par ligne "Titre | https://...".
export function parseInternalLinks(raw: string): InternalLink[] {
  const links: InternalLink[] = [];
  for (const line of String(raw || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const sep = trimmed.indexOf("|");
    if (sep < 0) continue;
    const label = trimmed.slice(0, sep).trim().slice(0, 120);
    const url = trimmed.slice(sep + 1).trim().slice(0, 500);
    if (!label || !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(url)) continue;
    if (links.some((l) => l.url === url)) continue;
    links.push({ label, url });
    if (links.length >= 8) break;
  }
  return links;
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
  internalLinks: InternalLink[];
  wordCount: number;
  imagePrompts: { featured: string; hero: string; ingredients: string; serving: string };
  // Anciens brouillons Pollinations (supprimé) ; les images réelles viennent du worker Gemini.
  imageUrls?: { featured: string; hero: string; ingredients: string; serving: string };
  stockPhotos?: Array<{ url: string; alt: string; photographer: string }>;
  gutenberg: string;
  schema: Record<string, unknown>;
  // Charge utile pour créer la carte recette via l'API WP Recipe Maker au moment du publish.
  wprm: Record<string, unknown>;
  seoBrief: SeoBrief;
  seoAudit: SeoAudit;
};

type Lang = "fr" | "en" | "ar";

function langOf(value?: string): Lang {
  if (value === "ar") return "ar";
  if (value === "fr") return "fr";
  return "en";
}

const STRINGS: Record<Lang, {
  hWhy: (keyword: string) => string;
  hIngredients: string; hInstructions: string; hTips: string; hSubs: string; hStorage: string; hFaq: string; hAlsoLike: string;
  defaultIntro: (title: string, keyword: string) => string;
  whyBody: (title: string, keyword: string, steps: number) => string;
  subsBody: (title: string, first: string, second: string) => string;
  storageBody: (title: string) => string;
  tips: (title: string) => string[];
  faq: (title: string, keyword: string, steps: number) => Array<{ q: string; a: string }>;
  defaultMeta: (keyword: string) => string;
  defaultSeoTitle: (title: string) => string;
}> = {
  fr: {
    hWhy: (keyword) => `Pourquoi cette recette de ${keyword} fonctionne`,
    hIngredients: "Ingrédients", hInstructions: "Instructions pas à pas", hTips: "Astuces de réussite",
    hSubs: "Substitutions simples", hStorage: "Conservation et réchauffage", hFaq: "Questions fréquentes", hAlsoLike: "Vous aimerez aussi",
    defaultIntro: (title, keyword) => `${title} est une recette conviviale et fiable, pensée autour de ${keyword}. La liste des ingrédients reste courte, la méthode est claire et le résultat est régulier à chaque fois : une texture gourmande, un assaisonnement équilibré et des repères visuels simples à chaque étape. Elle convient aussi bien aux soirs pressés qu'aux repas du week-end, et se réchauffe très bien pour les lunchs. Suivez les quantités indiquées, goûtez avant de servir et adaptez l'assaisonnement à votre goût pour un plat vraiment réussi. Préparez tous les ingrédients à l'avance pour cuisiner sereinement, sans stress.`,
    whyBody: (title, keyword, steps) => `${title} repose sur une méthode simple en ${steps} étapes qui met en valeur ${keyword} sans technique compliquée. Chaque ingrédient a un rôle précis : le goût, la texture et la présentation. Un mijotage doux, sans couvercle quand la sauce doit épaissir, concentre les saveurs naturellement. En respectant l'ordre des étapes et les temps indiqués, vous obtenez un résultat stable, même sans grande expérience en cuisine.`,
    subsBody: (title, first, second) => `Pas de ${first} sous la main ? Remplacez-le par un ingrédient proche en quantité égale, le résultat de ${title} restera très satisfaisant. De même, ${second} peut être ajusté selon vos goûts ou votre régime. Gardez les proportions globales identiques : c'est l'équilibre de la recette qui garantit la réussite, pas un ingrédient unique.`,
    storageBody: (title) => `Laissez ${title} refroidir complètement, puis placez-le dans une boîte hermétique au réfrigérateur jusqu'à 3 jours. Réchauffez doucement avec un filet d'eau si besoin pour retrouver le moelleux. Pour les grandes quantités, divisez en portions individuelles : le réchauffage est plus rapide et plus homogène. Évitez de recongeler un plat déjà décongelé et goûtez toujours avant de servir les restes.`,
    tips: () => [
      "Salez et assaisonnez en fin de cuisson, après avoir goûté : c'est le seul moyen fiable d'équilibrer le plat.",
      "Gardez la même poêle et le même niveau de feu du début à la fin pour une texture régulière.",
      "Laissez reposer 5 minutes avant de servir : les saveurs se stabilisent et la présentation est plus nette.",
      "Servez avec du pain frais ou un accompagnement simple qui absorbe bien la sauce.",
    ],
    faq: (title, keyword, steps) => [
      { q: `Comment réussir ${title} à tous les coups ?`, a: `Suivez les ${steps} étapes dans l'ordre, pesez ${keyword} avec les quantités indiquées et goûtez avant de servir. La clé, c'est la régularité : même feu, mêmes gestes, et un repos de 5 minutes avant de passer à table.` },
      { q: `Peut-on préparer ${title} à l'avance ?`, a: `Oui, sans problème. Cuisinez ${title} entièrement, laissez refroidir rapidement puis conservez au réfrigérateur jusqu'à 3 jours. Réchauffez doucement et ajoutez un filet d'eau si la texture semble trop épaisse.` },
      { q: "Comment conserver les restes ?", a: "Dans une boîte hermétique au réfrigérateur, jusqu'à 3 jours. Réchauffez à feu doux ou au four à température modérée, et ne recongelez jamais un plat déjà décongelé pour des raisons de sécurité alimentaire." },
      { q: "Par quoi remplacer un ingrédient manquant ?", a: `Choisissez un ingrédient proche en goût et en texture, en gardant les mêmes proportions. La structure de ${title} reste stable tant que l'équilibre global est respecté : testez, goûtez et ajustez l'assaisonnement à la fin.` },
    ],
    defaultMeta: (keyword) => `Recette ${keyword} facile : ingrédients simples, instructions pas à pas, astuces, substitutions et conservation pour un résultat délicieux à chaque fois.`,
    defaultSeoTitle: (title) => `${title} : recette facile pas à pas`,
  },
  en: {
    hWhy: (keyword) => `Why this ${keyword} recipe works`,
    hIngredients: "Ingredients", hInstructions: "Step-by-step instructions", hTips: "Pro tips",
    hSubs: "Easy substitutions", hStorage: "Storage and reheating", hFaq: "Frequently asked questions", hAlsoLike: "You may also like",
    defaultIntro: (title, keyword) => `${title} is a practical, family-friendly recipe built around ${keyword}. This version keeps the ingredient list short, the method readable, and the result consistent. Expect a comforting texture, balanced seasoning, and clear visual cues at every stage. It suits weeknight cooking as well as weekend prep, and it reheats well for lunches. Follow the quantities, taste before serving, and adjust the seasoning to your liking for a truly satisfying dish. Prep all the ingredients in advance to cook calmly, without stress.`,
    whyBody: (title, keyword, steps) => `${title} follows a simple ${steps}-step method that lets ${keyword} shine without any complicated technique. Every ingredient earns its place for flavor, texture, or presentation. A gentle uncovered simmer, whenever the sauce needs thickening, concentrates flavors naturally. Keep the order of the steps and the timings, and you will get a reliable result even with little cooking experience.`,
    subsBody: (title, first, second) => `No ${first} on hand? Swap in a similar ingredient in equal quantity and ${title} will still turn out great. Likewise, ${second} can be adjusted to your taste or diet. Keep the overall ratios the same: it is the balance of the recipe that guarantees success, not any single ingredient.`,
    storageBody: (title) => `Let ${title} cool completely, then store it in an airtight container in the fridge for up to 3 days. Reheat gently with a splash of water if needed to restore moisture. For big batches, divide into single portions: reheating is faster and more even. Never refreeze a thawed dish, and always taste leftovers before serving.`,
    tips: () => [
      "Salt and season at the end, after tasting: it is the only reliable way to balance the dish.",
      "Keep the same pan and heat level from start to finish for consistent texture.",
      "Rest 5 minutes before serving so flavors settle and the presentation looks cleaner.",
      "Serve with fresh bread or a simple side dish that soaks up the sauce nicely.",
    ],
    faq: (title, keyword, steps) => [
      { q: `How do you make ${title} successfully every time?`, a: `Follow the ${steps} steps in order, measure ${keyword} as listed, and taste before serving. Consistency is the key: same heat, same moves, and a 5-minute rest before bringing it to the table.` },
      { q: `Can ${title} be prepared ahead?`, a: `Yes. Cook ${title} fully, cool it quickly, and refrigerate for up to 3 days. Reheat gently and add a splash of water if the texture looks too thick.` },
      { q: "How should leftovers be stored?", a: "In an airtight container in the fridge for up to 3 days. Reheat over low heat or in a moderate oven, and never refreeze a thawed dish for food-safety reasons." },
      { q: "What can I substitute for a missing ingredient?", a: `Pick something close in taste and texture, keeping the same ratios. The structure of ${title} stays solid as long as the overall balance is respected: test, taste, and adjust the seasoning at the end.` },
    ],
    defaultMeta: (keyword) => `Make ${keyword} with simple ingredients, reliable step-by-step instructions, expert tips, substitutions, and practical storage advice for consistently delicious results.`,
    defaultSeoTitle: (title) => `${title} | Easy Step-by-Step Recipe`,
  },
  ar: {
    hWhy: (keyword) => `لماذا تنجح وصفة ${keyword}`,
    hIngredients: "المكونات", hInstructions: "طريقة التحضير خطوة بخطوة", hTips: "نصائح للنجاح",
    hSubs: "بدائل بسيطة", hStorage: "الحفظ وإعادة التسخين", hFaq: "أسئلة شائعة", hAlsoLike: "قد يعجبك أيضاً",
    defaultIntro: (title, keyword) => `${title} وصفة عائلية عملية تعتمد على ${keyword}. قائمة المكونات مختصرة والطريقة واضحة والنتيجة ثابتة في كل مرة: قوام شهي وتتبيلة متوازنة وعلامات بصرية واضحة في كل مرحلة. تناسب عشاء أيام الأسبوع كما تناسب عطلة نهاية الأسبوع، وتُعاد تسخينها جيداً لوجبات الغداء. اتبعوا المقادير وتذوقوا قبل التقديم وعدّلوا التتبيلة حسب ذوقكم لطبق ناجح فعلاً. حضّروا كل المكونات مسبقاً لتطبخوا بهدوء ودون توتر.`,
    whyBody: (title, keyword, steps) => `تعتمد ${title} على طريقة بسيطة من ${steps} خطوات تُبرز ${keyword} دون أي تقنية معقدة. لكل مكون دور دقيق في الطعم أو القوام أو التقديم. نار هادئة دون غطاء، عندما تحتاج الصلصة إلى أن تتكاثف، تُركّز النكهات بشكل طبيعي. احترموا ترتيب الخطوات والأوقات المحددة لتحصلوا على نتيجة ثابتة حتى بدون خبرة كبيرة في المطبخ.`,
    subsBody: (title, first, second) => `لا يتوفر ${first}؟ استبدلوه بمكون قريب بنفس الكمية وستبقى ${title} ناجحة جداً. وبالمثل يمكن تعديل ${second} حسب ذوقكم أو نظامكم الغذائي. حافظوا على النسب العامة كما هي: فتوازن الوصفة هو ما يضمن النجاح وليس مكوناً واحداً.`,
    storageBody: (title) => `اتركوا ${title} تبرد تماماً ثم ضعوها في علبة محكمة في الثلاجة حتى 3 أيام. أعيدوا التسخين بلطف مع قليل من الماء عند الحاجة لاستعادة الطراوة. للكميات الكبيرة، قسّموا الطبق إلى حصص فردية: فإعادة التسخين تصبح أسرع وأكثر تجانساً. لا تعيدوا تجميد طبق سبق إذابته أبداً وتذوقوا البقايا دائماً قبل التقديم.`,
    tips: () => [
      "ملّحوا وتبّلوا في النهاية بعد التذوق: فهذه هي الطريقة الموثوقة الوحيدة لموازنة الطبق.",
      "حافظوا على نفس المقلاة ودرجة الحرارة من البداية إلى النهاية للحصول على قوام منتظم.",
      "اتركوا الطبق يرتاح 5 دقائق قبل التقديم لتستقر النكهات ويبدو التقديم أجمل.",
      "قدّموا الطبق مع خبز طازج أو طبق جانبي بسيط يمتص الصلصة جيداً.",
    ],
    faq: (title, keyword, steps) => [
      { q: `كيف أنجح في ${title} في كل مرة؟`, a: `اتبعوا الخطوات الـ${steps} بالترتيب، وقيسوا ${keyword} بالمقادير المحددة، وتذوقوا قبل التقديم. السر في الانتظام: نفس الحرارة ونفس الحركات وراحة 5 دقائق قبل وضع الطبق على المائدة.` },
      { q: `هل يمكن تحضير ${title} مسبقاً؟`, a: `نعم بلا مشكلة. اطهوا ${title} كاملة واتركوها تبرد سريعاً ثم احفظوها في الثلاجة حتى 3 أيام. أعيدوا التسخين بلطف وأضيفوا قليلاً من الماء إذا بدا القوام سميكاً.` },
      { q: "كيف أحفظ البقايا؟", a: "في علبة محكمة في الثلاجة حتى 3 أيام. أعيدوا التسخين على نار هادئة أو في فرن متوسط الحرارة، ولا تعيدوا أبداً تجميد طبق سبق إذابته لأسباب تتعلق بسلامة الغذاء." },
      { q: "بماذا أعوّض مكوناً ناقصاً؟", a: `اختاروا مكوناً قريباً في الطعم والقوام مع الحفاظ على نفس النسب. يبقى قوام ${title} ثابتاً ما دام التوازن العام محترماً: جرّبوا وتذوقوا وعدّلوا التتبيلة في النهاية.` },
    ],
    defaultMeta: (keyword) => `وصفة ${keyword} سهلة: مكونات بسيطة وخطوات واضحة ونصائح وبدائل وطريقة حفظ لنتيجة لذيذة في كل مرة.`,
    defaultSeoTitle: (title) => `${title} | وصفة سهلة خطوة بخطوة`,
  },
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

// Marqueurs remplacés au publish par les vraies images uploadées sur WordPress.
export const IMAGE_MARKER = (role: string) => `<!--JAMAKER-IMG:${role}-->`;

function countWords(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
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
  internalLinks?: InternalLink[];
}): RecipeArticle {
  const lang = langOf(input.language);
  const t = STRINGS[lang];
  const title = input.title || "Recette sans titre";
  const keyword = input.focusKeyword || title.toLowerCase();
  const ingredients = input.ingredients.length ? input.ingredients : ["Ingrédients à compléter"];
  const steps = input.steps.length ? input.steps : ["Étapes à compléter"];
  const links = (input.internalLinks || []).slice(0, 8);
  const images = buildImagePrompts(title, input.imageDirection || "", input.imagePrompts || { featured: "", hero: "", ingredients: "", serving: "" });

  const introduction = input.aiBody || t.defaultIntro(title, keyword);
  const tips = t.tips(title);
  const faq = t.faq(title, keyword, steps.length);
  const first = ingredients[0] || keyword;
  const second = ingredients[1] || keyword;
  const whyBody = t.whyBody(title, keyword, steps.length);
  const subsBody = t.subsBody(title, first, second);
  const storageBody = t.storageBody(title);

  const seoTitle = (input.seoTitle || t.defaultSeoTitle(title)).slice(0, 65);
  const metaDescription = (input.metaDescription || t.defaultMeta(keyword)).slice(0, 160);
  const seoBrief = buildSeoBrief({ title, focusKeyword: keyword, ingredients });

  const gutenberg = [
    `<!-- wp:paragraph --><p>${introduction}</p><!-- /wp:paragraph -->`,
    IMAGE_MARKER("featured"),
    `<!-- wp:heading --><h2>${t.hWhy(keyword)}</h2><!-- /wp:heading -->`,
    `<!-- wp:paragraph --><p>${whyBody}</p><!-- /wp:paragraph -->`,
    IMAGE_MARKER("ingredients"),
    `<!-- wp:heading --><h2>${t.hIngredients}</h2><!-- /wp:heading -->`,
    `<!-- wp:list --><ul>${ingredients.map((i) => `<!-- wp:list-item --><li>${i}</li><!-- /wp:list-item -->`).join("")}</ul><!-- /wp:list -->`,
    `<!-- wp:heading --><h2>${t.hInstructions} : ${title}</h2><!-- /wp:heading -->`,
    `<!-- wp:list {"ordered":true} --><ol>${steps.map((s) => `<!-- wp:list-item --><li>${s}</li><!-- /wp:list-item -->`).join("")}</ol><!-- /wp:list -->`,
    IMAGE_MARKER("hero"),
    `<!-- wp:heading --><h2>${t.hTips}</h2><!-- /wp:heading -->`,
    `<!-- wp:list --><ul>${tips.map((tip) => `<!-- wp:list-item --><li>${tip}</li><!-- /wp:list-item -->`).join("")}</ul><!-- /wp:list -->`,
    `<!-- wp:heading --><h2>${t.hSubs}</h2><!-- /wp:heading -->`,
    `<!-- wp:paragraph --><p>${subsBody}</p><!-- /wp:paragraph -->`,
    IMAGE_MARKER("serving"),
    `<!-- wp:heading --><h2>${t.hStorage}</h2><!-- /wp:heading -->`,
    `<!-- wp:paragraph --><p>${storageBody}</p><!-- /wp:paragraph -->`,
    `<!-- wp:heading --><h2>${t.hFaq}</h2><!-- /wp:heading -->`,
    ...faq.map((f) => `<!-- wp:paragraph --><p><strong>${f.q}</strong><br>${f.a}</p><!-- /wp:paragraph -->`),
    ...(links.length
      ? [
          `<!-- wp:heading --><h2>${t.hAlsoLike}</h2><!-- /wp:heading -->`,
          `<!-- wp:list --><ul>${links.map((l) => `<!-- wp:list-item --><li><a href="${l.url}">${l.label}</a></li><!-- /wp:list-item -->`).join("")}</ul><!-- /wp:list -->`,
        ]
      : []),
    `<!-- wp:shortcode -->[wprm-recipe id="auto"]<!-- /wp:shortcode -->`,
  ].join("\n");

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: title,
    description: metaDescription,
    image: seoBrief.imageSeo.map((image) => image.fileName),
    author: input.authorName ? { "@type": "Person", name: input.authorName } : { "@type": "Organization", name: "JA MAKER" },
    recipeYield: "4 servings",
    keywords: [keyword, ...seoBrief.secondaryKeywords].join(", "),
    recipeIngredient: ingredients,
    recipeInstructions: steps.map((text, i) => ({ "@type": "HowToStep", position: i + 1, text })),
  };

  const wordCount =
    countWords(introduction) + countWords(whyBody) + countWords(subsBody) + countWords(storageBody) +
    ingredients.reduce((n, i) => n + countWords(i), 0) + steps.reduce((n, s) => n + countWords(s), 0) +
    tips.reduce((n, x) => n + countWords(x), 0) + faq.reduce((n, f) => n + countWords(f.q) + countWords(f.a), 0);

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
    internalLinksCount: links.length,
    wordCount,
  });

  const wprm = {
    name: title,
    summary: metaDescription,
    description: introduction.slice(0, 2000),
    servings: "4",
    servings_unit: "servings",
    prep_time: 15,
    cook_time: 30,
    ingredients_flat: ingredients,
    ingredients: ingredients.map((name) => ({ amount: "", unit: "", name, notes: "" })),
    instructions_flat: steps,
    instructions: steps.map((text) => ({ text })),
    notes: tips.join("\n"),
  };

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
    internalLinks: links,
    wordCount,
    imagePrompts: images,
    stockPhotos: [],
    gutenberg,
    schema,
    wprm,
    seoBrief,
    seoAudit,
  };
}
