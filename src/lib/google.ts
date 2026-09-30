import { getDb } from "@/lib/db";
import { readConnectionSecret } from "@/lib/vault";

export type GoogleAppCredentials = { clientId: string; clientSecret: string };
export type GoogleTokens = { access_token: string; refresh_token?: string; expires_at: number; scope?: string; email?: string };
export type GoogleVaultData = { app: GoogleAppCredentials; tokens?: GoogleTokens };

export const GOOGLE_SCOPES = ["openid", "email", "profile", "https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.compose"];

export function hasGmailScope(scope?: string) {
  return Boolean(scope && scope.includes("gmail.readonly"));
}

export function googleRedirectUri() {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100").replace(/\/$/, "");
  return `${base}/api/oauth/google/callback`;
}

export async function getGoogleConnection(organizationId: string) {
  const db = await getDb();
  const result = await db.query<{ id: string; status: string; external_account_label: string | null; metadata_json: string }>(
    "SELECT id, status, external_account_label, metadata_json FROM integration_connections WHERE organization_id = $1 AND provider = 'google' LIMIT 1",
    [organizationId],
  );
  return result.rows[0] || null;
}

export async function getGoogleVaultData(organizationId: string, connectionId: string): Promise<GoogleVaultData | null> {
  const raw = await readConnectionSecret(organizationId, connectionId);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GoogleVaultData>;
    if (!parsed.app?.clientId || !parsed.app?.clientSecret) return null;
    return parsed as GoogleVaultData;
  } catch {
    return null;
  }
}

export async function getValidGoogleAccessToken(organizationId: string): Promise<{ token: string; email?: string } | null> {
  const db = await getDb();
  const conn = await getGoogleConnection(organizationId);
  if (!conn || conn.status !== "connected") return null;
  const data = await getGoogleVaultData(organizationId, conn.id);
  const tokens = data?.tokens;
  if (!tokens?.access_token) return null;
  if (tokens.expires_at > Date.now() + 60000) return { token: tokens.access_token, email: tokens.email };
  if (!tokens.refresh_token || !data?.app) return null;
  // Refresh silencieux.
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: data.app.clientId,
        client_secret: data.app.clientSecret,
        refresh_token: tokens.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) {
      await db.query("UPDATE integration_connections SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [conn.id]);
      return null;
    }
    const refreshed = (await res.json()) as { access_token: string; expires_in: number; scope?: string };
    const { encryptSecret } = await import("@/lib/crypto");
    const next: GoogleVaultData = {
      app: data.app,
      tokens: {
        access_token: refreshed.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + refreshed.expires_in * 1000,
        scope: refreshed.scope,
        email: tokens.email,
      },
    };
    const { encryptedValue, iv, authTag } = encryptSecret(JSON.stringify(next));
    await db.query("UPDATE integration_secrets SET encrypted_value = $1, iv = $2, auth_tag = $3, updated_at = CURRENT_TIMESTAMP WHERE connection_id = $4", [encryptedValue, iv, authTag, conn.id]);
    return { token: refreshed.access_token, email: tokens.email };
  } catch {
    return null;
  }
}

export async function fetchGoogleProfile(accessToken: string) {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as { email?: string; name?: string; picture?: string };
}
