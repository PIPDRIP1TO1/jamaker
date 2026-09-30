import { getDb } from "@/lib/db";

export type WorkspaceProfile = { id: string; name: string; profile_type: "browser" | "social" | "content" | "workspace"; platform: string; status: "draft" | "ready" | "disabled"; notes: string; updated_at: string };

export async function listWorkspaceProfiles(organizationId: string) {
  const db = await getDb();
  const result = await db.query<WorkspaceProfile>("SELECT id, name, profile_type, platform, status, notes, updated_at FROM workspace_profiles WHERE organization_id = $1 ORDER BY datetime(updated_at) DESC", [organizationId]);
  return result.rows;
}
