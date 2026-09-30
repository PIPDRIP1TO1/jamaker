import { getDb } from "@/lib/db";

// Comptes navigateur (modèle VIRAL CLONER, gratuit) : aucun secret au SaaS.
// Le SaaS déclare le profil ; le worker local l'exécute avec la session
// loggée sur la machine du client. Zéro clé API.
export type BrowserAiAccount = { id: string; provider: string; profile: string };

const browserProviders = ["chatgpt", "gemini", "deepseek", "qwen", "metaai"];

export async function getBrowserAiAccounts(organizationId: string): Promise<BrowserAiAccount[]> {
  const db = await getDb();
  const result = await db.query<{ id: string; provider: string; external_account_label: string | null }>(
    `SELECT id, provider, external_account_label FROM integration_connections
     WHERE organization_id = $1 AND status = 'connected'
     AND provider IN ('chatgpt', 'gemini', 'deepseek', 'qwen', 'metaai')`,
    [organizationId],
  );
  return result.rows.map((row) => ({ id: row.id, provider: row.provider, profile: row.external_account_label || "Profil principal" }));
}

export async function hasBrowserAi(organizationId: string): Promise<boolean> {
  return (await getBrowserAiAccounts(organizationId)).length > 0;
}

export function isBrowserProvider(provider: string) {
  return (browserProviders as string[]).includes(provider);
}
