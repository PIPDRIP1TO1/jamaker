import { getDb } from "@/lib/db";
import { readConnectionSecret } from "@/lib/vault";

export type WordPressCredentials = { siteUrl: string; username: string; appPassword: string };

export function normalizeSiteUrl(raw: string) {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!/^https?:\/\/[^/]+\.[^/]+/.test(trimmed)) return null;
  return trimmed;
}

export async function getWordPressConnection(organizationId: string) {
  const db = await getDb();
  const result = await db.query<{ id: string; external_account_label: string | null }>(
    "SELECT id, external_account_label FROM integration_connections WHERE organization_id = $1 AND provider = 'wordpress' AND status = 'connected' LIMIT 1",
    [organizationId],
  );
  return result.rows[0] || null;
}

export async function getWordPressCredentials(organizationId: string, connectionId: string): Promise<WordPressCredentials | null> {
  const raw = await readConnectionSecret(organizationId, connectionId);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<WordPressCredentials>;
    if (!parsed.siteUrl || !parsed.username || !parsed.appPassword) return null;
    const siteUrl = normalizeSiteUrl(parsed.siteUrl);
    if (!siteUrl) return null;
    return { siteUrl, username: parsed.username, appPassword: parsed.appPassword };
  } catch {
    // Ancienne clé unique : incompatible avec WordPress, à reconnecter.
    return null;
  }
}

export type PublishResult = { ok: true; postId: number; link: string } | { ok: false; message: string };

export async function publishWordPressDraft(
  creds: WordPressCredentials,
  input: { title: string; content: string; excerpt?: string; categories?: number[]; featuredMediaId?: number },
): Promise<PublishResult> {
  const auth = Buffer.from(`${creds.username}:${creds.appPassword}`).toString("base64");
  let response: Response;
  try {
    response = await fetch(`${creds.siteUrl}/wp-json/wp/v2/posts`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: input.title,
        content: input.content,
        excerpt: input.excerpt || "",
        status: "draft",
        categories: input.categories || [],
        ...(input.featuredMediaId ? { featured_media: input.featuredMediaId } : {}),
      }),
    });
  } catch {
    return { ok: false, message: "Site injoignable. Vérifiez l'URL et le HTTPS." };
  }
  if (response.status === 401 || response.status === 403) {
    return { ok: false, message: "Refusé par WordPress : vérifiez l'utilisateur et le mot de passe d'application." };
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return { ok: false, message: `WordPress a répondu ${response.status}. ${text.slice(0, 120)}` };
  }
  const post = (await response.json()) as { id?: number; link?: string };
  if (!post.id) return { ok: false, message: "Réponse WordPress inattendue." };
  return { ok: true, postId: post.id, link: post.link || `${creds.siteUrl}/?p=${post.id}` };
}

export async function listWordPressCategories(creds: WordPressCredentials) {
  const auth = Buffer.from(`${creds.username}:${creds.appPassword}`).toString("base64");
  const response = await fetch(`${creds.siteUrl}/wp-json/wp/v2/categories?per_page=100`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!response.ok) return null;
  const cats = (await response.json()) as Array<{ id: number; name: string; count: number }>;
  return cats.map((c) => ({ id: c.id, name: c.name, count: c.count }));
}

// --- Publication recette complète : 4 images + carte WP Recipe Maker ---

export type RecipePublishImage = { role: string; dataUrl: string };

function parseDataUrl(dataUrl: string): { buffer: Buffer; mime: string } | null {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec((dataUrl || "").trim());
  if (!match) return null;
  try {
    return { buffer: Buffer.from(match[2], "base64"), mime: match[1] === "image/jpg" ? "image/jpeg" : match[1] };
  } catch {
    return null;
  }
}

