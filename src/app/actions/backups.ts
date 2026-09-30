"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getModule } from "@/config/modules";
import { logAudit } from "@/lib/audit";

type ImportedProject = { id?: unknown; module_slug?: unknown; name?: unknown; description?: unknown; config_json?: unknown };
type ImportedOutput = { project_id?: unknown; output_type?: unknown; status?: unknown; title?: unknown; content_json?: unknown };
type ImportedNode = { id?: unknown; project_id?: unknown; node_type?: unknown; label?: unknown; position_x?: unknown; position_y?: unknown; sort_order?: unknown; config_json?: unknown };
type ImportedEdge = { project_id?: unknown; source_node_id?: unknown; target_node_id?: unknown; source_port?: unknown; target_port?: unknown };
type ImportedSchedule = { project_id?: unknown; name?: unknown; schedule_type?: unknown; schedule_json?: unknown; timezone?: unknown };
type ImportedConnection = { provider?: unknown; display_name?: unknown; auth_type?: unknown };

export type RestoreState = { message?: string; restored?: number };

function cleanConfig(source: unknown): string {
  let config: Record<string, unknown> = {};
  try {
    config = typeof source === "string" ? (JSON.parse(source) as Record<string, unknown>) : {};
  } catch {
    config = {};
  }
  config.externalAccounts = [];
  config.localPaths = [];
  config.kind = "restored-project";
  return JSON.stringify(config);
}

