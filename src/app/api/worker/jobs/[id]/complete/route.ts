import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { touchWorkerToken, verifyWorkerToken } from "@/lib/worker";

type IncomingLog = { level?: string; message?: string };
const levels = new Set(["info", "success", "warning", "error"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { worker_token?: string; status?: string; error_message?: string; logs?: IncomingLog[]; output?: { title?: string; content?: unknown } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const worker = await verifyWorkerToken(String(body.worker_token || ""));
  if (!worker) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await touchWorkerToken(worker.id);

  const status = body.status === "completed" ? "completed" : "failed";
  const db = await getDb();
  const job = await db.query<{ project_id: string }>("SELECT project_id FROM automation_jobs WHERE id = $1 AND organization_id = $2 LIMIT 1", [id, worker.organization_id]);
  if (!job.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.transaction(async (tx) => {
    for (const log of (body.logs || []).slice(0, 200)) {
      const level = levels.has(String(log.level)) ? String(log.level) : "info";
      await tx.query("INSERT INTO automation_job_logs (id, job_id, level, message) VALUES ($1, $2, $3, $4)", [randomUUID(), id, level, String(log.message || "").slice(0, 2000)]);
    }
    await tx.query("UPDATE automation_jobs SET status = $1, error_message = $2, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $3", [
      status,
      status === "failed" ? String(body.error_message || "Échec worker").slice(0, 500) : null,
      id,
    ]);
    if (status === "completed" && body.output) {
      // Images base64 du worker : jusqu'à ~5 Mo (TEXT SQLite, OK en local).
      const content = JSON.stringify(body.output.content ?? {}).slice(0, 5000000);
      await tx.query(
        `INSERT INTO module_outputs (id, project_id, organization_id, output_type, status, title, content_json)
         VALUES ($1, $2, $3, 'worker_result', 'ready', $4, $5)`,
        [randomUUID(), job.rows[0].project_id, worker.organization_id, String(body.output.title || "Résultat worker").slice(0, 120), content],
      );
    }
  });
  return NextResponse.json({ received: true });
}
