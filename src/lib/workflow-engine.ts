import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import type { ModuleProject, ProjectConfig } from "@/lib/module-projects";

export type WorkflowNode = { id: string; node_type: string; label: string; position_x: number; position_y: number; sort_order: number };
export type WorkflowEdge = { id: string; source_node_id: string; target_node_id: string };
export type WorkflowRun = { id: string; status: "queued" | "running" | "completed" | "failed"; trigger_type: string; created_at: string; finished_at: string | null };

function nodeType(index: number, count: number) {
  if (index === 0) return "input";
  if (index === count - 1) return "output";
  return "process";
}

export async function ensureWorkflowGraph(organizationId: string, project: ModuleProject, config: ProjectConfig) {
  if (project.module_slug !== "workflows") return;
  const db = await getDb();
  await db.transaction(async (tx) => {
    const existing = await tx.query<{ id: string }>("SELECT id FROM workflow_nodes WHERE organization_id = $1 AND project_id = $2 LIMIT 1", [organizationId, project.id]);
    if (existing.rows.length) return;
    const steps = config.steps.length ? config.steps : [{ id: "input", label: "Entrée", enabled: true }, { id: "output", label: "Résultat", enabled: true }];
    const nodeIds: string[] = [];
    for (let index = 0; index < steps.length; index += 1) {
      const id = randomUUID();
      nodeIds.push(id);
      await tx.query(
        `INSERT INTO workflow_nodes (id, project_id, organization_id, node_type, label, position_x, position_y, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, project.id, organizationId, nodeType(index, steps.length), steps[index].label, 80 + index * 210, 100, index],
      );
    }
    for (let index = 0; index < nodeIds.length - 1; index += 1) {
      await tx.query(
        `INSERT INTO workflow_edges (id, project_id, organization_id, source_node_id, target_node_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), project.id, organizationId, nodeIds[index], nodeIds[index + 1]],
      );
    }
  });
}

export async function getWorkflowGraph(organizationId: string, projectId: string) {
  const db = await getDb();
  const [nodes, edges, runs] = await Promise.all([
    db.query<WorkflowNode>("SELECT id, node_type, label, position_x, position_y, sort_order FROM workflow_nodes WHERE organization_id = $1 AND project_id = $2 ORDER BY sort_order", [organizationId, projectId]),
    db.query<WorkflowEdge>("SELECT id, source_node_id, target_node_id FROM workflow_edges WHERE organization_id = $1 AND project_id = $2 ORDER BY created_at", [organizationId, projectId]),
    db.query<WorkflowRun>("SELECT id, status, trigger_type, created_at, finished_at FROM workflow_runs WHERE organization_id = $1 AND project_id = $2 ORDER BY datetime(created_at) DESC LIMIT 8", [organizationId, projectId]),
  ]);
  return { nodes: nodes.rows, edges: edges.rows, runs: runs.rows };
}

function validateGraph(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  if (nodes.length < 2) throw new Error("Le workflow doit contenir au moins deux nœuds.");
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (edges.some((edge) => !nodeIds.has(edge.source_node_id) || !nodeIds.has(edge.target_node_id))) throw new Error("Une connexion pointe vers un nœud absent.");
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
  edges.forEach((edge) => { incoming.set(edge.target_node_id, (incoming.get(edge.target_node_id) || 0) + 1); outgoing.get(edge.source_node_id)?.push(edge.target_node_id); });
  const queue = nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id);
  const ordered: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    ordered.push(id);
    for (const target of outgoing.get(id) || []) {
      const next = (incoming.get(target) || 0) - 1;
      incoming.set(target, next);
      if (next === 0) queue.push(target);
    }
  }
  if (ordered.length !== nodes.length) throw new Error("Le workflow contient une boucle.");
  return ordered;
}

export async function runWorkflowTechnicalTest(organizationId: string, projectId: string) {
  const db = await getDb();
  const graph = await getWorkflowGraph(organizationId, projectId);
  const order = validateGraph(graph.nodes, graph.edges);
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const runId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.query(`INSERT INTO workflow_runs (id, project_id, organization_id, status, trigger_type, started_at) VALUES ($1, $2, $3, 'running', 'technical_test', CURRENT_TIMESTAMP)`, [runId, projectId, organizationId]);
    for (const nodeId of order) {
      const node = nodesById.get(nodeId)!;
      await tx.query(`INSERT INTO workflow_run_logs (id, run_id, node_id, level, message) VALUES ($1, $2, $3, 'success', $4)`, [randomUUID(), runId, node.id, `${node.label} validé sans action externe.`]);
    }
    await tx.query(`UPDATE workflow_runs SET status = 'completed', finished_at = CURRENT_TIMESTAMP WHERE id = $1`, [runId]);
  });
  return runId;
}