export async function restoreBackupAction(_state: RestoreState, formData: FormData): Promise<RestoreState> {
  const session = await requireSession();
  const file = formData.get("backup");
  if (!(file instanceof File) || !file.size) return { message: "Choisissez un fichier JSON d'export." };
  if (file.size > 5 * 1024 * 1024) return { message: "Fichier trop volumineux (max 5 Mo)." };
  let payload: {
    format?: unknown;
    data?: {
      projects?: ImportedProject[];
      outputs?: ImportedOutput[];
      workflowNodes?: ImportedNode[];
      workflowEdges?: ImportedEdge[];
      schedules?: ImportedSchedule[];
      connections?: ImportedConnection[];
    };
  };
  try {
    payload = JSON.parse(await file.text());
  } catch {
    return { message: "Fichier JSON illisible." };
  }
  if (payload.format !== "jamaker-export" || !Array.isArray(payload.data?.projects)) {
    return { message: "Format invalide : export JA MAKER attendu." };
  }
  const db = await getDb();
  const projectIdMap = new Map<string, string>();
  const nodeIdMap = new Map<string, string>();
  let restoredProjects = 0;
  let restoredOutputs = 0;

  await db.transaction(async (tx) => {
    for (const source of payload.data!.projects!.slice(0, 500)) {
      const moduleSlug = String(source.module_slug || "");
      if (!getModule(moduleSlug)) continue;
      const oldId = String(source.id || "");
      const newId = randomUUID();
      if (oldId) projectIdMap.set(oldId, newId);
      const cleanName = String(source.name || "Projet restauré").replace(/^Exemple\s*[—-]\s*/i, "").replace(/^Restauré\s*[—-]\s*/i, "").trim().slice(0, 90) || "Projet restauré";
      await tx.query(
        `INSERT INTO module_projects (id, organization_id, module_slug, name, description, status, is_example, config_json)
         VALUES ($1, $2, $3, $4, $5, 'draft', 0, $6)`,
        [newId, session.organization.id, moduleSlug, `Restauré — ${cleanName}`.slice(0, 100), String(source.description || "").slice(0, 500), cleanConfig(source.config_json)],
      );
      restoredProjects++;
    }
    for (const output of (payload.data!.outputs || []).slice(0, 1000)) {
      const newProjectId = projectIdMap.get(String(output.project_id || ""));
      if (!newProjectId) continue;
      const content = String(output.content_json || "{}").slice(0, 200000);
      try {
        JSON.parse(content);
      } catch {
        continue;
      }
      await tx.query(
        `INSERT INTO module_outputs (id, project_id, organization_id, output_type, status, title, content_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [randomUUID(), newProjectId, session.organization.id, String(output.output_type || "technical_draft").slice(0, 40), output.status === "failed" ? "failed" : "ready", String(output.title || "Résultat restauré").slice(0, 120), content],
      );
      restoredOutputs++;
    }
    for (const node of (payload.data!.workflowNodes || []).slice(0, 2000)) {
      const newProjectId = projectIdMap.get(String(node.project_id || ""));
      if (!newProjectId) continue;
      const newNodeId = randomUUID();
      if (node.id) nodeIdMap.set(String(node.id), newNodeId);
      await tx.query(
        `INSERT INTO workflow_nodes (id, project_id, organization_id, node_type, label, position_x, position_y, sort_order, config_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [newNodeId, newProjectId, session.organization.id, String(node.node_type || "step").slice(0, 60), String(node.label || "Étape").slice(0, 120), Number(node.position_x) || 0, Number(node.position_y) || 0, Number(node.sort_order) || 0, typeof node.config_json === "string" ? node.config_json.slice(0, 20000) : "{}"],
      );
    }
    for (const edge of (payload.data!.workflowEdges || []).slice(0, 2000)) {
      const newProjectId = projectIdMap.get(String(edge.project_id || ""));
      const newSource = nodeIdMap.get(String(edge.source_node_id || ""));
      const newTarget = nodeIdMap.get(String(edge.target_node_id || ""));
      if (!newProjectId || !newSource || !newTarget) continue;
      await tx.query(
        `INSERT INTO workflow_edges (id, project_id, organization_id, source_node_id, target_node_id, source_port, target_port)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [randomUUID(), newProjectId, session.organization.id, newSource, newTarget, String(edge.source_port || "output").slice(0, 40), String(edge.target_port || "input").slice(0, 40)],
      );
    }
    for (const schedule of (payload.data!.schedules || []).slice(0, 500)) {
      const newProjectId = projectIdMap.get(String(schedule.project_id || ""));
      if (!newProjectId) continue;
      // Restauration inactive par sécurité : l'utilisateur réactive explicitement.
      await tx.query(
        `INSERT INTO automation_schedules (id, project_id, organization_id, name, schedule_type, schedule_json, timezone, active, next_run_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, NULL)`,
        [randomUUID(), newProjectId, session.organization.id, String(schedule.name || "Planning restauré").slice(0, 100), schedule.schedule_type === "once" || schedule.schedule_type === "manual" ? String(schedule.schedule_type) : "interval", typeof schedule.schedule_json === "string" ? schedule.schedule_json.slice(0, 5000) : "{}", String(schedule.timezone || "Africa/Casablanca").slice(0, 60)],
      );
    }
    for (const conn of (payload.data!.connections || []).slice(0, 100)) {
      const provider = String(conn.provider || "").slice(0, 60);
      const authType = conn.auth_type === "api_key" ? "api_key" : "oauth";
      if (!provider) continue;
      // Métadonnées seules, sans secret : à reconnecter après restauration.
      await tx.query(
        `INSERT INTO integration_connections (id, organization_id, provider, display_name, auth_type, status)
         VALUES ($1, $2, $3, $4, $5, 'draft')
         ON CONFLICT(organization_id, provider, display_name) DO NOTHING`,
        [randomUUID(), session.organization.id, provider, String(conn.display_name || provider).slice(0, 120), authType],
      );
    }
  });

  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "backup.restore", entityType: "backup", entityId: "", metadata: { projects: restoredProjects, outputs: restoredOutputs } });
  revalidatePath("/dashboard/tools/backups");
  revalidatePath("/dashboard/modules");
  if (!restoredProjects) return { message: "Aucun projet valide trouvé dans cet export." };
  return { message: `Restauration terminée : ${restoredProjects} projet(s), ${restoredOutputs} résultat(s). Plannings restaurés inactifs, connexions à reconnecter.`, restored: restoredProjects };
}
