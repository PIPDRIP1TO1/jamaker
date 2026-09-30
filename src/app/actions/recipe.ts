"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { buildRecipeArticle, isImageOnlyBrief, parseRecipeBrief } from "@/lib/recipe";
import { getWordPressConnection, getWordPressCredentials, publishWordPressDraft } from "@/lib/wordpress";
import { enqueueProjectWorkerJob } from "@/lib/automation-engine";

export type RecipeState = { message?: string; aiUsed?: boolean };

async function saveRecipeOutput(organizationId: string, userId: string, projectId: string, article: ReturnType<typeof buildRecipeArticle>, aiUsed: boolean, inputs: Record<string, unknown>) {
  const db = await getDb();
  const id = randomUUID();
  await db.query(
    `INSERT INTO module_outputs (id, project_id, organization_id, output_type, status, title, content_json)
     VALUES ($1, $2, $3, 'recipe_draft', 'ready', $4, $5)`,
    [id, projectId, organizationId, `Brouillon recette — ${article.title}`.slice(0, 120), JSON.stringify({ ...article, meta: { aiUsed, inputs } })],
  );
  await db.query("UPDATE module_projects SET status = 'ready', config_json = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND organization_id = $3", [JSON.stringify({ version: 2, kind: "project", steps: [{ id: "step-1", label: "Brief SEO", enabled: true }, { id: "step-2", label: "Article optimisé", enabled: true }, { id: "step-3", label: "Audit SEO + E-E-A-T", enabled: true }, { id: "step-4", label: "Recipe Schema", enabled: true }, { id: "step-5", label: "Validation humaine", enabled: true }, { id: "step-6", label: "Brouillon WordPress", enabled: true }], inputs, externalAccounts: [], localPaths: [] }), projectId, organizationId]);
  await logAudit({ organizationId, userId, action: aiUsed ? "recipe.generate.ai" : "recipe.generate.local", entityType: "recipe-creator", entityId: projectId });
  return id;
}

