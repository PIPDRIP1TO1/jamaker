import { DashboardShell } from "@/components/dashboard-shell";
import { requireSession } from "@/lib/auth/session";
import { listAuditLogs } from "@/lib/audit";

export default async function AuditPage() {
  const session = await requireSession();
  const logs = await listAuditLogs(session.organization.id, 80);
  return (
    <DashboardShell eyebrow="Traçabilité" title="Journal d'audit">
      <section className="panel">
        <div className="workspace-topline"><span>{logs.length} actions sensibles</span><small>{session.organization.name}</small></div>
        {logs.length ? (
          <div className="jobs-list">
            {logs.map((log) => (
              <article className="job-row" key={log.id}>
                <span className="pill">{log.action}</span>
                <div>
                  <strong>{log.entity_type || "—"} {log.entity_id ? `· ${log.entity_id.slice(0, 8)}` : ""}</strong>
                  <small>{new Date(log.created_at).toLocaleString("fr-FR")} · {log.metadata_json}</small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="jobs-empty"><strong>Aucune action tracée</strong><p>Invitations, paiements, connexions et exécutions apparaîtront ici.</p></div>
        )}
      </section>
    </DashboardShell>
  );
}
