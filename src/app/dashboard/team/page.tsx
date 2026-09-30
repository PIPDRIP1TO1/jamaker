import { DashboardShell } from "@/components/dashboard-shell";
import { requireSession } from "@/lib/auth/session";
import { listOrgInvitations, listOrgMembers, canManageTeam } from "@/lib/team";
import { removeMemberAction, revokeInvitationAction, updateMemberRoleAction } from "@/app/actions/team";
import { TeamInviteForm } from "@/components/team-invite-form";

export default async function TeamPage() {
  const session = await requireSession();
  const [members, invitations] = await Promise.all([
    listOrgMembers(session.organization.id),
    listOrgInvitations(session.organization.id),
  ]);
  const canManage = canManageTeam(session.role);
  const pending = invitations.filter((inv) => !inv.accepted_at);

  return (
    <DashboardShell eyebrow="Organisation" title={`Équipe — ${session.organization.name}`}>
      <section className="panel">
        <div className="workspace-topline"><span>Membres ({members.length})</span><small>Votre rôle : {session.role}</small></div>
        <div className="jobs-list">
          {members.map((member) => (
            <article className="job-row" key={member.user_id}>
              <span className="pill">{member.role}</span>
              <div><strong>{member.name}</strong><small>{member.email}</small></div>
              <div className="job-actions">
                {canManage && member.user_id !== session.user.id && session.role === "owner" && (
                  <form action={updateMemberRoleAction}>
                    <input type="hidden" name="userId" value={member.user_id} />
                    <select name="role" defaultValue={member.role} aria-label="Rôle">
                      <option value="member">member</option>
                      <option value="admin">admin</option>
                      <option value="owner">owner</option>
                    </select>
                    <button type="submit">Changer</button>
                  </form>
                )}
                {canManage && member.user_id !== session.user.id && (
                  <form action={removeMemberAction}>
                    <input type="hidden" name="userId" value={member.user_id} />
                    <button type="submit">Retirer</button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {canManage && (
        <section className="panel">
          <div className="workspace-topline"><span>Inviter un membre</span><small>Lien valide 7 jours, lié à l&apos;e-mail</small></div>
          <TeamInviteForm canInviteAdmin={session.role === "owner"} />
          <p className="billing-note">Sans envoi e-mail pour l&apos;instant : copiez le lien généré après création et envoyez-le vous-même. L&apos;acceptation exige une connexion avec le même e-mail.</p>
        </section>
      )}

      {canManage && pending.length > 0 && (
        <section className="panel">
          <div className="workspace-topline"><span>Invitations en attente ({pending.length})</span></div>
          <div className="jobs-list">
            {pending.map((inv) => (
              <article className="job-row" key={inv.id}>
                <span className="pill">{inv.role}</span>
                <div><strong>{inv.email}</strong><small>Expire : {new Date(inv.expires_at).toLocaleString("fr-FR")}</small></div>
                <div className="job-actions">
                  <form action={revokeInvitationAction}>
                    <input type="hidden" name="invitationId" value={inv.id} />
                    <button type="submit">Révoquer</button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </DashboardShell>
  );
}
