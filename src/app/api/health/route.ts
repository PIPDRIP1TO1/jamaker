import { getDb } from "@/lib/db";

function sanitize(message: string) {
  return message
    .replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, "Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9\-_.]+/g, "[redacted-jwt]")
    .slice(0, 200);
}

export async function GET() {
  try {
    const db = await getDb();
    const result = await db.query<{ ok: number }>("SELECT 1 AS ok");
    return Response.json({ status: result.rows[0]?.ok === 1 ? "ok" : "degraded" });
  } catch (error) {
    console.error("JA MAKER database health check failed", error);
    return Response.json({ status: "unavailable", error: sanitize(error instanceof Error ? error.message : String(error)) }, { status: 503 });
  }
}
