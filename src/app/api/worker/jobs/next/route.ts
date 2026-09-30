import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { touchWorkerToken, verifyWorkerToken } from "@/lib/worker";

export async function POST(request: Request) {
  let body: { worker_token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const worker = await verifyWorkerToken(String(body.worker_token || ""));
  if (!worker) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await touchWorkerToken(worker.id);

  const db = await getDb();
  // Récupère les jobs abandonnés (worker mort en plein run) : +30 min en running.
  await db.query(
    `UPDATE automation_jobs SET status = 'queued', started_at = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE organization_id = $1 AND status = 'running' AND datetime(started_at) < datetime('now', '-30 minutes')`,
    [worker.organization_id],
  );
  const claimed = await db.query<{ id: string; project_id: string; attempt: number; schedule_id: string | null }>(
    `UPDATE automation_jobs SET status = 'running', attempt = attempt + 1, started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = (SELECT id FROM automation_jobs WHERE organization_id = $1 AND status = 'queued' ORDER BY datetime(scheduled_for) LIMIT 1)
     RETURNING id, project_id, attempt, schedule_id`,
    [worker.organization_id],
  );
  const job = claimed.rows[0];
  if (!job) return NextResponse.json({ job: null });

  const project = await db.query<{ id: string; module_slug: string; name: string; config_json: string }>(
    "SELECT id, module_slug, name, config_json FROM module_projects WHERE id = $1 AND organization_id = $2 LIMIT 1",
    [job.project_id, worker.organization_id],
  );
  if (!project.rows[0]) {
    await db.query("UPDATE automation_jobs SET status = 'failed', error_message = 'Projet introuvable.', finished_at = CURRENT_TIMESTAMP WHERE id = $1", [job.id]);
    return NextResponse.json({ job: null });
  }
  return NextResponse.json({ job: { ...job, project: project.rows[0] } });
}