export async function generateRecipeAction(_state: RecipeState, formData: FormData): Promise<RecipeState> {
  const session = await requireSession();
  const projectId = String(formData.get("projectId") || "");
  if (!projectId) return { message: "Projet introuvable." };
  const db = await getDb();
  const proj = await db.query<{ id: string; is_example: number }>("SELECT id, is_example FROM module_projects WHERE id = $1 AND organization_id = $2 AND module_slug = 'recipe-creator' LIMIT 1", [projectId, session.organization.id]);
  if (!proj.rows[0]) return { message: "Projet introuvable." };
  if (proj.rows[0].is_example) return { message: "Dupliquez l'exemple avant de générer." };

  const briefRaw = String(formData.get("brief") || "");
  const detected = parseRecipeBrief(briefRaw);
  const title = String(formData.get("recipeTitle") || "").trim() || detected.title;
  const ingredients = String(formData.get("ingredients") || "").trim() ? String(formData.get("ingredients")).split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : detected.ingredients;
  const steps = String(formData.get("steps") || "").trim() ? String(formData.get("steps")).split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : detected.steps;
  const focusKeywordRaw = String(formData.get("focusKeyword") || "").trim() || detected.focusKeyword;
  // Mot-clé auto-optimisé façon Rank Math : minuscules, sans ponctuation, espaces simples.
  const focusKeyword = focusKeywordRaw.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || title.toLowerCase();
  const language = String(formData.get("language") || "en");
  const metaDescription = String(formData.get("metaDescription") || "").trim();
  let imageDirection = String(formData.get("imageDirection") || "").trim();
  // Brief image seul : tout le texte devient direction visuelle.
  if (!imageDirection && isImageOnlyBrief(briefRaw)) imageDirection = briefRaw.trim().slice(0, 2000);
  const seoTitle = String(formData.get("seoTitle") || "").trim().slice(0, 65);
  const authorName = String(formData.get("authorName") || "").trim().slice(0, 80);
  const duplicatePolicy = String(formData.get("duplicatePolicy") || "ask");
  const duplicatePolicyValue = duplicatePolicy === "force_new" || duplicatePolicy === "update_existing" ? duplicatePolicy : "ask";
  // Prompts images éditables : le formulaire prime, sinon détection du brief.
  const imagePrompts = {
    featured: String(formData.get("promptFeatured") || "").trim() || detected.imagePrompts.featured,
    hero: String(formData.get("promptHero") || "").trim() || detected.imagePrompts.hero,
    ingredients: String(formData.get("promptIngredients") || "").trim() || detected.imagePrompts.ingredients,
    serving: String(formData.get("promptServing") || "").trim() || detected.imagePrompts.serving,
  };

  if (title.length < 3) return { message: "Titre trop court." };
  if (!ingredients.length && !steps.length && !isImageOnlyBrief(briefRaw)) return { message: "Collez ingrédients + étapes (ou un brief complet) avant de générer." };

  // Moteur local, gratuit : aucune clé API. L'IA via comptes navigateur
  // (ChatGPT, Gemini web…) arrivera avec les adapters du worker local.
  let aiBody: string | null = null;
  const aiUsed = false;

  const article = buildRecipeArticle({ title, ingredients, steps, focusKeyword, language, metaDescription, imageDirection, imagePrompts, aiBody, seoTitle: seoTitle || undefined, authorName });
  // Photos pro Pexels si clé connectée (gratuit, fiable). Best-effort, jamais bloquant.
  try {
    const { getPexelsKey, fetchStockPhotos } = await import("@/lib/pexels");
    const pexelsKey = await getPexelsKey(session.organization.id);
    if (pexelsKey) article.stockPhotos = await fetchStockPhotos(pexelsKey, title);
  } catch {
    // ignore
  }
  await saveRecipeOutput(session.organization.id, session.user.id, projectId, article, aiUsed, { recipeTitle: title, ingredients: ingredients.join("\n"), steps: steps.join("\n"), focusKeyword, language, metaDescription, imageDirection, seoTitle, authorName, duplicatePolicy: duplicatePolicyValue, promptFeatured: imagePrompts.featured.slice(0, 1500), promptHero: imagePrompts.hero.slice(0, 1500), promptIngredients: imagePrompts.ingredients.slice(0, 1500), promptServing: imagePrompts.serving.slice(0, 1500), brief: briefRaw.slice(0, 8000) });
  revalidatePath(`/dashboard/tools/recipe-creator/projects/${projectId}`);
  return { message: "Brouillon généré en local (gratuit). L'IA via vos comptes navigateur arrivera avec les adapters du worker.", aiUsed };
}

export async function reviseRecipeAction(_state: RecipeState, formData: FormData): Promise<RecipeState> {
  const session = await requireSession();
  const projectId = String(formData.get("projectId") || "");
  const outputId = String(formData.get("outputId") || "");
  const instruction = String(formData.get("instruction") || "").trim().slice(0, 2000);
  if (!projectId || !outputId || instruction.length < 4) return { message: "Instruction trop courte." };
  const db = await getDb();
  const current = await db.query<{ content_json: string }>("SELECT content_json FROM module_outputs WHERE id = $1 AND project_id = $2 AND organization_id = $3 LIMIT 1", [outputId, projectId, session.organization.id]);
  if (!current.rows[0]) return { message: "Brouillon introuvable." };
  let article: ReturnType<typeof buildRecipeArticle>;
  try {
    article = JSON.parse(current.rows[0].content_json) as ReturnType<typeof buildRecipeArticle>;
  } catch {
    return { message: "Brouillon illisible." };
  }

  const aiUsed = false;
  // Révision locale traçable : ajoute la consigne dans l'intro (nouvelle version).
  const revisedIntroduction = `${article.introduction}\n\n[Révision demandée : ${instruction}]`;
  // Reconstruit Schema + audit après chaque révision pour ne jamais afficher un score périmé.
  article = buildRecipeArticle({
    title: article.title,
    ingredients: article.ingredients,
    steps: article.instructions,
    focusKeyword: article.focusKeyword,
    metaDescription: article.metaDescription,
    imagePrompts: article.imagePrompts,
    aiBody: revisedIntroduction,
  });
  await saveRecipeOutput(session.organization.id, session.user.id, projectId, article, aiUsed, { revisionOf: outputId, instruction });
  revalidatePath(`/dashboard/tools/recipe-creator/projects/${projectId}`);
  return { message: "Révision enregistrée en local (nouvelle version).", aiUsed };
}