async function uploadMedia(creds: WordPressCredentials, auth: string, buffer: Buffer, fileName: string, mime: string, alt: string): Promise<{ id: number; url: string } | null> {
  try {
    if (buffer.length > 8 * 1024 * 1024) return null;
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mime }), fileName);
    const response = await fetch(`${creds.siteUrl}/wp-json/wp/v2/media`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Disposition": `attachment; filename="${fileName}"` },
      body: form,
    });
    if (!response.ok) return null;
    const media = (await response.json()) as { id?: number; source_url?: string };
    if (!media.id || !media.source_url) return null;
    // Texte alternatif SEO (best-effort).
    await fetch(`${creds.siteUrl}/wp-json/wp/v2/media/${media.id}`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ alt_text: alt }),
    }).catch(() => null);
    return { id: media.id, url: media.source_url };
  } catch {
    return null;
  }
}

// Crée la carte recette via l'API WP Recipe Maker (best-effort : 2 routes connues).
// Retourne l'id recette, ou null si le plugin est absent/incompatible.
async function createWprmRecipe(creds: WordPressCredentials, auth: string, payload: Record<string, unknown>): Promise<number | null> {
  const attempts = [
    { route: "/wp-json/wp-recipe-maker/v1/recipes", body: payload },
    { route: "/wp-json/wp/v2/wprm_recipe", body: { title: String(payload.name || "Recette"), content: String(payload.summary || ""), status: "publish", meta: payload } },
  ];
  for (const attempt of attempts) {
    try {
      const response = await fetch(`${creds.siteUrl}${attempt.route}`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify(attempt.body),
      });
      if (!response.ok) continue;
      const data = (await response.json()) as { id?: number; recipe_id?: number; data?: { id?: number } };
      const id = data.id || data.recipe_id || data.data?.id;
      if (typeof id === "number" && id > 0) return id;
    } catch {
      // route suivante
    }
  }
  return null;
}

export type RecipePublishReport = PublishResult & { imagesUploaded: number; imagesTotal: number; wprmId: number | null };

export async function publishRecipeComplete(
  creds: WordPressCredentials,
  article: { title: string; metaDescription: string; gutenberg: string; wprm: Record<string, unknown>; seoBrief: { imageSeo: Array<{ role: string; fileName: string; altText: string }> } },
  images: RecipePublishImage[],
): Promise<RecipePublishReport> {
  const auth = Buffer.from(`${creds.username}:${creds.appPassword}`).toString("base64");
  let content = article.gutenberg;
  let uploaded = 0;
  let featuredMediaId: number | undefined;
  const byRole = new Map(images.map((img) => [img.role, img.dataUrl]));

  for (const seo of article.seoBrief.imageSeo) {
    const marker = `<!--JAMAKER-IMG:${seo.role}-->`;
    if (!content.includes(marker)) continue;
    const parsed = byRole.has(seo.role) ? parseDataUrl(byRole.get(seo.role) || "") : null;
    if (!parsed) {
      content = content.replace(marker, "");
      continue;
    }
    const media = await uploadMedia(creds, auth, parsed.buffer, seo.fileName, parsed.mime, seo.altText);
    if (!media) {
      content = content.replace(marker, "");
      continue;
    }
    uploaded += 1;
    if (seo.role === "featured" || (featuredMediaId === undefined && seo.role === "hero")) featuredMediaId = media.id;
    const alt = seo.altText.replace(/"/g, "");
    content = content.replace(
      marker,
      `<!-- wp:image {"alt":"${alt}"} --><figure class="wp-block-image"><img src="${media.url}" alt="${alt}"/></figure><!-- /wp:image -->`,
    );
  }

  // Carte WP Recipe Maker : remplace le shortcode provisoire par le vrai id.
  let wprmId: number | null = null;
  try {
    wprmId = await createWprmRecipe(creds, auth, article.wprm);
  } catch {
    wprmId = null;
  }
  if (wprmId) {
    content = content.replace('[wprm-recipe id="auto"]', `[wprm-recipe id="${wprmId}"]`);
  }

  const post = await publishWordPressDraft(creds, { title: article.title, content, excerpt: article.metaDescription, featuredMediaId });
  if (!post.ok) return { ...post, imagesUploaded: uploaded, imagesTotal: article.seoBrief.imageSeo.length, wprmId };
  return { ...post, imagesUploaded: uploaded, imagesTotal: article.seoBrief.imageSeo.length, wprmId };
}
