import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";

export async function logAudit(input: {
  organizationId: string;
  userId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  const db = await getDb();
  await db.query(
    `INSERT INTO audit_logs (id, organization_id, user_id, action, entity_type, entity_id, metadata_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      randomUUID(),
      input.organizationId,
      input.userId,
      input.action,
      input.entityType || "",
      input.entityId || "",
      JSON.stringify(input.metadata || {}),
    ],
  );
}

export type AuditLog = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata_json: string;
  created_at: string;
};

export async function listAuditLogs(organizationId: string, limit = 50): Promise<AuditLog[]> {
  const db = await getDb();
  const result = await db.query<AuditLog>(
    `SELECT id, user_id, action, entity_type, entity_id, metadata_json, created_at
     FROM audit_logs WHERE organization_id = $1
     ORDER BY datetime(created_at) DESC LIMIT $2`,
    [organizationId, limit],
  );
  return result.rows;
}
