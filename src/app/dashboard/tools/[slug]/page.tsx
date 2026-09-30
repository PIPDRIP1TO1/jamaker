import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { ModuleWorkspace } from "@/components/module-workspace";
import { getModule, modules } from "@/config/modules";
import { requireSession } from "@/lib/auth/session";
import { listModuleProjects } from "@/lib/module-projects";
import { getOrganizationReport } from "@/lib/reports";
import { ReportsDashboard } from "@/components/reports-dashboard";
import { BackupDashboard } from "@/components/backup-dashboard";
import { getDb } from "@/lib/db";
import { VideoEditorStudio } from "@/components/video-editor-studio";
import { MiniCanvasStudio } from "@/components/mini-canvas-studio";
import { ImageCleanerStudio } from "@/components/image-cleaner-studio";
import { StructuresDashboard } from "@/components/structures-dashboard";
import { listWorkspaceProfiles } from "@/lib/workspace-profiles";
import { ReelStudio } from "@/components/reel-studio";
import { MessageBoard } from "@/components/message-board";
import { listWorkspaceMessages } from "@/lib/messages";
import { WordPressStudio } from "@/components/wordpress-studio";
import { getWordPressConnection, getWordPressCredentials, listWordPressCategories } from "@/lib/wordpress";
import { MarketplaceBoard } from "@/components/marketplace-board";
import { GmailPanel } from "@/components/gmail-panel";
import { getGoogleConnection, getGoogleVaultData, hasGmailScope } from "@/lib/google";
import { listGmailMessages, type GmailMessage } from "@/lib/gmail";
import { EbookStudio } from "@/components/ebook-studio";
import { listEbookProjects } from "@/lib/ebooks";

export function generateStaticParams() {
  return modules.map((module) => ({ slug: module.slug }));
}

