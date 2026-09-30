import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { fetchGoogleProfile, googleRedirectUri, type GoogleVaultData } from "@/lib/google";
import { readConnectionSecret } from "@/lib/vault";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";
  const fail = (reason: string) => NextResponse.redirect(`${base}/dashboard/integrations?google=${reason}`);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  if (error) return fail("denied");
  if (!code || !state) return fail("invalid");

  const db = await getDb();
  const [connectionId] = state.split(".");
  if (!connectionId) return fail("invalid");
  const conn = await db.query<{ id: string; organization_id: string; metadata_json: string }>(
    "SELECT id, organization_id, metadata_json FROM integration_connections WHERE id = $1 AND provider = 'google' LIMIT 1",
    [connectionId],
  );
  const connection = conn.rows[0];
  if (!connection) return fail("invalid");
  let savedState = "";
  try {
    savedState = (JSON.parse(connection.metadata_json || "{}") as { oauth_state?: string }).oauth_state || "";
  } catch {
    return fail("invalid");
  }
  if (!savedState || savedState !== state) return fail("invalid");

  let app: { clientId: string; clientSecret: string } | null = null;
  try {
    const parsed = JSON.parse((await readConnectionSecret(connection.organization_id, connection.id)) || "{}") as Partial<GoogleVaultData>;
    if (parsed.app?.clientId && parsed.app?.clientSecret) app = parsed.app;
  } catch {
    return fail("invalid");
  }
  if (!app) return fail("invalid");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: app.clientId,
      client_secret: app.clientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return fail("exchange-failed");
  const tokens = (await tokenRes.json()) as { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
  if (!tokens.access_token) return fail("exchange-failed");

  const profile = await fetchGoogleProfile(tokens.access_token);
  const data: GoogleVaultData = {
    app,
    tokens: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope,
      email: profile?.email,
    },
  };
  const { encryptedValue, iv, authTag } = encryptSecret(JSON.stringify(data));
  await db.query("UPDATE integration_secrets SET encrypted_value = $1, iv = $2, auth_tag = $3, updated_at = CURRENT_TIMESTAMP WHERE connection_id = $4", [encryptedValue, iv, authTag, connection.id]);
  await db.query("UPDATE integration_connections SET status = 'connected', external_account_label = $1, metadata_json = '{}', updated_at = CURRENT_TIMESTAMP WHERE id = $2", [profile?.email || "Compte Google lié", connection.id]);
  await logAudit({ organizationId: connection.organization_id, userId: null, action: "integration.google.connected", entityType: "connection", entityId: connection.id, metadata: { email: profile?.email || null } });
  return NextResponse.redirect(`${base}/dashboard/integrations?google=connected`);
}
