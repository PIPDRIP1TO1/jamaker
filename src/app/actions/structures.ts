"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const types = new Set(["browser", "social", "content", "workspace"]);
const statuses = new Set(["draft", "ready", "disabled"]);

export type StructureState = { message?: string };

export async function createWorkspaceProfileAction(_state: StructureState, formData: FormData): Promise<StructureState> {
  const session = await requireSession();
  const name = String(formData.get("name") || "").trim().slice(0, 100);
  const profileType = String(formData.get("profileType") || "workspace");
  const platform = String(formData.get("platform") || "").trim().slice(0, 80);
  const status = String(formData.get("status") || "draft");
  const notes = String(formData.get("notes") || "").trim().slice(0, 1000);
  if (name.length < 2) return { message: "Nom trop court (2 caractères minimum)." };
  if (!types.has(profileType) || !statuses.has(status)) return { message: "Type ou état invalide." };
  const db = await getDb();
  const id = randomUUID();
  await db.query("INSERT INTO workspace_profiles (id, organization_id, name, profile_type, platform, status, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)", [id, session.organization.id, name, profileType, platform, status, notes]);
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "structure.create", entityType: "profile", entityId: id, metadata: { name } });
  revalidatePath("/dashboard/tools/structures");
  return { message: `Profil « ${name} » ajouté.` };
}

export async function updateWorkspaceProfileAction(_state: StructureState, formData: FormData): Promise<StructureState> {
  const session = await requireSession();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim().slice(0, 100);
  const platform = String(formData.get("platform") || "").trim().slice(0, 80);
  const status = String(formData.get("status") || "draft");
  const notes = String(formData.get("notes") || "").trim().slice(0, 1000);
  if (!id) return { message: "Profil introuvable." };
  if (name.length < 2) return { message: "Nom trop court." };
  if (!statuses.has(status)) return { message: "État invalide." };
  const db = await getDb();
  const result = await db.query("UPDATE workspace_profiles SET name = $1, platform = $2, status = $3, notes = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 AND organization_id = $6", [name, platform, status, notes, id, session.organization.id]);
  if (!result.rowCount) return { message: "Profil introuvable." };
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "structure.update", entityType: "profile", entityId: id });
  revalidatePath("/dashboard/tools/structures");
  return { message: "Profil mis à jour." };
}

export async function deleteWorkspaceProfileAction(formData: FormData) {
  const session = await requireSession(); const id = String(formData.get("id") || ""); if (!id) return;
  const db = await getDb(); await db.query("DELETE FROM workspace_profiles WHERE id = $1 AND organization_id = $2", [id, session.organization.id]);
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "structure.delete", entityType: "profile", entityId: id });
  revalidatePath("/dashboard/tools/structures");
}
