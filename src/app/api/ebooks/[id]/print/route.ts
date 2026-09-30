import { requireSession } from "@/lib/auth/session";
import { getEbookProject } from "@/lib/ebooks";
import { renderEbookHTML } from "@/lib/ebook-template";
import type { EbookProject } from "@/lib/ebook-types";

function escapeHtml(value: unknown) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}

function safeImageUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (raw.startsWith("/ebook-uploads/")) return raw.replace(/["'()\\]/g, "");
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) ? url.toString().replace(/["'()\\]/g, "") : "";
  } catch { return ""; }
}

function sanitizeForPrint(project: EbookProject): EbookProject {
  return {
    ...project,
    title: escapeHtml(project.title), subtitle: escapeHtml(project.subtitle), author: escapeHtml(project.author), brandName: escapeHtml(project.brandName),
    coverImage: safeImageUrl(project.coverImage), backCoverImage: safeImageUrl(project.backCoverImage),
    introTitle: escapeHtml(project.introTitle), introText: escapeHtml(project.introText), backCoverText: escapeHtml(project.backCoverText), backCoverAuthorBio: escapeHtml(project.backCoverAuthorBio),
    socialLinks: { website: escapeHtml(project.socialLinks?.website), instagram: escapeHtml(project.socialLinks?.instagram), store: escapeHtml(project.socialLinks?.store) },
    recipes: project.recipes.map((recipe) => ({
      ...recipe, title: escapeHtml(recipe.title), category: escapeHtml(recipe.category), prepTime: escapeHtml(recipe.prepTime), cookTime: escapeHtml(recipe.cookTime), servings: escapeHtml(recipe.servings),
      ingredients: recipe.ingredients.map((item) => ({ item: escapeHtml(item.item), amount: escapeHtml(item.amount) })),
      steps: recipe.steps.map(escapeHtml), tips: escapeHtml(recipe.tips), imageUrl: safeImageUrl(recipe.imageUrl),
    })),
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const project = await getEbookProject(session.organization.id, id);
  if (!project) return new Response("Ebook introuvable", { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  const filename = project.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "cookbook";
  const autoPrint = new URL(request.url).searchParams.get("print") === "1";
  let html = renderEbookHTML(sanitizeForPrint(project));
  if (autoPrint) html = html.replace("</body>", '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),250));<\/script></body>');
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...(download ? { "Content-Disposition": `attachment; filename="${filename}.html"` } : {}),
      "Cache-Control": "private, no-store",
    },
  });
}
