import { getDb } from "@/lib/db";
import type { EbookProject } from "@/lib/ebook-types";

type EbookRow = { id: string; title: string; content_json: string; created_at: string; updated_at: string };

function parseRow(row: EbookRow): EbookProject | null {
  try {
    const value = JSON.parse(row.content_json) as EbookProject;
    return { ...value, id: row.id, title: row.title, createdAt: value.createdAt || row.created_at, updatedAt: row.updated_at };
  } catch {
    return null;
  }
}

export function sanitizeEbookProject(raw: unknown): EbookProject {
  const input = (raw && typeof raw === "object" ? raw : {}) as Partial<EbookProject>;
  const cleanText = (value: unknown, max: number) => String(value || "").trim().slice(0, max);
  const recipes = Array.isArray(input.recipes) ? input.recipes.slice(0, 500).map((recipe, index) => ({
    id: cleanText(recipe?.id, 100) || `recipe-${index + 1}`,
    url: cleanText(recipe?.url, 2000),
    title: cleanText(recipe?.title, 180) || `Recipe ${index + 1}`,
    category: cleanText(recipe?.category, 100) || "Recipes",
    prepTime: cleanText(recipe?.prepTime, 40) || "15 mins",
    cookTime: cleanText(recipe?.cookTime, 40) || "25 mins",
    servings: cleanText(recipe?.servings, 40) || "4 servings",
    ingredients: Array.isArray(recipe?.ingredients) ? recipe.ingredients.slice(0, 100).map((item) => ({ item: cleanText(item?.item, 180), amount: cleanText(item?.amount, 80) })).filter((item) => item.item) : [],
    steps: Array.isArray(recipe?.steps) ? recipe.steps.slice(0, 60).map((step) => cleanText(step, 1000)).filter(Boolean) : [],
    tips: cleanText(recipe?.tips, 1500),
    imageUrl: cleanText(recipe?.imageUrl, 4000),
    imageSource: recipe?.imageSource === "original" || recipe?.imageSource === "custom" ? recipe.imageSource : "ai" as const,
    status: recipe?.status === "generated" || recipe?.status === "edited" ? recipe.status : "imported" as const,
  })) : [];
  const now = new Date().toISOString();
  return {
    id: cleanText(input.id, 100) || crypto.randomUUID(),
    title: cleanText(input.title, 180) || "Untitled Cookbook",
    subtitle: cleanText(input.subtitle, 300),
    author: cleanText(input.author, 120),
    brandName: cleanText(input.brandName, 120),
    language: input.language === "fr" ? "fr" : "en",
    theme: ["gourmet", "minimal", "rustic", "vibrant"].includes(String(input.theme)) ? input.theme! : "gourmet",
    accentColor: /^#[0-9a-f]{6}$/i.test(String(input.accentColor)) ? String(input.accentColor) : "#c2410c",
    coverImage: cleanText(input.coverImage, 4000),
    backCoverImage: cleanText(input.backCoverImage, 4000),
    useCustomFrontCover: Boolean(input.useCustomFrontCover),
    useCustomBackCover: Boolean(input.useCustomBackCover),
    introTitle: cleanText(input.introTitle, 180),
    introText: cleanText(input.introText, 10000),
    backCoverText: cleanText(input.backCoverText, 5000),
    backCoverAuthorBio: cleanText(input.backCoverAuthorBio, 5000),
    socialLinks: {
      website: cleanText(input.socialLinks?.website, 1000),
      instagram: cleanText(input.socialLinks?.instagram, 200),
      store: cleanText(input.socialLinks?.store, 1000),
    },
    recipes,
    selectedCategories: Array.isArray(input.selectedCategories) ? input.selectedCategories.slice(0, 100).map((item) => cleanText(item, 100)).filter(Boolean) : undefined,
    createdAt: cleanText(input.createdAt, 50) || now,
    updatedAt: now,
  };
}

export async function listEbookProjects(organizationId: string) {
  const db = await getDb();
  const result = await db.query<EbookRow>("SELECT id, title, content_json, created_at, updated_at FROM ebook_projects WHERE organization_id = $1 ORDER BY datetime(updated_at) DESC", [organizationId]);
  return result.rows.map(parseRow).filter((item): item is EbookProject => Boolean(item));
}

export async function getEbookProject(organizationId: string, id: string) {
  const db = await getDb();
  const result = await db.query<EbookRow>("SELECT id, title, content_json, created_at, updated_at FROM ebook_projects WHERE id = $1 AND organization_id = $2 LIMIT 1", [id, organizationId]);
  return result.rows[0] ? parseRow(result.rows[0]) : null;
}

export async function saveEbookProject(organizationId: string, raw: unknown) {
  const project = sanitizeEbookProject(raw);
  const db = await getDb();
  await db.query(
    `INSERT INTO ebook_projects (id, organization_id, title, content_json)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, content_json = excluded.content_json, updated_at = CURRENT_TIMESTAMP
     WHERE ebook_projects.organization_id = excluded.organization_id`,
    [project.id, organizationId, project.title, JSON.stringify(project)],
  );
  return project;
}

export async function deleteEbookProject(organizationId: string, id: string) {
  const db = await getDb();
  return db.query("DELETE FROM ebook_projects WHERE id = $1 AND organization_id = $2", [id, organizationId]);
}
