import { getDb } from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

export async function storeConnectionSecret(organizationId: string, connectionId: string, plaintext: string, hint = "") {
  if (!plaintext || plaintext.length < 3 || plaintext.length > 8000) throw new Error("Secret invalide.");
  const db = await getDb();
  const owned = await db.query<{ id: string }>("SELECT id FROM integration_connections WHERE id = $1 AND organization_id = $2 LIMIT 1", [connectionId, organizationId]);
  if (!owned.rows[0]) throw new Error("Connexion introuvable.");
  const { encryptedValue, iv, authTag } = encryptSecret(plaintext);
  await db.query(
    `INSERT INTO integration_secrets (connection_id, organization_id, encrypted_value, iv, auth_tag, key_hint, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
     ON CONFLICT(connection_id) DO UPDATE SET encrypted_value = $3, iv = $4, auth_tag = $5, key_hint = $6, updated_at = CURRENT_TIMESTAMP`,
    [connectionId, organizationId, encryptedValue, iv, authTag, hint.slice(0, 40)],
  );
}

// Usage serveur uniquement (jobs, publications). Jamais exposé au navigateur.
export async function readConnectionSecret(organizationId: string, connectionId: string): Promise<string | null> {
  const db = await getDb();
  const result = await db.query<{ encrypted_value: string; iv: string; auth_tag: string }>(
    "SELECT encrypted_value, iv, auth_tag FROM integration_secrets WHERE connection_id = $1 AND organization_id = $2 LIMIT 1",
    [connectionId, organizationId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return decryptSecret(row.encrypted_value, row.iv, row.auth_tag);
}

export async function deleteConnectionSecret(organizationId: string, connectionId: string) {
  const db = await getDb();
  await db.query("DELETE FROM integration_secrets WHERE connection_id = $1 AND organization_id = $2", [connectionId, organizationId]);
}

export async function hasConnectionSecret(organizationId: string, connectionId: string) {
  const db = await getDb();
  const result = await db.query<{ connection_id: string }>("SELECT connection_id FROM integration_secrets WHERE connection_id = $1 AND organization_id = $2 LIMIT 1", [connectionId, organizationId]);
  return Boolean(result.rows[0]);
}
