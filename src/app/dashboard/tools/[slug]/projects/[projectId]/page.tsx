import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProjectEditor } from "@/components/project-editor";
import { RecipeCreatorStudio } from "@/components/recipe-creator-studio";
import { CreationStudio } from "@/components/creation-studio";
import { SocialStudio } from "@/components/social-studio";
import { getModule } from "@/config/modules";
import { getModuleSettings } from "@/config/module-settings";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getModuleProject, parseProjectConfig } from "@/lib/module-projects";
import { ensureWorkflowGraph, getWorkflowGraph } from "@/lib/workflow-engine";
import { getAutomationSchedule } from "@/lib/automation-engine";
import { listModuleOutputs } from "@/lib/module-outputs";
import { hasBrowserAi } from "@/lib/ai";
import { getWordPressConnection } from "@/lib/wordpress";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string; projectId: string }> }) {
  const { slug, projectId } = await params;
  const module = getModule(slug);
  if (!module) notFound();
  const session = await requireSession();
  const project = await getModuleProject(session.organization.id, slug, projectId);
  if (!project) notFound();
  // Slugs à dashboard dédié (pas de projet) : board, studio local ou rapports.
  if (["reports", "backups", "structures", "mailboxes", "community", "marketplace", "pinterest-keywords", "facebook-spy", "instagram-spy", "social-analytics", "google-trends", "facebook-analytics", "pinterest-scanner", "pinterest-analytics", "video-editor", "mini-canvas", "image-cleaner", "reel-studio"].includes(slug)) notFound();
  const config = parseProjectConfig(project);
  await ensureWorkflowGraph(session.organization.id, project, config);
  const workflow = slug === "workflows" ? await getWorkflowGraph(session.organization.id, project.id) : null;
  const automationSchedule = slug === "automations" ? await getAutomationSchedule(session.organization.id, project.id) : null;
  const outputs = await listModuleOutputs(session.organization.id, project.id);

  if (slug === "recipe-creator") {
    const inputs = (config.inputs || {}) as Record<string, unknown>;
    const initial: Record<string, string> = {
      brief: String(inputs.brief || ""),
      recipeTitle: String(inputs.recipeTitle || ""),
      ingredients: String(inputs.ingredients || ""),
      steps: String(inputs.steps || ""),
      focusKeyword: String(inputs.focusKeyword || ""),
      language: String(inputs.language || "en"),
      metaDescription: String(inputs.metaDescription || ""),
      imageDirection: String(inputs.imageDirection || ""),
      promptFeatured: String(inputs.promptFeatured || ""),
      promptHero: String(inputs.promptHero || ""),
      promptIngredients: String(inputs.promptIngredients || ""),
      promptServing: String(inputs.promptServing || ""),
      seoTitle: String(inputs.seoTitle || ""),
      authorName: String(inputs.authorName || ""),
      internalLinks: String(inputs.internalLinks || ""),
      duplicatePolicy: String(inputs.duplicatePolicy || "ask"),
    };
    const browserAi = await hasBrowserAi(session.organization.id);
    const hasWordPress = Boolean(await getWordPressConnection(session.organization.id));
    // SQLite retourne des objets à prototype null → sérialiser en objets plains pour Client Component.
    const plainOutputs = JSON.parse(JSON.stringify(outputs)) as Array<{ id: string; title: string; content_json: string; created_at: string }>;
    return (
      <DashboardShell eyebrow="Générateur de recettes" title={project.name}>
        <RecipeCreatorStudio projectId={project.id} isExample={Boolean(project.is_example)} initial={initial} outputs={plainOutputs} hasBrowserAi={browserAi} hasWordPress={hasWordPress} />
      </DashboardShell>
    );
  }

  if (slug === "recipe-video" || slug === "cookbook-marketing" || slug === "animated-story") {
    const inputs = (config.inputs || {}) as Record<string, unknown>;
    const initialInputs: Record<string, string> = {};
    for (const setting of getModuleSettings(slug)) initialInputs[setting.key] = String(inputs[setting.key] || "");
    const plainOutputs = JSON.parse(JSON.stringify(outputs)) as Array<{ id: string; title: string; content_json: string; created_at: string }>;
    const plainSettings = JSON.parse(JSON.stringify(getModuleSettings(slug)));
    return (
      <DashboardShell eyebrow={module.name} title={project.name}>
        <CreationStudio moduleSlug={slug} moduleName={module.name} projectId={project.id} isExample={Boolean(project.is_example)} settings={plainSettings} inputs={initialInputs} outputs={plainOutputs} />
      </DashboardShell>
    );
  }

  if (["facebook", "instagram", "pinterest", "facebook-pages", "facebook-groups", "pinterest-accounts"].includes(slug)) {
    const inputs = (config.inputs || {}) as Record<string, unknown>;
    const initialInputs: Record<string, string> = {};
    for (const setting of getModuleSettings(slug)) initialInputs[setting.key] = String(inputs[setting.key] || "");
    const plainOutputs = JSON.parse(JSON.stringify(outputs)) as Array<{ id: string; title: string; content_json: string; created_at: string }>;
    const plainSettings = JSON.parse(JSON.stringify(getModuleSettings(slug)));
    const provider = slug.startsWith("pinterest") ? "pinterest" : "meta";
    const db = await getDb();
    const conn = await db.query<{ id: string }>("SELECT id FROM integration_connections WHERE organization_id = $1 AND provider = $2 AND status = 'connected' LIMIT 1", [session.organization.id, provider]);
    return (
      <DashboardShell eyebrow={module.name} title={project.name}>
        <SocialStudio moduleSlug={slug} moduleName={module.name} projectId={project.id} isExample={Boolean(project.is_example)} settings={plainSettings} inputs={initialInputs} outputs={plainOutputs} hasConnection={Boolean(conn.rows[0])} />
      </DashboardShell>
    );
  }

  return <DashboardShell eyebrow={module.name} title="Projet"><ProjectEditor module={module} project={project} config={config} workflow={workflow} automationSchedule={automationSchedule} outputs={outputs} /></DashboardShell>;
}
