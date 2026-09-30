import { getCurrentSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return Response.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const db = await getDb();
  const result = await db.query<{ title: string; content_json: string; created_at: string }>("SELECT title, content_json, created_at FROM module_outputs WHERE id = $1 AND organization_id = $2 LIMIT 1", [id, session.organization.id]);
  const output = result.rows[0];
  if (!output) return Response.json({ error: "Résultat introuvable" }, { status: 404 });
  let content: unknown = output.content_json;
  try { content = JSON.parse(output.content_json); } catch {}
  const safeTitle = output.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "resultat";
  return new Response(JSON.stringify({ title: output.title, createdAt: output.created_at, content }, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${safeTitle}.json"`, "Cache-Control": "no-store" } });
}
