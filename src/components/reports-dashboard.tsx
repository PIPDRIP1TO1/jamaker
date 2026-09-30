import Link from "next/link";
import { getModule } from "@/config/modules";
import type { ModuleCount, ReportSummary } from "@/lib/reports";

export function ReportsDashboard({ summary, modules }: { summary: ReportSummary; modules: ModuleCount[] }) {
  const successRate = summary.automation_jobs ? Math.round((summary.successful_jobs / summary.automation_jobs) * 100) : 0;
  return <>
    <section className="report-hero"><div><span className="pill">Données en temps réel</span><h2>Vue technique de votre organisation.</h2><p>Ces chiffres proviennent uniquement de vos projets et historiques locaux.</p></div><Link className="button" href="/dashboard/automations">Voir les exécutions</Link></section>
    <section className="stat-grid stat-grid-four"><article className="stat-card"><p>Projets</p><strong>{summary.projects}</strong><small>{summary.examples} exemples inclus</small></article><article className="stat-card"><p>Résultats générés</p><strong>{summary.outputs}</strong><small>Outputs privés exportables</small></article><article className="stat-card"><p>Automation jobs</p><strong>{summary.automation_jobs}</strong><small>{summary.workflow_runs} workflow(s) testé(s)</small></article><article className="stat-card"><p>Taux de réussite</p><strong>{successRate}%</strong><small>{summary.failed_jobs} échec(s)</small></article></section>
    <section className="panel report-table"><div className="workspace-topline"><span>Projets par module</span><small>{modules.length} modules utilisés</small></div>{modules.length ? modules.map((row) => { const module = getModule(row.module_slug); return <Link className="report-row" href={`/dashboard/tools/${row.module_slug}`} key={row.module_slug}><div><strong>{module?.name || row.module_slug}</strong><small>{row.private_projects} projet(s) privé(s)</small></div><b>{row.total}</b><span>→</span></Link>; }) : <div className="jobs-empty"><strong>Aucune donnée</strong><p>Ouvrez un module pour créer son exemple sécurisé.</p></div>}</section>
  </>;
}
