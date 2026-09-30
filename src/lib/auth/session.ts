import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";

const COOKIE_NAME = "jamaker_session";
const SESSION_DAYS = 30;

type SessionRow = {
  session_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  subscription_status: "trial" | "active" | "past_due" | "paused" | "cancelled";
  role: "owner" | "admin" | "member";
  expires_at: Date;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, organizationId: string) {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await db.query(
    `INSERT INTO sessions (id, user_id, organization_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), userId, organizationId, hashToken(token), expiresAt.toISOString()],
  );

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function getCurrentSession() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const db = await getDb();
  const result = await db.query<SessionRow>(
    `SELECT
       s.id AS session_id,
       u.id AS user_id,
       u.name AS user_name,
       u.email AS user_email,
       o.id AS organization_id,
       o.name AS organization_name,
       o.slug AS organization_slug,
       o.subscription_status,
       om.role,
       s.expires_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN organizations o ON o.id = s.organization_id
     JOIN organization_members om ON om.organization_id = o.id AND om.user_id = u.id
     WHERE s.token_hash = $1 AND datetime(s.expires_at) > datetime('now')
     LIMIT 1`,
    [hashToken(token)],
  );

  const session = result.rows[0];
  // Next 16 : lecture seule ici (Server Component). Pas de delete : le cookie
  // périmé est simplement ignoré, et écrasé au prochain login.
  if (!session) return null;

  await db.query("UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = $1", [session.session_id]);

  return {
    user: { id: session.user_id, name: session.user_name, email: session.user_email },
    organization: {
      id: session.organization_id,
      name: session.organization_name,
      slug: session.organization_slug,
      subscriptionStatus: session.subscription_status,
    },
    role: session.role,
  };
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    const db = await getDb();
    await db.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  }
  cookieStore.delete(COOKIE_NAME);
}
