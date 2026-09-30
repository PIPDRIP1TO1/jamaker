"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { integrationProviders } from "@/lib/integrations";
import { deleteConnectionSecret, storeConnectionSecret } from "@/lib/vault";
import { normalizeSiteUrl } from "@/lib/wordpress";
import { GOOGLE_SCOPES, googleRedirectUri } from "@/lib/google";
import { logAudit } from "@/lib/audit";

export async function prepareIntegrationAction(formData: FormData) {
  const session = await requireSession();
  const providerId = String(formData.get("provider") || "");
  const provider = integrationProviders.find((item) => item.id === providerId);
  if (!provider) return;
  const db = await getDb();
  await db.query(
    `INSERT INTO integration_connections (id, organization_id, provider, display_name, auth_type, status)
     VALUES ($1, $2, $3, $4, $5, 'draft')
     ON CONFLICT(organization_id, provider, display_name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP`,
    [randomUUID(), session.organization.id, provider.id, `${provider.name} principal`, provider.authType],
  );
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "integration.prepare", entityType: "connection", entityId: providerId });
  revalidatePath("/dashboard/integrations");
}

export async function removeIntegrationDraftAction(formData: FormData) {
  const session = await requireSession();
  const connectionId = String(formData.get("connectionId") || "");
  if (!connectionId) return;
  const db = await getDb();
  await deleteConnectionSecret(session.organization.id, connectionId);
  // Supprime draft + revoked/expired/error. Jamais une connexion active (révoquer d'abord).
  const result = await db.query("DELETE FROM integration_connections WHERE id = $1 AND organization_id = $2 AND status IN ('draft', 'revoked', 'expired', 'error')", [connectionId, session.organization.id]);
  if (!result.rowCount) return;
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "integration.remove", entityType: "connection", entityId: connectionId });
  revalidatePath("/dashboard/integrations");
}

export async function saveApiKeyAction(formData: FormData) {
  const session = await requireSession();
  const connectionId = String(formData.get("connectionId") || "");
  const apiKey = String(formData.get("apiKey") || "").trim();
  if (!connectionId || apiKey.length < 8) return;
  const db = await getDb();
  const owned = await db.query<{ auth_type: string }>("SELECT auth_type FROM integration_connections WHERE id = $1 AND organization_id = $2 LIMIT 1", [connectionId, session.organization.id]);
  if (!owned.rows[0] || owned.rows[0].auth_type !== "api_key") return;
  await storeConnectionSecret(session.organization.id, connectionId, apiKey, "api_key");
  await db.query("UPDATE integration_connections SET status = 'connected', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND organization_id = $2", [connectionId, session.organization.id]);
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "integration.apikey.saved", entityType: "connection", entityId: connectionId });
  revalidatePath("/dashboard/integrations");
}

export async function saveWordPressAction(formData: FormData) {
  const session = await requireSession();
  const connectionId = String(formData.get("connectionId") || "");
  const siteUrl = normalizeSiteUrl(String(formData.get("siteUrl") || ""));
  const username = String(formData.get("username") || "").trim().slice(0, 120);
  const appPassword = String(formData.get("appPassword") || "").trim().replace(/\s+/g, "");
  if (!connectionId || !siteUrl || username.length < 2 || appPassword.length < 8) return;
  const db = await getDb();
  const owned = await db.query<{ provider: string }>("SELECT provider FROM integration_connections WHERE id = $1 AND organization_id = $2 LIMIT 1", [connectionId, session.organization.id]);
  if (!owned.rows[0] || owned.rows[0].provider !== "wordpress") return;
  await storeConnectionSecret(session.organization.id, connectionId, JSON.stringify({ siteUrl, username, appPassword }), "wordpress-app-password");
  const host = new URL(siteUrl).hostname;
  await db.query("UPDATE integration_connections SET status = 'connected', external_account_label = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND organization_id = $3", [`${username}@${host}`, connectionId, session.organization.id]);
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "integration.wordpress.saved", entityType: "connection", entityId: connectionId, metadata: { host } });
  revalidatePath("/dashboard/integrations");
}

export async function saveGoogleOAuthAppAction(formData: FormData) {
  const session = await requireSession();
  const connectionId = String(formData.get("connectionId") || "");
  const clientId = String(formData.get("clientId") || "").trim();
  const clientSecret = String(formData.get("clientSecret") || "").trim();
  if (!connectionId || clientId.length < 10 || clientSecret.length < 8) return;
  if (!clientId.endsWith(".apps.googleusercontent.com")) return;
  const db = await getDb();
  const owned = await db.query<{ provider: string }>("SELECT provider FROM integration_connections WHERE id = $1 AND organization_id = $2 LIMIT 1", [connectionId, session.organization.id]);
  if (!owned.rows[0] || owned.rows[0].provider !== "google") return;
  await storeConnectionSecret(session.organization.id, connectionId, JSON.stringify({ app: { clientId, clientSecret } }), "google-oauth-app");
  await db.query("UPDATE integration_connections SET external_account_label = 'App configurée — compte à lier', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND organization_id = $2", [connectionId, session.organization.id]);
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "integration.google.app_saved", entityType: "connection", entityId: connectionId });
  revalidatePath("/dashboard/integrations");
}

