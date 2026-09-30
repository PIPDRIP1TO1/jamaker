import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { fetchPublicText } from "@/lib/public-url";

type SitemapItem = { url: string; title: string; category: string };

function extractLocations(xml: string) {
  return [...xml.matchAll(/<loc(?:\s[^>]*)?>([\s\S]*?)<\/loc>/gi)]
    .map((match) => match[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").trim())
    .filter(Boolean);
}

function toItem(raw: string): SitemapItem | null {
  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    const slug = parts.at(-1)?.replace(/\.[a-z0-9]+$/i, "") || "recipe";
    const title = decodeURIComponent(slug).replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
    const categoryRaw = parts.length > 1 ? parts[parts.length - 2] : "Recipes";
    const category = decodeURIComponent(categoryRaw).replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
    return { url: url.toString(), title, category };
  } catch { return null; }
}

export async function POST(request: Request) {
  await requireSession();
  try {
    const body = (await request.json()) as { url?: string };
    if (!body.url) throw new Error("URL du sitemap requise.");
    const xml = await fetchPublicText(body.url);
    let locations = extractLocations(xml);
    if (/<sitemapindex\b/i.test(xml)) {
      const nested = await Promise.all(locations.slice(0, 5).map(async (url) => extractLocations(await fetchPublicText(url))));
      locations = nested.flat();
    }
    const seen = new Set<string>();
    const items = locations.map(toItem).filter((item): item is SitemapItem => Boolean(item)).filter((item) => !seen.has(item.url) && seen.add(item.url)).slice(0, 300);
    return NextResponse.json({ success: true, items });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Analyse impossible." }, { status: 400 });
  }
}
