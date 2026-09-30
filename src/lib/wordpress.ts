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
  input: { title: string; content: string; excerpt?: string; categories?: number[] },
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