export async function buildGoogleAuthUrl(organizationId: string, connectionId: string): Promise<string | null> {
  const db = await getDb();
  const owned = await db.query<{ id: string }>("SELECT id FROM integration_connections WHERE id = $1 AND organization_id = $2 AND provider = 'google' LIMIT 1", [connectionId, organizationId]);
  if (!owned.rows[0]) return null;
  const state = `${connectionId}.${Date.now().toString(36)}`;
  await db.query("UPDATE integration_connections SET metadata_json = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [JSON.stringify({ oauth_state: state, oauth_state_at: new Date().toISOString() }), connectionId]);
  // Client ID lu depuis le coffre (jamais exposé au navigateur sauf dans l'URL OAuth officielle).
  const { readConnectionSecret } = await import("@/lib/vault");
  let clientId = "";
  try {
    const parsed = JSON.parse((await readConnectionSecret(organizationId, connectionId)) || "{}") as { app?: { clientId?: string } };
    clientId = parsed.app?.clientId || "";
  } catch {
    return null;
  }
  if (!clientId) return null;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function saveProxyAction(formData: FormData) {
  const session = await requireSession();
  const connectionId = String(formData.get("connectionId") || "");
  const host = String(formData.get("host") || "").trim().replace(/^https?:\/\//, "").split("/")[0].slice(0, 200);
  const port = Math.max(1, Math.min(65535, Number(formData.get("port") || 0)));
  const type = String(formData.get("type") || "http");
  const username = String(formData.get("username") || "").trim().slice(0, 120);
  const password = String(formData.get("password") || "").trim().slice(0, 200);
  if (!connectionId || !host || !port || (type !== "http" && type !== "socks5")) return;
  const db = await getDb();
  const owned = await db.query<{ provider: string }>("SELECT provider FROM integration_connections WHERE id = $1 AND organization_id = $2 LIMIT 1", [connectionId, session.organization.id]);
  if (!owned.rows[0] || owned.rows[0].provider !== "proxy") return;
  await storeConnectionSecret(session.organization.id, connectionId, JSON.stringify({ host, port, type, username, password }), "proxy");
  await db.query("UPDATE integration_connections SET status = 'connected', external_account_label = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND organization_id = $3", [`${type}://${host}:${port}`, connectionId, session.organization.id]);
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "integration.proxy.saved", entityType: "connection", entityId: connectionId });
  revalidatePath("/dashboard/integrations");
}

export async function connectBrowserProfileAction(formData: FormData) {
  // Compte navigateur (modèle VIRAL CLONER, gratuit) : on déclare le profil ici,
  // la session loggée reste sur la machine du client. AUCUN secret stocké.
  const session = await requireSession();
  const connectionId = String(formData.get("connectionId") || "");
  const profile = String(formData.get("profile") || "").trim().slice(0, 80) || "Profil principal";
  if (!connectionId) return;
  const db = await getDb();
  const owned = await db.query<{ provider: string }>("SELECT provider FROM integration_connections WHERE id = $1 AND organization_id = $2 LIMIT 1", [connectionId, session.organization.id]);
  if (!owned.rows[0]) return;
  const { isBrowserProvider } = await import("@/lib/ai");
  if (!isBrowserProvider(owned.rows[0].provider)) return;
  await deleteConnectionSecret(session.organization.id, connectionId);
  await db.query("UPDATE integration_connections SET auth_type = 'browser_profile', status = 'connected', external_account_label = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND organization_id = $3", [profile, connectionId, session.organization.id]);
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "integration.browser.connected", entityType: "connection", entityId: connectionId, metadata: { profile } });
  revalidatePath("/dashboard/integrations");
}

export async function connectDevAction(formData: FormData) {
  // Simulation OAuth dev : stocke un jeton factice chiffré, sans passer par le navigateur après stockage.
  const session = await requireSession();
  const connectionId = String(formData.get("connectionId") || "");
  const label = String(formData.get("label") || "").trim().slice(0, 80) || "compte-dev";
  if (!connectionId) return;
  const db = await getDb();
  const owned = await db.query<{ auth_type: string }>("SELECT auth_type FROM integration_connections WHERE id = $1 AND organization_id = $2 LIMIT 1", [connectionId, session.organization.id]);
  if (!owned.rows[0] || owned.rows[0].auth_type !== "oauth") return;
  await storeConnectionSecret(session.organization.id, connectionId, `dev-oauth:${randomUUID()}`, "dev-oauth");
  await db.query("UPDATE integration_connections SET status = 'connected', external_account_label = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND organization_id = $3", [label, connectionId, session.organization.id]);
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "integration.oauth.dev_connected", entityType: "connection", entityId: connectionId, metadata: { label } });
  revalidatePath("/dashboard/integrations");
}

export async function revokeConnectionAction(formData: FormData) {
  const session = await requireSession();
  const connectionId = String(formData.get("connectionId") || "");
  if (!connectionId) return;
  const db = await getDb();
  const owned = await db.query<{ provider: string }>("SELECT provider FROM integration_connections WHERE id = $1 AND organization_id = $2 LIMIT 1", [connectionId, session.organization.id]);
  const provider = owned.rows[0]?.provider;
  // Révocation réelle côté fournisseur quand possible (best-effort, n'empêche jamais la révocation locale).
  if (provider === "google") {
    try {
      const { readConnectionSecret } = await import("@/lib/vault");
      const raw = await readConnectionSecret(session.organization.id, connectionId);
      const tokens = (JSON.parse(raw || "{}") as { tokens?: { access_token?: string } }).tokens;
      if (tokens?.access_token) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokens.access_token)}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      }
    } catch {
      // secret illisible ou réseau HS : révocation locale quand même
    }
  }
  await deleteConnectionSecret(session.organization.id, connectionId);
  await db.query("UPDATE integration_connections SET status = 'revoked', external_account_label = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND organization_id = $2", [connectionId, session.organization.id]);
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "integration.revoke", entityType: "connection", entityId: connectionId, metadata: { provider: provider || null } });
  revalidatePath("/dashboard/integrations");
}
