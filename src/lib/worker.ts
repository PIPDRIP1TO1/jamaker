import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";

export function hashWorkerToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function mintWorkerToken(organizationId: string, name: string) {
  const db = await getDb();
  const token = `jwk_${randomBytes(32).toString("base64url")}`;
  const id = randomUUID();
  await db.query("INSERT INTO worker_tokens (id, organization_id, name, token_hash) VALUES ($1, $2, $3, $4)", [
    id,
    organizationId,
    name.slice(0, 80),
    hashWorkerToken(token),
  ]);
  return { id, token };
}

export async function verifyWorkerToken(token: string) {
  if (!token.startsWith("jwk_")) return null;
  const db = await getDb();
  const result = await db.query<{ id: string; organization_id: string; name: string }>(
    "SELECT id, organization_id, name FROM worker_tokens WHERE token_hash = $1 LIMIT 1",
    [hashWorkerToken(token)],
  );
  return result.rows[0] || null;
}

export async function touchWorkerToken(id: string) {
  const db = await getDb();
  await db.query("UPDATE worker_tokens SET last_seen_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
}

export async function listWorkerTokens(organizationId: string) {
  const db = await getDb();
  const result = await db.query<{ id: string; name: string; last_seen_at: string | null; created_at: string }>(
    "SELECT id, name, last_seen_at, created_at FROM worker_tokens WHERE organization_id = $1 ORDER BY created_at DESC",
    [organizationId],
  );
  return result.rows;
}

export async function revokeWorkerToken(organizationId: string, id: string) {
  const db = await getDb();
  await db.query("DELETE FROM worker_tokens WHERE id = $1 AND organization_id = $2", [id, organizationId]);
}
