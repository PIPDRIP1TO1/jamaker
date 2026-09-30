import { getDb } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";

export const integrationProviders = [
  { id: "chatgpt", name: "ChatGPT (Navigateur)", description: "Compte web gratuit, piloté par le worker local.", initials: "AI", color: "green", authType: "browser_profile", group: "navigateur" },
  { id: "gemini", name: "Gemini (Navigateur)", description: "Compte Google gratuit, piloté par le worker local.", initials: "✦", color: "orange", authType: "browser_profile", group: "navigateur" },
  { id: "deepseek", name: "DeepSeek (Navigateur)", description: "Compte web gratuit, piloté par le worker local.", initials: "D", color: "blue", authType: "browser_profile", group: "navigateur" },
  { id: "qwen", name: "Qwen (Navigateur)", description: "Compte web gratuit, piloté par le worker local.", initials: "Q", color: "violet", authType: "browser_profile", group: "navigateur" },
  { id: "metaai", name: "Meta AI (Navigateur)", description: "Compte web gratuit, piloté par le worker local.", initials: "MA", color: "violet", authType: "browser_profile", group: "navigateur" },
  { id: "meta", name: "Meta Business", description: "Instagram, Facebook Pages et planification.", initials: "M", color: "violet", authType: "oauth", group: "publication" },
  { id: "google", name: "Google / Gmail", description: "Identité OAuth, Gmail et services Google.", initials: "G", color: "blue", authType: "oauth", group: "publication" },
  { id: "wordpress", name: "WordPress", description: "Publication en brouillon sur votre site.", initials: "W", color: "blue", authType: "api_key", group: "publication" },
  { id: "pinterest", name: "Pinterest", description: "Comptes, boards et publications.", initials: "P", color: "orange", authType: "oauth", group: "publication" },
  { id: "serpapi", name: "SerpAPI", description: "Volumes et tendances Google pour la recherche.", initials: "S", color: "green", authType: "api_key", group: "recherche" },
  { id: "pexels", name: "Pexels", description: "Images libres pour vos créations.", initials: "Px", color: "green", authType: "api_key", group: "outils" },
  { id: "imgbb", name: "Hébergement images", description: "Clé ImgBB/Cloudinary pour héberger les visuels.", initials: "Im", color: "blue", authType: "api_key", group: "outils" },
  { id: "twocaptcha", name: "2Captcha", description: "Résolution de captchas pour les automations.", initials: "2C", color: "orange", authType: "api_key", group: "outils" },
  { id: "telegram", name: "Telegram", description: "Alertes et notifications de vos automations.", initials: "T", color: "blue", authType: "api_key", group: "outils" },
  { id: "proxy", name: "Proxy", description: "HTTP/SOCKS5 pour les connexions sortantes.", initials: "Px", color: "violet", authType: "api_key", group: "outils" },
] as const;

export const providerGroups = [
  { id: "navigateur", label: "Comptes navigateur — gratuit, via worker local" },
  { id: "publication", label: "Publication" },
  { id: "recherche", label: "Recherche" },
  { id: "outils", label: "Outils" },
] as const;

export type IntegrationConnection = { id: string; provider: string; display_name: string; auth_type: string; status: "draft" | "connected" | "expired" | "error" | "revoked"; external_account_label: string | null; updated_at: string; has_secret: number; secret_ok: number };

export async function listIntegrationConnections(organizationId: string) {
  const db = await getDb();
  // Ne jamais retourner le secret : uniquement des booléens + métadonnées.
  // secret_ok = 0 si le secret ne déchiffre plus (ex. JAMAKER_VAULT_KEY changée) → à reconnecter.
  const result = await db.query<IntegrationConnection & { encrypted_value?: string; iv?: string; auth_tag?: string }>(
    `SELECT c.id, c.provider, c.display_name, c.auth_type, c.status, c.external_account_label, c.updated_at,
            CASE WHEN s.connection_id IS NULL THEN 0 ELSE 1 END AS has_secret,
            s.encrypted_value, s.iv, s.auth_tag
     FROM integration_connections c LEFT JOIN integration_secrets s ON s.connection_id = c.id
     WHERE c.organization_id = $1 ORDER BY c.provider, c.created_at`,
    [organizationId],
  );
  return result.rows.map((row) => {
    let secretOk = row.has_secret ? 1 : 0;
    if (row.has_secret && row.encrypted_value && row.iv && row.auth_tag) {
      try {
        decryptSecret(row.encrypted_value, row.iv, row.auth_tag);
      } catch {
        secretOk = 0;
      }
    }
    const { encrypted_value: _e, iv: _i, auth_tag: _a, ...connection } = row;
    return { ...connection, secret_ok: secretOk };
  });
}
