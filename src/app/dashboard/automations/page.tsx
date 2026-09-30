import { DashboardShell } from "@/components/dashboard-shell";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listAutomationJobs } from "@/lib/automation-engine";
import { cancelAutomationJobAction, retryAutomationJobAction } from "@/app/actions/projects";
import { WorkerPanel } from "@/components/worker-panel";
import { listWorkerTokens } from "@/lib/worker";

export default async function AutomationsPage() {
  const session = await requireSession();
  const jobs = await listAutomationJobs(session.organization.id);
  const tokens = await listWorkerTokens(session.organization.id);
  const completed = jobs.filter((job) => job.status === "completed").length;
  const failed = jobs.filter((job) => job.status === "failed").length;
  const saasUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";
  return (
    <DashboardShell eyebrow="Moteur d'exécution" title="Automatisations">
      <section className="automation-intro"><div><span className="pill">Engine local actif</span><h2>File d&apos;exécution et historique.</h2><p>Les tests techniques valident les étapes sans publier ni contacter un service externe. Le worker local exécute la file avec vos comptes navigateur gratuits.</p></div><Link className="button" href="/dashboard/tools/automations">Gérer les projets</Link></section>
      <section className="stat-grid stat-grid-four"><article className="stat-card"><p>Exécutions</p><strong>{jobs.length}</strong><small>Historique récent</small></article><article className="stat-card"><p>Réussies</p><strong>{completed}</strong><small>Tests validés</small></article><article className="stat-card"><p>Échouées</p><strong>{failed}</strong><small>Éligibles au retry</small></article><article className="stat-card"><p>Retries</p><strong>3</strong><small>Maximum par tâche</small></article></section>
      <WorkerPanel tokens={JSON.parse(JSON.stringify(tokens))} saasUrl={saasUrl} />
      <section className="panel jobs-panel"><div className="workspace-topline"><span>Jobs récents</span><small>Isolation : {session.organization.name}</small></div>{jobs.length ? <div className="jobs-list">{jobs.map((job) => <article className="job-row" key={job.id}><span className={`job-status status-job-${job.status}`}>{job.status}</span><div><strong>{job.project_name}</strong><small>Essai {job.attempt}/{job.max_attempts} · {new Date(job.created_at).toLocaleString("fr-FR")}</small></div><div className="job-actions">{job.status === "failed" && job.attempt < job.max_attempts && <form action={retryAutomationJobAction}><input type="hidden" name="jobId" value={job.id} /><button type="submit">Réessayer</button></form>}{(job.status === "queued" || job.status === "running") && <form action={cancelAutomationJobAction}><input type="hidden" name="jobId" value={job.id} /><button type="submit">Arrêter</button></form>}<Link href={`/dashboard/tools/automations/projects/${job.project_id}`}>Ouvrir</Link></div></article>)}</div> : <div className="jobs-empty"><strong>Aucune exécution</strong><p>Créez une copie de l&apos;exemple Automatisations, puis lancez un test technique.</p></div>}</section>
    </DashboardShell>
  );
}