export default async function ModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const module = getModule(slug);
  if (!module) notFound();
  const session = await requireSession();
  if (slug === "reports") {
    const report = await getOrganizationReport(session.organization.id);
    return <DashboardShell eyebrow="Pilotage" title="Rapports"><ReportsDashboard summary={report.summary} modules={report.modules} /></DashboardShell>;
  }
  if (slug === "backups") {
    const db = await getDb();
    const total = await db.query<{ total: number }>("SELECT COUNT(*) AS total FROM module_projects WHERE organization_id = $1", [session.organization.id]);
    return <DashboardShell eyebrow="Protection des données" title="Sauvegardes"><BackupDashboard projectCount={total.rows[0]?.total || 0} /></DashboardShell>;
  }
  if (slug === "video-editor") return <DashboardShell eyebrow="Studio" title="Éditeur vidéo"><VideoEditorStudio /></DashboardShell>;
  if (slug === "mini-canvas") return <DashboardShell eyebrow="Studio" title="Mini Canvas"><MiniCanvasStudio /></DashboardShell>;
  if (slug === "image-cleaner") return <DashboardShell eyebrow="Studio" title="Nettoyage d’image"><ImageCleanerStudio /></DashboardShell>;
  if (slug === "structures") { const profiles = await listWorkspaceProfiles(session.organization.id); return <DashboardShell eyebrow="Gestion" title="Structures"><StructuresDashboard profiles={profiles} /></DashboardShell>; }
  if (slug === "reel-studio") return <DashboardShell eyebrow="Studio" title="Reel Studio"><ReelStudio /></DashboardShell>;
  if (slug === "mailboxes") {
    const items = await listWorkspaceMessages(session.organization.id, "message", slug);
    const googleConn = await getGoogleConnection(session.organization.id);
    let gmail: { email?: string; messages: GmailMessage[] } | null = null;
    let gmailScope = false;
    if (googleConn && googleConn.status === "connected") {
      const vault = await getGoogleVaultData(session.organization.id, googleConn.id);
      gmailScope = hasGmailScope(vault?.tokens?.scope);
      if (gmailScope) gmail = await listGmailMessages(session.organization.id, 10);
    }
    return <DashboardShell eyebrow="Gestion" title="Boîtes mail"><GmailPanel email={gmail?.email} messages={JSON.parse(JSON.stringify(gmail?.messages || []))} hasScope={gmailScope} /><div className="info-strip"><b>Notes workflow.</b> Collez ci-dessous les contenus à réutiliser dans vos automations.</div><MessageBoard kind="message" moduleSlug={slug} moduleName={module.name} items={JSON.parse(JSON.stringify(items))} exportFileName="jamaker-mailbox.json" /></DashboardShell>;
  }
  if (slug === "pinterest-keywords") {
    const items = await listWorkspaceMessages(session.organization.id, "keyword", slug);
    return <DashboardShell eyebrow="Recherche" title={module.name}><div className="info-strip"><b>Collection locale de mots-clés.</b> Les volumes automatiques exigent une connexion Pinterest ; en attendant, constituez votre base manuellement et exportez-la.</div><MessageBoard kind="keyword" moduleSlug={slug} moduleName={module.name} items={JSON.parse(JSON.stringify(items))} exportFileName="jamaker-keywords.json" /></DashboardShell>;
  }
  if (["facebook-spy", "instagram-spy", "social-analytics", "google-trends", "facebook-analytics", "pinterest-scanner", "pinterest-analytics"].includes(slug)) {
    const items = await listWorkspaceMessages(session.organization.id, "signal", slug);
    return <DashboardShell eyebrow="Recherche & analyse" title={module.name}><div className="info-strip"><b>Carnet de signaux public et autorisé.</b> La collecte automatique exige une connexion officielle ; en attendant, consignez ici les signaux observés (liens publics uniquement) et exportez-les vers vos workflows.</div><MessageBoard kind="signal" moduleSlug={slug} moduleName={module.name} items={JSON.parse(JSON.stringify(items))} exportFileName={`jamaker-${slug}.json`} /></DashboardShell>;
  }
  if (slug === "community") {
    const items = await listWorkspaceMessages(session.organization.id, "resource", slug);
    return <DashboardShell eyebrow="Gestion" title="Communauté"><div className="info-strip"><b>Ressources et méthodes validées de votre organisation.</b> Le partage inter-organisations arrivera après modération.</div><MessageBoard kind="resource" moduleSlug={slug} moduleName={module.name} items={JSON.parse(JSON.stringify(items))} exportFileName="jamaker-community.json" /></DashboardShell>;
  }
  if (slug === "wordpress-category") {
    const connection = await getWordPressConnection(session.organization.id);
    const creds = connection ? await getWordPressCredentials(session.organization.id, connection.id) : null;
    if (!creds) {
      const items = await listWorkspaceMessages(session.organization.id, "message", slug);
      return <DashboardShell eyebrow="Création" title="WordPress Auto Category"><div className="info-strip"><b>Connectez WordPress dans Mes connexions</b> pour gérer les catégories et publier. En attendant, préparez votre plan de catégories ci-dessous.</div><MessageBoard kind="message" moduleSlug={slug} moduleName={module.name} items={JSON.parse(JSON.stringify(items))} exportFileName="jamaker-wp-plan.json" /></DashboardShell>;
    }
    const categories = (await listWordPressCategories(creds)) || [];
    return <DashboardShell eyebrow="WordPress" title="Auto Category"><WordPressStudio categories={categories} siteHost={new URL(creds.siteUrl).hostname} /></DashboardShell>;
  }
  if (slug === "marketplace") {
    return <DashboardShell eyebrow="Gestion" title="Marketplace"><MarketplaceBoard /></DashboardShell>;
  }
  const projects = await listModuleProjects(session.organization.id, module);

  if (slug === "cookbook-marketing") {
    const ebooks = await listEbookProjects(session.organization.id);
    return (
      <DashboardShell eyebrow="Créer & vendre" title="Marketing des livres">
        <EbookStudio initialBooks={JSON.parse(JSON.stringify(ebooks))} />
        <div className="hub-section-title"><div><p className="eyebrow">Campagnes</p><h2>Marketing et planification</h2></div><span>Les campagnes restent liées à leurs projets existants.</span></div>
        <ModuleWorkspace module={module} projects={projects} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell eyebrow={module.group} title={module.name}>
      <ModuleWorkspace module={module} projects={projects} />
    </DashboardShell>
  );
}
