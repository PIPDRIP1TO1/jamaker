"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { canManageTeam, countOwners } from "@/lib/team";
import { logAudit } from "@/lib/audit";

export type TeamState = { message?: string; inviteLink?: string };

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function inviteMemberAction(_state: TeamState, formData: FormData): Promise<TeamState> {
  const session = await requireSession();
  if (!canManageTeam(session.role)) return { message: "Seuls owner et admin peuvent inviter." };

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "member");
  if (!/^\S+@\S+\.\S+$/.test(email)) return { message: "E-mail invalide." };
  if (role !== "admin" && role !== "member") return { message: "Rôle invalide." };
  if (session.role !== "owner" && role === "admin") return { message: "Seul owner peut inviter un admin." };

  const db = await getDb();
  const existingMember = await db.query<{ user_id: string }>(
    `SELECT om.user_id FROM organization_members om JOIN users u ON u.id = om.user_id
     WHERE om.organization_id = $1 AND LOWER(u.email) = $2 LIMIT 1`,
    [session.organization.id, email],
  );
  if (existingMember.rows.length) return { message: "Cet utilisateur est déjà membre." };

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const id = randomUUID();
  await db.query(
    `INSERT INTO organization_invitations (id, organization_id, email, role, token_hash, expires_at, invited_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, session.organization.id, email, role, hashToken(token), expiresAt, session.user.id],
  );
  await logAudit({
    organizationId: session.organization.id,
    userId: session.user.id,
    action: "team.invite",
    entityType: "invitation",
    entityId: id,
    metadata: { email, role },
  });
  revalidatePath("/dashboard/team");
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";
  return { inviteLink: `${base}/invite/${token}`, message: `Invitation créée pour ${email}. Partagez le lien (valide 7 jours).` };
}

export async function revokeInvitationAction(formData: FormData) {
  const session = await requireSession();
  if (!canManageTeam(session.role)) return;
  const id = String(formData.get("invitationId") || "");
  if (!id) return;
  const db = await getDb();
  await db.query("DELETE FROM organization_invitations WHERE id = $1 AND organization_id = $2 AND accepted_at IS NULL", [id, session.organization.id]);
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "team.invite.revoke", entityType: "invitation", entityId: id });
  revalidatePath("/dashboard/team");
}

export async function removeMemberAction(formData: FormData) {
  const session = await requireSession();
  if (!canManageTeam(session.role)) return;
  const userId = String(formData.get("userId") || "");
  if (!userId || userId === session.user.id) return;
  const db = await getDb();
  const target = await db.query<{ role: string }>("SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1", [session.organization.id, userId]);
  const targetRole = target.rows[0]?.role;
  if (!targetRole) return;
  if (targetRole === "owner") {
    const owners = await countOwners(session.organization.id);
    if (owners <= 1) return;
    if (session.role !== "owner") return;
  }
  await db.query("DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2", [session.organization.id, userId]);
  await db.query("DELETE FROM sessions WHERE user_id = $1 AND organization_id = $2", [userId, session.organization.id]);
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "team.remove", entityType: "member", entityId: userId });
  revalidatePath("/dashboard/team");
}

export async function updateMemberRoleAction(formData: FormData) {
  const session = await requireSession();
  if (session.role !== "owner") return;
  const userId = String(formData.get("userId") || "");
  const role = String(formData.get("role") || "");
  if (!userId || (role !== "admin" && role !== "member" && role !== "owner")) return;
  if (userId === session.user.id) return;
  const db = await getDb();
  if (role !== "owner") {
    const current = await db.query<{ role: string }>("SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1", [session.organization.id, userId]);
    if (current.rows[0]?.role === "owner") {
      const owners = await countOwners(session.organization.id);
      if (owners <= 1) return;
    }
  }
  await db.query("UPDATE organization_members SET role = $1 WHERE organization_id = $2 AND user_id = $3", [role, session.organization.id, userId]);
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "team.role", entityType: "member", entityId: userId, metadata: { role } });
  revalidatePath("/dashboard/team");
}

export async function acceptInvitationAction(token: string) {
  const session = await requireSession();
  const db = await getDb();
  const result = await db.query<{ id: string; organization_id: string; email: string; role: string; expires_at: string; accepted_at: string | null }>(
    "SELECT id, organization_id, email, role, expires_at, accepted_at FROM organization_invitations WHERE token_hash = $1 LIMIT 1",
    [hashToken(token)],
  );
  const invitation = result.rows[0];
  if (!invitation || invitation.accepted_at) redirect("/dashboard?invite=invalid");
  if (new Date(invitation.expires_at).getTime() < Date.now()) redirect("/dashboard?invite=expired");
  if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) redirect("/login?invite=email-mismatch");

  await db.transaction(async (tx) => {
    await tx.query("INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT(organization_id, user_id) DO UPDATE SET role = $3", [invitation.organization_id, session.user.id, invitation.role]);
    await tx.query("UPDATE organization_invitations SET accepted_at = CURRENT_TIMESTAMP WHERE id = $1", [invitation.id]);
  });
  await logAudit({ organizationId: invitation.organization_id, userId: session.user.id, action: "team.accept", entityType: "invitation", entityId: invitation.id });
  redirect("/dashboard?invite=accepted");
}
