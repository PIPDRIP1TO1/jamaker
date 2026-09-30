import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();
    const result = await db.query<{ ok: number }>("SELECT 1 AS ok");
    return Response.json({ status: result.rows[0]?.ok === 1 ? "ok" : "degraded" });
  } catch (error) {
    console.error("JA MAKER database health check failed", error);
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
