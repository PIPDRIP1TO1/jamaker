import { getDb } from "@/lib/db";

export type MessageKind = "message" | "signal" | "keyword" | "resource";

export type WorkspaceMessage = {
  id: string;
  kind: MessageKind;
  module_slug: string;
  title: string;
  body: string;
  url: string;
  meta_json: string;
  created_at: string;
};

const kinds: MessageKind[] = ["message", "signal", "keyword", "resource"];

export function isMessageKind(value: string): value is MessageKind {
  return (kinds as string[]).includes(value);
}

export async function listWorkspaceMessages(organizationId: string, kind: MessageKind, moduleSlug = "", limit = 100): Promise<WorkspaceMessage[]> {
  const db = await getDb();
  const result = await db.query<WorkspaceMessage>(
    `SELECT id, kind, module_slug, title, body, url, meta_json, created_at
     FROM workspace_messages WHERE organization_id = $1 AND kind = $2 AND ($3 = '' OR module_slug = $3)
     ORDER BY datetime(created_at) DESC LIMIT $4`,
    [organizationId, kind, moduleSlug, limit],
  );
  return result.rows;
}
