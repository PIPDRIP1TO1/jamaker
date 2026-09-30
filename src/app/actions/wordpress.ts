"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { getWordPressConnection, getWordPressCredentials, publishWordPressDraft } from "@/lib/wordpress";
import { logAudit } from "@/lib/audit";

export type WpState = { message?: string; link?: string };

export async function publishWordPressPostAction(_state: WpState, formData: FormData): Promise<WpState> {
  const session = await requireSession();
  const title = String(formData.get("title") || "").trim().slice(0, 200);
  const content = String(formData.get("content") || "").trim().slice(0, 100000);
  const categoryId = Number(formData.get("categoryId") || 0) || undefined;
  if (title.length < 3) return { message: "Titre trop court." };
  if (content.length < 20) return { message: "Contenu trop court (20 caractères minimum)." };
  const connection = await getWordPressConnection(session.organization.id);
  if (!connection) return { message: "Connectez WordPress dans Mes connexions." };
  const creds = await getWordPressCredentials(session.organization.id, connection.id);
  if (!creds) return { message: "Connexion WordPress invalide : reconnectez-la." };
  const result = await publishWordPressDraft(creds, { title, content, categories: categoryId ? [categoryId] : [] });
  if (!result.ok) return { message: result.message };
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "wordpress.publish", entityType: "post", entityId: String(result.postId) });
  revalidatePath("/dashboard/tools/wordpress-category");
  return { message: `Brouillon WordPress créé (post #${result.postId}).`, link: result.link };
}

export async function createWordPressCategoryAction(_state: WpState, formData: FormData): Promise<WpState> {
  const session = await requireSession();
  const name = String(formData.get("name") || "").trim().slice(0, 100);
  const slug = String(formData.get("slug") || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
  if (name.length < 2) return { message: "Nom trop court." };
  const connection = await getWordPressConnection(session.organization.id);
  if (!connection) return { message: "Connectez WordPress dans Mes connexions." };
  const creds = await getWordPressCredentials(session.organization.id, connection.id);
  if (!creds) return { message: "Connexion WordPress invalide : reconnectez-la." };
  const auth = Buffer.from(`${creds.username}:${creds.appPassword}`).toString("base64");
  let response: Response;
  try {
    response = await fetch(`${creds.siteUrl}/wp-json/wp/v2/categories`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug: slug || undefined }),
    });
  } catch {
    return { message: "Site injoignable." };
  }
  if (!response.ok) return { message: `WordPress a répondu ${response.status}.` };
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "wordpress.category.create", entityType: "category", entityId: name });
  revalidatePath("/dashboard/tools/wordpress-category");
  return { message: `Catégorie « ${name} » créée.` };
}