export async function sendRecipeImagesToWorkerAction(_state: RecipeState, formData: FormData): Promise<RecipeState> {
  const session = await requireSession();
  const projectId = String(formData.get("projectId") || "");
  const outputId = String(formData.get("outputId") || "");
  const browserProfile = String(formData.get("browserProfile") || "").trim().slice(0, 80) || "Profil principal";
  if (!projectId || !outputId) return { message: "Brouillon introuvable." };
  const db = await getDb();
  const current = await db.query<{ content_json: string; config_json: string }>(
    `SELECT o.content_json, p.config_json FROM module_outputs o
     JOIN module_projects p ON p.id = o.project_id
     WHERE o.id = $1 AND o.project_id = $2 AND o.organization_id = $3 AND p.is_example = 0 LIMIT 1`,
    [outputId, projectId, session.organization.id],
  );
  const row = current.rows[0];
  if (!row) return { message: "Brouillon introuvable." };
  let article: { imagePrompts?: { featured?: string; hero?: string; ingredients?: string; serving?: string }; title?: string };
  try {
    article = JSON.parse(row.content_json);
  } catch {
    return { message: "Brouillon illisible." };
  }
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(row.config_json || "{}");
  } catch {
    config = {};
  }
  config.inputs = {
    ...((config.inputs || {}) as Record<string, unknown>),
    workerAdapter: "gemini-images",
    browserProfile,
    imagePrompts: article.imagePrompts || {},
    recipeTitle: article.title || "",
  };
  await db.query("UPDATE module_projects SET config_json = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND organization_id = $3", [JSON.stringify(config), projectId, session.organization.id]);
  await enqueueProjectWorkerJob(session.organization.id, projectId, "Images Gemini demandées au worker local.");
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "recipe.images.worker", entityType: "recipe-creator", entityId: projectId });
  revalidatePath(`/dashboard/tools/recipe-creator/projects/${projectId}`);
  revalidatePath("/dashboard/automations");
  return { message: "4 images demandées au worker (Gemini web). Démarrez le worker sur votre PC." };
}

export type PublishState = { message?: string; link?: string };

export async function publishRecipeToWordPressAction(_state: PublishState, formData: FormData): Promise<PublishState> {
  const session = await requireSession();
  const projectId = String(formData.get("projectId") || "");
  const outputId = String(formData.get("outputId") || "");
  if (formData.get("approved") !== "1") return { message: "Validez le texte ET les images avant de publier." };
  if (!projectId || !outputId) return { message: "Brouillon introuvable." };
  const connection = await getWordPressConnection(session.organization.id);
  if (!connection) return { message: "Connectez WordPress dans Mes connexions avant de publier." };
  const creds = await getWordPressCredentials(session.organization.id, connection.id);
  if (!creds) return { message: "Connexion WordPress invalide : reconnectez-la." };
  const db = await getDb();
  const current = await db.query<{ content_json: string }>("SELECT content_json FROM module_outputs WHERE id = $1 AND project_id = $2 AND organization_id = $3 LIMIT 1", [outputId, projectId, session.organization.id]);
  if (!current.rows[0]) return { message: "Brouillon introuvable." };
  let article: ReturnType<typeof buildRecipeArticle>;
  try {
    article = JSON.parse(current.rows[0].content_json) as ReturnType<typeof buildRecipeArticle>;
  } catch {
    return { message: "Brouillon illisible." };
  }
  if (!article.seoAudit?.publishReady) return { message: "Publication bloquée : corrigez les erreurs critiques indiquées dans l’audit SEO puis générez une nouvelle version." };
  const result = await publishWordPressDraft(creds, {
    title: article.title,
    content: article.gutenberg,
    excerpt: article.metaDescription,
  });
  if (!result.ok) return { message: result.message };
  await db.query("UPDATE module_projects SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND organization_id = $2", [projectId, session.organization.id]);
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "recipe.publish.wordpress", entityType: "recipe-creator", entityId: projectId, metadata: { postId: result.postId } });
  revalidatePath(`/dashboard/tools/recipe-creator/projects/${projectId}`);
  return { message: `Brouillon WordPress créé (post #${result.postId}). Publiez-le depuis WP après relecture.`, link: result.link };
}
