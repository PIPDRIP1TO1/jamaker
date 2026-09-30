import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { getBillingOverview } from "@/lib/billing";

export type AutomationJob = {
  id: string;
  project_id: string;
  project_name: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  attempt: number;
  max_attempts: number;
  scheduled_for: string;
  created_at: string;
  finished_at: string | null;
  error_message: string | null;
};
export type AutomationSchedule = { id: string; name: string; schedule_type: "manual" | "once" | "interval"; schedule_json: string; timezone: string; active: number; next_run_at: string | null };

type AutomationProject = { id: string; name: string; config_json: string; is_example: number };

async function getOwnedAutomationProject(organizationId: string, projectId: string) {
  return getOwnedProject(organizationId, projectId, "automations");
}

async function getOwnedProject(organizationId: string, projectId: string, moduleSlug?: string) {
  const db = await getDb();
  const result = await db.query<AutomationProject>(
    moduleSlug
      ? "SELECT id, name, config_json, is_example FROM module_projects WHERE id = $1 AND organization_id = $2 AND module_slug = $3 LIMIT 1"
      : "SELECT id, name, config_json, is_example FROM module_projects WHERE id = $1 AND organization_id = $2 LIMIT 1",
    moduleSlug ? [projectId, organizationId, moduleSlug] : [projectId, organizationId],
  );
  return result.rows[0] || null;
}

export async function enqueueAutomationTest(organizationId: string, projectId: string) {
  const jobId = await enqueueAutomationJob(organizationId, projectId, "Tâche ajoutée à la file technique.", "automations");
  return processAutomationJob(organizationId, jobId);
}

export async function enqueueWorkerJob(organizationId: string, projectId: string) {
  return enqueueAutomationJob(organizationId, projectId, "Tâche envoyée au worker local. Démarrez le worker sur votre PC.", "automations");
}

export async function enqueueProjectWorkerJob(organizationId: string, projectId: string, queueMessage: string) {
  return enqueueAutomationJob(organizationId, projectId, queueMessage);
}

async function enqueueAutomationJob(organizationId: string, projectId: string, queueMessage: string, moduleSlug?: string) {
  const billing = await getBillingOverview(organizationId);
  if (!billing.canRunAutomations) throw new Error("Abonnement requis : automations suspendues.");
  const project = await getOwnedProject(organizationId, projectId, moduleSlug);
  if (!project || project.is_example) throw new Error("Créez une copie du projet exemple avant l'exécution.");
  const db = await getDb();
  const jobId = randomUUID();
  await db.query(
    `INSERT INTO automation_jobs (id, project_id, organization_id, status, scheduled_for)
     VALUES ($1, $2, $3, 'queued', CURRENT_TIMESTAMP)`,
    [jobId, projectId, organizationId],
  );
  await db.query(`INSERT INTO automation_job_logs (id, job_id, level, message) VALUES ($1, $2, 'info', $3)`, [randomUUID(), jobId, queueMessage]);
  return jobId;
}

export async function processAutomationJob(organizationId: string, jobId: string) {
  const db = await getDb();
  const claimed = await db.query<{ project_id: string; attempt: number }>(
    `UPDATE automation_jobs SET status = 'running', attempt = attempt + 1, started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND organization_id = $2 AND status = 'queued'
     RETURNING project_id, attempt`,
    [jobId, organizationId],
  );
  const job = claimed.rows[0];
  if (!job) return null;
  try {
    const project = await getOwnedAutomationProject(organizationId, job.project_id);
    if (!project) throw new Error("Projet d'automatisation introuvable.");
    const config = JSON.parse(project.config_json || "{}") as { steps?: Array<{ label?: string; enabled?: boolean }> };
    const steps = Array.isArray(config.steps) ? config.steps.filter((step) => step.enabled !== false) : [];
    await db.transaction(async (tx) => {
      for (const step of steps) {
        await tx.query(`INSERT INTO automation_job_logs (id, job_id, level, message) VALUES ($1, $2, 'success', $3)`, [randomUUID(), jobId, `${step.label || "Étape"} validée en mode technique.`]);
      }
      await tx.query(`UPDATE automation_jobs SET status = 'completed', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [jobId]);
      await tx.query(`INSERT INTO automation_job_logs (id, job_id, level, message) VALUES ($1, $2, 'success', 'Exécution terminée sans action externe.')`, [randomUUID(), jobId]);
    });
    return jobId;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Erreur technique inconnue";
    await db.query(`UPDATE automation_jobs SET status = 'failed', error_message = $1, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND organization_id = $3`, [message, jobId, organizationId]);
    await db.query(`INSERT INTO automation_job_logs (id, job_id, level, message) VALUES ($1, $2, 'error', $3)`, [randomUUID(), jobId, message]);
    return null;
  }
}

export async function retryAutomationJob(organizationId: string, jobId: string) {
  const db = await getDb();
  const result = await db.query<{ id: string }>(
    `UPDATE automation_jobs SET status = 'queued', error_message = NULL, finished_at = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND organization_id = $2 AND status = 'failed' AND attempt < max_attempts RETURNING id`,
    [jobId, organizationId],
  );
  if (!result.rows[0]) return null;
  return processAutomationJob(organizationId, jobId);
}

export async function cancelAutomationJob(organizationId: string, jobId: string) {
  const db = await getDb();
  await db.query(
    `UPDATE automation_jobs SET status = 'cancelled', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND organization_id = $2 AND status IN ('queued', 'running')`,
    [jobId, organizationId],
  );
}

export async function listAutomationJobs(organizationId: string, limit = 20) {
  const db = await getDb();
  const result = await db.query<AutomationJob>(
    `SELECT j.id, j.project_id, p.name AS project_name, j.status, j.attempt, j.max_attempts, j.scheduled_for, j.created_at, j.finished_at, j.error_message
     FROM automation_jobs j JOIN module_projects p ON p.id = j.project_id
     WHERE j.organization_id = $1 ORDER BY datetime(j.created_at) DESC LIMIT $2`,
    [organizationId, limit],
  );
  return result.rows;
}

export async function getAutomationSchedule(organizationId: string, projectId: string) {
  const db = await getDb();
  const result = await db.query<AutomationSchedule>(
    "SELECT id, name, schedule_type, schedule_json, timezone, active, next_run_at FROM automation_schedules WHERE organization_id = $1 AND project_id = $2 ORDER BY created_at LIMIT 1",
    [organizationId, projectId],
  );
  return result.rows[0] || null;
}

export async function saveAutomationSchedule(organizationId: string, projectId: string, intervalMinutes: number, active: boolean) {
  const project = await getOwnedAutomationProject(organizationId, projectId);
  if (!project || project.is_example) throw new Error("Le planning exige un projet privé.");
  const db = await getDb();
  const existing = await getAutomationSchedule(organizationId, projectId);
  const scheduleJson = JSON.stringify({ intervalMinutes });
  const nextRunAt = active ? new Date(Date.now() + intervalMinutes * 60_000).toISOString() : null;
  if (existing) {
    await db.query(`UPDATE automation_schedules SET schedule_type = 'interval', schedule_json = $1, active = $2, next_run_at = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND organization_id = $5`, [scheduleJson, active ? 1 : 0, nextRunAt, existing.id, organizationId]);
    return existing.id;
  }
  const id = randomUUID();
  await db.query(`INSERT INTO automation_schedules (id, project_id, organization_id, name, schedule_type, schedule_json, active, next_run_at) VALUES ($1, $2, $3, 'Planning principal', 'interval', $4, $5, $6)`, [id, projectId, organizationId, scheduleJson, active ? 1 : 0, nextRunAt]);
  return id;
}
