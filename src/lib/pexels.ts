import { getDb } from "@/lib/db";
import { readConnectionSecret } from "@/lib/vault";

export type StockPhoto = { url: string; alt: string; photographer: string };

export async function getPexelsKey(organizationId: string): Promise<string | null> {
  const db = await getDb();
  const conns = await db.query<{ id: string }>(
    `SELECT id FROM integration_connections WHERE organization_id = $1 AND provider = 'pexels' AND status = 'connected' LIMIT 1`,
    [organizationId],
  );
  const conn = conns.rows[0];
  if (!conn) return null;
  try {
    const secret = await readConnectionSecret(organizationId, conn.id);
    return secret && secret.length >= 8 ? secret : null;
  } catch {
    return null;
  }
}

async function searchOne(apiKey: string, query: string, orientation: "landscape" | "portrait"): Promise<StockPhoto | null> {
  try {
    const params = new URLSearchParams({ query, per_page: "2", orientation, size: "large" });
    const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { photos?: Array<{ src?: { large2x?: string; large?: string }; alt?: string; photographer?: string }> };
    const photo = data.photos?.[0];
    const url = photo?.src?.large2x || photo?.src?.large;
    if (!url) return null;
    return { url, alt: photo?.alt || query, photographer: photo?.photographer || "Pexels" };
  } catch {
    return null;
  }
}

// 4 photos pro déterministes (même requête → même résultat) : fiable, gratuit.
export async function fetchStockPhotos(apiKey: string, title: string): Promise<StockPhoto[]> {
  const queries: Array<[string, "landscape" | "portrait"]> = [
    [`${title} food`, "landscape"],
    [`${title} close up`, "portrait"],
    ["cooking ingredients", "portrait"],
    [`${title} serving`, "portrait"],
  ];
  const results = await Promise.all(queries.map(([q, o]) => searchOne(apiKey, q, o)));
  return results.filter((r): r is StockPhoto => Boolean(r));
}
