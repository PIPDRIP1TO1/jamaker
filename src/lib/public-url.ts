import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

function isPrivateAddress(address: string) {
  const value = address.toLowerCase();
  if (value === "::1" || value === "0:0:0:0:0:0:0:1" || value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return true;
  if (!value.includes(".")) return false;
  const [a, b] = value.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export async function assertPublicHttpUrl(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("URL invalide."); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Seules les URL HTTP/HTTPS sont acceptées.");
  if (url.username || url.password) throw new Error("Les identifiants dans l’URL ne sont pas acceptés.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Adresse locale refusée.");
  if (isIP(host) && isPrivateAddress(host)) throw new Error("Adresse privée refusée.");
  const resolved = await lookup(host, { all: true });
  if (!resolved.length || resolved.some((entry) => isPrivateAddress(entry.address))) throw new Error("Cette adresse ne peut pas être contactée.");
  return url;
}

export async function fetchPublicText(raw: string, timeoutMs = 12000) {
  const url = await assertPublicHttpUrl(raw);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "error",
      headers: { "User-Agent": "JA-MAKER/1.0 (+cookbook-import)", Accept: "application/xml,text/xml,text/html;q=0.8" },
    });
    if (!response.ok) throw new Error(`La source répond HTTP ${response.status}.`);
    const length = Number(response.headers.get("content-length") || 0);
    if (length > 5_000_000) throw new Error("Fichier trop volumineux (maximum 5 Mo).");
    const text = await response.text();
    if (text.length > 5_000_000) throw new Error("Fichier trop volumineux (maximum 5 Mo).");
    return text;
  } finally {
    clearTimeout(timer);
  }
}
