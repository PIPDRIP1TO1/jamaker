import { getDb } from "@/lib/db";

export type ReportSummary = { projects: number; examples: number; outputs: number; workflow_runs: number; automation_jobs: number; successful_jobs: number; failed_jobs: number };
export type ModuleCount = { module_slug: string; total: number; private_projects: number };

export async function getOrganizationReport(organizationId: string) {
  const db = await getDb();
  const [summary, modules] = await Promise.all([
    db.query<ReportSummary>(
      `SELECT
        (SELECT COUNT(*) FROM module_projects WHERE organization_id = $1) AS projects,
        (SELECT COUNT(*) FROM module_projects WHERE organization_id = $1 AND is_example = 1) AS examples,
        (SELECT COUNT(*) FROM module_outputs WHERE organization_id = $1) AS outputs,
        (SELECT COUNT(*) FROM workflow_runs WHERE organization_id = $1) AS workflow_runs,
        (SELECT COUNT(*) FROM automation_jobs WHERE organization_id = $1) AS automation_jobs,
        (SELECT COUNT(*) FROM automation_jobs WHERE organization_id = $1 AND status = 'completed') AS successful_jobs,
        (SELECT COUNT(*) FROM automation_jobs WHERE organization_id = $1 AND status = 'failed') AS failed_jobs`,
      [organizationId],
    ),
    db.query<ModuleCount>(
      `SELECT module_slug, COUNT(*) AS total, SUM(CASE WHEN is_example = 0 THEN 1 ELSE 0 END) AS private_projects
       FROM module_projects WHERE organization_id = $1 GROUP BY module_slug ORDER BY total DESC, module_slug LIMIT 20`,
      [organizationId],
    ),
  ]);
  return { summary: summary.rows[0] || { projects: 0, examples: 0, outputs: 0, workflow_runs: 0, automation_jobs: 0, successful_jobs: 0, failed_jobs: 0 }, modules: modules.rows };
}
