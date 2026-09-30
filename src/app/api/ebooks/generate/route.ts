import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { buildRecipeArticle, parseRecipeBrief } from "@/lib/recipe";

export async function POST(request: Request) {
  const session = await requireSession();
  try {
    const body = (await request.json()) as { title?: string; category?: string; language?: string };
    const title = String(body.title || "").trim().slice(0, 180);
    const category = String(body.category || "Recipes").trim().slice(0, 100);
    const language = body.language === "fr" ? "French" : "English";
    if (title.length < 3) throw new Error("Titre de recette requis.");
    // Moteur local gratuit (aucune clé API) : l'IA via comptes navigateur
    // arrivera avec les adapters du worker. Le brief peut être collé tel quel.
    const brief = parseRecipeBrief(title);
    const article = buildRecipeArticle({
      title: brief.title !== "Recette sans titre" ? brief.title : title,
      ingredients: brief.ingredients,
      steps: brief.steps,
      focusKeyword: title.toLowerCase(),
      language: body.language === "fr" ? "fr" : "en",
      imagePrompts: brief.imagePrompts,
      aiBody: null,
    });
    return NextResponse.json({
      success: true,
      local: true,
      recipe: {
        title: article.title.slice(0, 180),
        category: category.slice(0, 100),
        prepTime: "15 mins",
        cookTime: "25 mins",
        servings: "4 servings",
        ingredients: article.ingredients.map((item) => ({ item, amount: "" })),
        steps: article.instructions,
        tips: article.tips.join(" "),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Génération impossible." }, { status: 400 });
  }
}
