"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getModule } from "@/config/modules";
import { getModuleSettings } from "@/config/module-settings";
import { generateModuleDraft } from "@/lib/module-outputs";
import { logAudit } from "@/lib/audit";

export type CreationState = { message?: string };

const GENERATABLE = new Set(["recipe-video", "cookbook-marketing", "animated-story", "workflows", "automations", "facebook", "instagram", "pinterest", "facebook-pages", "facebook-groups", "pinterest-accounts"]);

export async function generateCreationAction(_state: CreationState, formData: FormData): Promise<CreationState> {
  const session = await requireSession();
  const projectId = String(formData.get("projectId") || "");
  const moduleSlug = String(formData.get("moduleSlug") || "");
  const module = getModule(moduleSlug);
  if (!projectId || !module || !GENERATABLE.has(moduleSlug)) return { message: "Module introuvable." };
  const db = await getDb();
  const current = await db.query<{ config_json: string; is_example: number }>(
    "SELECT config_json, is_example FROM module_projects WHERE id = $1 AND organization_id = $2 AND module_slug = $3 LIMIT 1",
    [projectId, session.organization.id, moduleSlug],
  );
  const row = current.rows[0];
  if (!row) return { message: "Projet introuvable." };
  if (row.is_example) return { message: "Dupliquez l'exemple avant de générer." };

  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(row.config_json || "{}");
  } catch {
    config = {};
  }
  const inputs: Record<string, string> = {};
  let filled = 0;
  for (const setting of getModuleSettings(moduleSlug)) {
    const raw = String(formData.get(setting.key) || "");
    const value = setting.type === "checkbox" ? (formData.get(setting.key) === "on" ? "1" : "") : raw.trim().slice(0, 4000);
    inputs[setting.key] = value;
    if (value) filled++;
  }
  if (!filled) return { message: "Renseignez au moins un champ avant de générer." };
  config.inputs = inputs;
  await db.query("UPDATE module_projects SET config_json = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND organization_id = $3", [JSON.stringify(config), projectId, session.organization.id]);
  const fullConfig = { version: 1, kind: "project", steps: [], inputs, externalAccounts: [], localPaths: [] };
  await generateModuleDraft(session.organization.id, projectId, moduleSlug, fullConfig);
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "creation.generate", entityType: moduleSlug, entityId: projectId });
  revalidatePath(`/dashboard/tools/${moduleSlug}/projects/${projectId}`);
  return { message: "Prévisualisation technique générée (nouvelle version)." };
}
