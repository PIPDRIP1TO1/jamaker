"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { requireAutomationEntitlement } from "@/lib/billing";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { getModule } from "@/config/modules";
import { getModuleCapabilities } from "@/config/module-blueprints";
import { getModuleSettings } from "@/config/module-settings";
import { runWorkflowTechnicalTest } from "@/lib/workflow-engine";
import { cancelAutomationJob, enqueueAutomationTest, enqueueWorkerJob, retryAutomationJob, saveAutomationSchedule } from "@/lib/automation-engine";
import { generateModuleDraft } from "@/lib/module-outputs";
import { parseProjectConfig } from "@/lib/module-projects";

export async function duplicateExampleAction(formData: FormData) {
  const session = await requireSession();
  const projectId = String(formData.get("projectId") || "");
  const moduleSlug = String(formData.get("moduleSlug") || "");
  if (!projectId || !getModule(moduleSlug)) return;

  const db = await getDb();
  const newProjectId = randomUUID();
  const result = await db.query(
    `INSERT INTO module_projects (id, organization_id, module_slug, name, description, status, is_example, source_project_id, config_json)
     SELECT $1, organization_id, module_slug, REPLACE(name, 'Exemple — ', ''), description, 'draft', 0, id, config_json
     FROM module_projects
     WHERE id = $2 AND organization_id = $3 AND module_slug = $4 AND is_example = 1`,
    [newProjectId, projectId, session.organization.id, moduleSlug],
  );
  if (!result.rowCount) return;
  revalidatePath(`/dashboard/tools/${moduleSlug}`);
  redirect(`/dashboard/tools/${moduleSlug}/projects/${newProjectId}`);
}

export async function createProjectAction(formData: FormData) {
  const session = await requireSession();
  const moduleSlug = String(formData.get("moduleSlug") || "");
  const module = getModule(moduleSlug);
  if (!module) return;
  const projectId = randomUUID();
  const config = JSON.stringify({ version: 1, kind: "project", steps: getModuleCapabilities(module).map((label, index) => ({ id: `step-${index + 1}`, label, enabled: true })), inputs: {}, externalAccounts: [], localPaths: [] });
  const db = await getDb();
  await db.query(
    `INSERT INTO module_projects (id, organization_id, module_slug, name, description, status, is_example, config_json)
     VALUES ($1, $2, $3, $4, '', 'draft', 0, $5)`,
    [projectId, session.organization.id, moduleSlug, `Nouveau projet — ${module.name}`, config],
  );
  revalidatePath(`/dashboard/tools/${moduleSlug}`);
  redirect(`/dashboard/tools/${moduleSlug}/projects/${projectId}`);
}

export async function updateProjectAction(formData: FormData) {
  const session = await requireSession();
  const projectId = String(formData.get("projectId") || "");
  const moduleSlug = String(formData.get("moduleSlug") || "");
  const name = String(formData.get("name") || "").trim().slice(0, 100);
  const description = String(formData.get("description") || "").trim().slice(0, 500);
  if (!projectId || !getModule(moduleSlug) || name.length < 2) return;
  const db = await getDb();
  await db.query(
    `UPDATE module_projects SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 AND organization_id = $4 AND module_slug = $5 AND is_example = 0`,
    [name, description, projectId, session.organization.id, moduleSlug],
  );
  revalidatePath(`/dashboard/tools/${moduleSlug}`);
  revalidatePath(`/dashboard/tools/${moduleSlug}/projects/${projectId}`);
}

export async function runWorkflowTestAction(formData: FormData) {
  const session = await requireSession();
  const projectId = String(formData.get("projectId") || "");
  const moduleSlug = String(formData.get("moduleSlug") || "");
  if (!projectId || moduleSlug !== "workflows") return;
  const db = await getDb();
  const project = await db.query<{ id: string; is_example: number }>("SELECT id, is_example FROM module_projects WHERE id = $1 AND organization_id = $2 AND module_slug = 'workflows' LIMIT 1", [projectId, session.organization.id]);
  if (!project.rows[0] || project.rows[0].is_example) return;
  await runWorkflowTechnicalTest(session.organization.id, projectId);
  revalidatePath(`/dashboard/tools/workflows/projects/${projectId}`);
}

export async function runAutomationTestAction(formData: FormData) {
  const { session } = await requireAutomationEntitlement();
  const projectId = String(formData.get("projectId") || "");
  if (!projectId) return;
  await enqueueAutomationTest(session.organization.id, projectId);
  revalidatePath("/dashboard/automations");
  revalidatePath(`/dashboard/tools/automations/projects/${projectId}`);
}

