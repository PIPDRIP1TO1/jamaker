import { getValidGoogleAccessToken } from "@/lib/google";

export type GmailMessage = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
};

function decodeB64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

function header(headers: Array<{ name: string; value: string }>, name: string) {
  return headers.find((h) => h.name.toLowerCase() === name)?.value || "";
}

function extractBody(payload: Record<string, unknown>): string {
  const walk = (part: Record<string, unknown>): string => {
    const mime = String(part.mimeType || "");
    const body = (part.body || {}) as { data?: string };
    if (mime === "text/plain" && body.data) return decodeB64Url(body.data);
    const parts = part.parts as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(parts)) {
      for (const sub of parts) {
        const found = walk(sub);
        if (found) return found;
      }
    }
    if (mime.startsWith("text/") && body.data) return decodeB64Url(body.data);
    return "";
  };
  return walk(payload).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 3000);
}

export async function listGmailMessages(organizationId: string, maxResults = 10, query = "") {
  const auth = await getValidGoogleAccessToken(organizationId);
  if (!auth) return null;
  const params = new URLSearchParams({ maxResults: String(Math.max(1, Math.min(25, maxResults))), q: query });
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { messages?: Array<{ id: string; threadId: string }> };
  const messages: GmailMessage[] = [];
  for (const ref of data.messages || []) {
    const full = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${ref.id}?format=full`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (!full.ok) continue;
    const msg = (await full.json()) as {
      id: string;
      threadId: string;
      snippet: string;
      payload: { headers: Array<{ name: string; value: string }>; [key: string]: unknown };
    };
    messages.push({
      id: msg.id,
      threadId: msg.threadId,
      from: header(msg.payload.headers, "from"),
      subject: header(msg.payload.headers, "subject") || "(sans objet)",
      date: header(msg.payload.headers, "date"),
      snippet: msg.snippet || "",
      body: extractBody(msg.payload as Record<string, unknown>),
    });
  }
  return { email: auth.email, messages };
}

export async function createGmailDraft(organizationId: string, to: string, subject: string, body: string) {
  const auth = await getValidGoogleAccessToken(organizationId);
  if (!auth) return { ok: false as const, message: "Compte Google non connecté." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false as const, message: "Destinataire invalide." };
  if (subject.trim().length < 2 || body.trim().length < 5) return { ok: false as const, message: "Objet et corps trop courts." };
  const raw = Buffer.from(`To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${body}`).toString("base64url");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw } }),
  });
  if (!res.ok) return { ok: false as const, message: `Gmail a répondu ${res.status}.` };
  const draft = (await res.json()) as { id?: string };
  return { ok: true as const, draftId: draft.id || "" };
}
