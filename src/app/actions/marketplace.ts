"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getModule } from "@/config/modules";
import { getModuleCapabilities } from "@/config/module-blueprints";
import { marketplaceTemplates } from "@/lib/marketplace";
import { logAudit } from "@/lib/audit";

export async function installTemplateAction(formData: FormData) {
  const session = await requireSession();
  const templateId = String(formData.get("templateId") || "");
  const template = marketplaceTemplates.find((t) => t.id === templateId);
  if (!template) return;
  const module = getModule(template.moduleSlug);
  if (!module) return;
  const db = await getDb();
  const projectId = randomUUID();
  const config = JSON.stringify({
    version: 1,
    kind: "project",
    steps: getModuleCapabilities(module).map((label, index) => ({ id: `step-${index + 1}`, label, enabled: true })),
    inputs: template.inputs,
    externalAccounts: [],
    localPaths: [],
  });
  await db.query(
    `INSERT INTO module_projects (id, organization_id, module_slug, name, description, status, is_example, config_json)
     VALUES ($1, $2, $3, $4, $5, 'draft', 0, $6)`,
    [projectId, session.organization.id, template.moduleSlug, template.name, template.description, config],
  );
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "marketplace.install", entityType: template.moduleSlug, entityId: projectId, metadata: { template: templateId } });
  revalidatePath(`/dashboard/tools/${template.moduleSlug}`);
  redirect(`/dashboard/tools/${template.moduleSlug}/projects/${projectId}`);
}