export async function sendToWorkerAction(formData: FormData) {
  const { session } = await requireAutomationEntitlement();
  const projectId = String(formData.get("projectId") || "");
  const workerAdapter = String(formData.get("workerAdapter") || "technical").slice(0, 60);
  const workerPrompt = String(formData.get("workerPrompt") || "").trim().slice(0, 4000);
  const browserProfile = String(formData.get("browserProfile") || "").trim().slice(0, 80) || "Profil principal";
  if (!projectId) return;
  const db = await getDb();
  const current = await db.query<{ config_json: string }>("SELECT config_json FROM module_projects WHERE id = $1 AND organization_id = $2 AND module_slug = 'automations' AND is_example = 0 LIMIT 1", [projectId, session.organization.id]);
  if (!current.rows[0]) return;
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(current.rows[0].config_json || "{}");
  } catch {
    config = {};
  }
  config.inputs = { ...((config.inputs || {}) as Record<string, unknown>), workerAdapter, workerPrompt, browserProfile };
  await db.query("UPDATE module_projects SET config_json = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND organization_id = $3", [JSON.stringify(config), projectId, session.organization.id]);
  await enqueueWorkerJob(session.organization.id, projectId);
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "automation.worker.send", entityType: "automations", entityId: projectId, metadata: { workerAdapter } });
  revalidatePath("/dashboard/automations");
  revalidatePath(`/dashboard/tools/automations/projects/${projectId}`);
}

export async function retryAutomationJobAction(formData: FormData) {
  const { session } = await requireAutomationEntitlement();
  const jobId = String(formData.get("jobId") || "");
  if (!jobId) return;
  await retryAutomationJob(session.organization.id, jobId);
  revalidatePath("/dashboard/automations");
}

export async function cancelAutomationJobAction(formData: FormData) {
  const session = await requireSession();
  const jobId = String(formData.get("jobId") || "");
  if (!jobId) return;
  await cancelAutomationJob(session.organization.id, jobId);
  revalidatePath("/dashboard/automations");
}

export async function saveAutomationScheduleAction(formData: FormData) {
  const session = await requireSession();
  const projectId = String(formData.get("projectId") || "");
  const intervalMinutes = Math.max(5, Math.min(10080, Number(formData.get("intervalMinutes")) || 60));
  const active = formData.get("active") === "on";
  if (!projectId) return;
  await saveAutomationSchedule(session.organization.id, projectId, intervalMinutes, active);
  revalidatePath(`/dashboard/tools/automations/projects/${projectId}`);
}

export async function saveProjectSettingsAction(formData: FormData) {
  const session = await requireSession();
  const projectId = String(formData.get("projectId") || "");
  const moduleSlug = String(formData.get("moduleSlug") || "");
  if (!projectId || !getModule(moduleSlug)) return;
  const db = await getDb();
  const current = await db.query<{ config_json: string }>("SELECT config_json FROM module_projects WHERE id = $1 AND organization_id = $2 AND module_slug = $3 AND is_example = 0 LIMIT 1", [projectId, session.organization.id, moduleSlug]);
  if (!current.rows[0]) return;
  let config: Record<string, unknown> = {};
  try { config = JSON.parse(current.rows[0].config_json || "{}"); } catch { config = {}; }
  const inputs: Record<string, string> = {};
  for (const setting of getModuleSettings(moduleSlug)) inputs[setting.key] = String(formData.get(setting.key) || "").trim().slice(0, 4000);
  config.inputs = inputs;
  await db.query("UPDATE module_projects SET config_json = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND organization_id = $3", [JSON.stringify(config), projectId, session.organization.id]);
  revalidatePath(`/dashboard/tools/${moduleSlug}/projects/${projectId}`);
}

export async function generateModuleDraftAction(formData: FormData) {
  const session = await requireSession();
  const projectId = String(formData.get("projectId") || "");
  const moduleSlug = String(formData.get("moduleSlug") || "");
  if (!projectId || !getModule(moduleSlug)) return;
  const db = await getDb();
  const result = await db.query<{ id: string; module_slug: string; name: string; description: string; status: "draft"; is_example: number; source_project_id: string | null; config_json: string; updated_at: string }>("SELECT * FROM module_projects WHERE id = $1 AND organization_id = $2 AND module_slug = $3 AND is_example = 0 LIMIT 1", [projectId, session.organization.id, moduleSlug]);
  const project = result.rows[0];
  if (!project) return;
  await generateModuleDraft(session.organization.id, projectId, moduleSlug, parseProjectConfig(project));
  revalidatePath(`/dashboard/tools/${moduleSlug}/projects/${projectId}`);
  revalidatePath("/dashboard/tools/reports");
}

export async function deleteProjectAction(formData: FormData) {
  const session = await requireSession();
  const projectId = String(formData.get("projectId") || "");
  const moduleSlug = String(formData.get("moduleSlug") || "");
  if (!projectId || !getModule(moduleSlug)) return;

  const db = await getDb();
  await db.query("DELETE FROM module_projects WHERE id = $1 AND organization_id = $2 AND module_slug = $3", [projectId, session.organization.id, moduleSlug]);
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "project.delete", entityType: moduleSlug, entityId: projectId });
  revalidatePath(`/dashboard/tools/${moduleSlug}`);
}
