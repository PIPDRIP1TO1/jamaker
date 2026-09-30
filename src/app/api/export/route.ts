import { getCurrentSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return Response.json({ error: "Non autorisé" }, { status: 401 });
  const db = await getDb();
  const organizationId = session.organization.id;
  const [projects, outputs, nodes, edges, workflowRuns, automationJobs, schedules, connections] = await Promise.all([
    db.query("SELECT id, module_slug, name, description, status, is_example, source_project_id, config_json, created_at, updated_at FROM module_projects WHERE organization_id = $1", [organizationId]),
    db.query("SELECT id, project_id, output_type, status, title, content_json, created_at FROM module_outputs WHERE organization_id = $1", [organizationId]),
    db.query("SELECT id, project_id, node_type, label, position_x, position_y, sort_order, config_json FROM workflow_nodes WHERE organization_id = $1", [organizationId]),
    db.query("SELECT id, project_id, source_node_id, target_node_id, source_port, target_port FROM workflow_edges WHERE organization_id = $1", [organizationId]),
    db.query("SELECT id, project_id, status, trigger_type, started_at, finished_at, created_at FROM workflow_runs WHERE organization_id = $1", [organizationId]),
    db.query("SELECT id, project_id, status, attempt, max_attempts, scheduled_for, started_at, finished_at, error_message, created_at FROM automation_jobs WHERE organization_id = $1", [organizationId]),
    db.query("SELECT id, project_id, name, schedule_type, schedule_json, timezone, active, next_run_at FROM automation_schedules WHERE organization_id = $1", [organizationId]),
    db.query("SELECT id, provider, display_name, auth_type, status, external_account_label, metadata_json, updated_at FROM integration_connections WHERE organization_id = $1", [organizationId]),
  ]);
  const payload = { format: "jamaker-export", version: 2, exportedAt: new Date().toISOString(), organization: { id: organizationId, name: session.organization.name, slug: session.organization.slug }, data: { projects: projects.rows, outputs: outputs.rows, workflowNodes: nodes.rows, workflowEdges: edges.rows, workflowRuns: workflowRuns.rows, automationJobs: automationJobs.rows, schedules: schedules.rows, connections: connections.rows } };
  const safeName = session.organization.slug.replace(/[^a-z0-9-]/gi, "-");
  return new Response(JSON.stringify(payload, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="jamaker-${safeName}-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" } });
}
