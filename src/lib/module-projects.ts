import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import type { JaMakerModule } from "@/config/modules";
import { getModuleCapabilities } from "@/config/module-blueprints";

export type ModuleProject = {
  id: string;
  module_slug: string;
  name: string;
  description: string;
  status: "draft" | "ready" | "running" | "completed" | "failed";
  is_example: number;
  source_project_id: string | null;
  config_json?: string;
  updated_at: string;
};

export type ProjectConfig = {
  version: number;
  kind: string;
  steps: Array<{ id: string; label: string; enabled: boolean }>;
  inputs: Record<string, unknown>;
  externalAccounts: string[];
  localPaths: string[];
};

function exampleConfig(module: JaMakerModule) {
  return JSON.stringify({
    version: 1,
    kind: "safe-example",
    steps: getModuleCapabilities(module).map((label, index) => ({ id: `step-${index + 1}`, label, enabled: true })),
    inputs: {},
    externalAccounts: [],
    localPaths: [],
  });
}

export async function listModuleProjects(organizationId: string, module: JaMakerModule) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const seeded = await tx.query<{ organization_id: string }>(
      "SELECT organization_id FROM module_example_seed_state WHERE organization_id = $1 AND module_slug = $2 LIMIT 1",
      [organizationId, module.slug],
    );
    if (!seeded.rows.length) {
      await tx.query(
        `INSERT INTO module_projects (id, organization_id, module_slug, name, description, status, is_example, config_json)
         VALUES ($1, $2, $3, $4, $5, 'ready', 1, $6)`,
        [randomUUID(), organizationId, module.slug, `Exemple — ${module.name}`, `Modèle de démonstration sans compte, chemin local ou donnée personnelle.`, exampleConfig(module)],
      );
      await tx.query(
        "INSERT INTO module_example_seed_state (organization_id, module_slug) VALUES ($1, $2)",
        [organizationId, module.slug],
      );
    }
  });

  const result = await db.query<ModuleProject>(
    `SELECT id, module_slug, name, description, status, is_example, source_project_id, updated_at
     FROM module_projects WHERE organization_id = $1 AND module_slug = $2
     ORDER BY is_example DESC, datetime(updated_at) DESC`,
    [organizationId, module.slug],
  );
  return result.rows;
}

export async function getModuleProject(organizationId: string, moduleSlug: string, projectId: string) {
  const db = await getDb();
  const result = await db.query<ModuleProject>(
    `SELECT id, module_slug, name, description, status, is_example, source_project_id, config_json, updated_at
     FROM module_projects WHERE id = $1 AND organization_id = $2 AND module_slug = $3 LIMIT 1`,
    [projectId, organizationId, moduleSlug],
  );
  return result.rows[0] || null;
}

export function parseProjectConfig(project: ModuleProject): ProjectConfig {
  try {
    const parsed = JSON.parse(project.config_json || "{}") as Partial<ProjectConfig>;
    return {
      version: parsed.version || 1,
      kind: parsed.kind || "project",
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      inputs: parsed.inputs && typeof parsed.inputs === "object" ? parsed.inputs : {},
      externalAccounts: Array.isArray(parsed.externalAccounts) ? parsed.externalAccounts : [],
      localPaths: Array.isArray(parsed.localPaths) ? parsed.localPaths : [],
    };
  } catch {
    return { version: 1, kind: "project", steps: [], inputs: {}, externalAccounts: [], localPaths: [] };
  }
}
