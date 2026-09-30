import { getDb } from "@/lib/db";

export type OrgRole = "owner" | "admin" | "member";

export type OrgMember = {
  user_id: string;
  name: string;
  email: string;
  role: OrgRole;
  created_at: string;
};

export type OrgInvitation = {
  id: string;
  email: string;
  role: "admin" | "member";
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

const rank: Record<OrgRole, number> = { owner: 0, admin: 1, member: 2 };

export function canManageTeam(role: OrgRole) {
  return rank[role] <= rank.admin;
}

export function canAdminister(role: OrgRole) {
  return role === "owner";
}

export async function listOrgMembers(organizationId: string): Promise<OrgMember[]> {
  const db = await getDb();
  const result = await db.query<OrgMember>(
    `SELECT u.id AS user_id, u.name, u.email, om.role, om.created_at
     FROM organization_members om JOIN users u ON u.id = om.user_id
     WHERE om.organization_id = $1 ORDER BY om.created_at`,
    [organizationId],
  );
  return result.rows;
}

export async function listOrgInvitations(organizationId: string): Promise<OrgInvitation[]> {
  const db = await getDb();
  const result = await db.query<OrgInvitation>(
    `SELECT id, email, role, expires_at, accepted_at, created_at
     FROM organization_invitations WHERE organization_id = $1
     ORDER BY datetime(created_at) DESC LIMIT 50`,
    [organizationId],
  );
  return result.rows;
}

export async function countOwners(organizationId: string) {
  const db = await getDb();
  const result = await db.query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM organization_members WHERE organization_id = $1 AND role = 'owner'`,
    [organizationId],
  );
  return Number(result.rows[0]?.total || 0);
}
