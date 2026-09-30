import { DashboardShell } from "@/components/dashboard-shell";
import { requireSession } from "@/lib/auth/session";
import { integrationProviders, listIntegrationConnections } from "@/lib/integrations";
import { isVaultConfigured } from "@/lib/crypto";
import { buildGoogleAuthUrl, connectBrowserProfileAction, connectDevAction, prepareIntegrationAction, removeIntegrationDraftAction, revokeConnectionAction, saveApiKeyAction, saveGoogleOAuthAppAction, saveProxyAction, saveWordPressAction } from "@/app/actions/integrations";
import { googleRedirectUri } from "@/lib/google";
import { getGoogleVaultData, hasGmailScope } from "@/lib/google";
import { providerGroups } from "@/lib/integrations";

const keyPlaceholders: Record<string, string> = {
  serpapi: "Clé SerpAPI",
  pexels: "Clé Pexels",
  imgbb: "Clé ImgBB / Cloudinary",
  twocaptcha: "Clé 2Captcha",
  telegram: "Token du bot (BotFather)",
};

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const session = await requireSession();
  const params = await searchParams;
  const connections = await listIntegrationConnections(session.organization.id);
  const vaultOk = isVaultConfigured();
  const googleConnection = connections.find((item) => item.provider === "google");
  const googleAuthUrl = googleConnection && googleConnection.has_secret
    ? await buildGoogleAuthUrl(session.organization.id, googleConnection.id)
    : null;
  let googleHasGmail = false;
  if (googleConnection && googleConnection.status === "connected") {
    const vault = await getGoogleVaultData(session.organization.id, googleConnection.id);
    googleHasGmail = hasGmailScope(vault?.tokens?.scope);
  }

  return (
    <DashboardShell eyebrow="Bring Your Own Accounts" title="Mes connexions">
      <div className="info-strip"><b>Vos identifiants restent privés.</b> Secrets chiffrés (AES-256-GCM), jamais renvoyés au navigateur, révocables à tout moment. {vaultOk ? "Coffre configuré." : "Mode dev : définissez JAMAKER_VAULT_KEY pour persister les secrets en production."}</div>
      {params.google === "connected" && <div className="info-strip"><b>Compte Google lié.</b> Révocable à tout moment depuis Google ou ici.</div>}
      {params.google && params.google !== "connected" && <div className="info-strip"><b>Connexion Google impossible</b> ({params.google}). Vérifiez le Client ID/secret et l&apos;URI de redirection dans Google Cloud Console.</div>}
      <section className="integration-grid">
        {providerGroups.map((group) => (
          <div key={group.id} style={{ display: "contents" }}>
            {integrationProviders.filter((integration) => integration.group === group.id).map((integration) => {
          const connection = connections.find((item) => item.provider === integration.id);
          return (
            <article className="integration-card" key={integration.name}>
              <div className={`integration-icon ${integration.color}`}>{integration.initials}</div>
              <div><h2>{integration.name}</h2><p>{integration.description}</p><p className="billing-note">{group.label}</p></div>
              <span className="connection-status">
                {!connection ? "Non configuré" : connection.has_secret && !connection.secret_ok ? "À reconnecter (clé coffre changée)" : `${connection.status}${connection.has_secret ? " • secret chiffré" : " • sans secret"}`}
              </span>
              {!connection && (
                <form action={prepareIntegrationAction}><input type="hidden" name="provider" value={integration.id} /><button className="button button-secondary" type="submit">Préparer</button></form>
              )}
              {connection && connection.status === "draft" && connection.auth_type === "api_key" && connection.provider !== "wordpress" && (
                <form action={saveApiKeyAction} className="coupon-controls">
                  <input type="hidden" name="connectionId" value={connection.id} />
                  <input type="password" name="apiKey" placeholder={keyPlaceholders[connection.provider] || "Clé API personnelle"} autoComplete="off" required minLength={8} />
                  <button className="button button-small" type="submit">Chiffrer et connecter</button>
                </form>
              )}
              {connection && connection.status === "draft" && connection.provider === "wordpress" && (
                <form action={saveWordPressAction} className="project-form">
                  <input type="hidden" name="connectionId" value={connection.id} />
                  <label>URL du site<input name="siteUrl" placeholder="https://monblog.com" inputMode="url" required /></label>
                  <label>Utilisateur WP<input name="username" placeholder="admin" required /></label>
                  <label>Mot de passe d&apos;application<input type="password" name="appPassword" placeholder="xxxx xxxx xxxx xxxx" autoComplete="off" required minLength={8} /></label>
                  <small className="billing-note">Profil → Utilisateurs → Mots de passe d&apos;application. Publication en brouillon uniquement.</small>
                  <button className="button button-small" type="submit">Chiffrer et connecter</button>
                </form>
              )}
              {connection && connection.provider === "google" && connection.status === "draft" && !connection.has_secret && (
                <form action={saveGoogleOAuthAppAction} className="project-form">
                  <input type="hidden" name="connectionId" value={connection.id} />
                  <label>Client ID Google<input name="clientId" placeholder="….apps.googleusercontent.com" autoComplete="off" required minLength={10} /></label>
                  <label>Client Secret<input type="password" name="clientSecret" autoComplete="off" required minLength={8} /></label>
                  <small className="billing-note">Google Cloud Console → API & Services → Identifiants → ID client OAuth (gratuit). URI à autoriser : {googleRedirectUri()}</small>
                  <button className="button button-small" type="submit">Enregistrer l&apos;app</button>
                </form>
              )}
              {connection && connection.provider === "google" && connection.status !== "connected" && Boolean(connection.has_secret) && googleAuthUrl && (
                <div className="integration-actions">
                  <span>{connection.external_account_label || "App configurée"}</span>
                  <a className="button button-small" href={googleAuthUrl}>Connecter avec Google</a>
                </div>
              )}
              {connection && connection.provider === "google" && connection.status === "connected" && !googleHasGmail && googleAuthUrl && (
                <div className="integration-actions">
                  <span>Gmail non autorisé</span>
                  <a className="button button-small" href={googleAuthUrl}>Étendre à Gmail</a>
                </div>
              )}
              {connection && connection.status === "draft" && integration.authType === "browser_profile" && (
                <div>
                  <form action={connectBrowserProfileAction} className="coupon-controls">
                    <input type="hidden" name="connectionId" value={connection.id} />
                    <input name="profile" placeholder="Nom du profil (ex: Profil principal)" maxLength={80} />
                    <button className="button button-small" type="submit">1. Déclarer le profil</button>
                  </form>
                  <p className="billing-note"><b>Ensuite :</b> double-cliquez <code>D:\JAMAKER\worker\LOGIN.bat</code> sur votre PC → choisissez le compte → connectez-vous dans Chrome (1 fois). Le worker exécute vos jobs, gratuit, sans clé API.</p>
                </div>
              )}
              {connection && connection.status === "draft" && connection.auth_type === "oauth" && connection.provider !== "google" && (
                <form action={connectDevAction} className="coupon-controls">
                  <input type="hidden" name="connectionId" value={connection.id} />
                  <input name="label" placeholder="Label compte (ex: @moncompte)" maxLength={80} />
                  <button className="button button-small" type="submit">Simuler OAuth dev</button>
                </form>
              )}
              {connection && connection.status === "connected" && (
                <div className="integration-actions">
                  <span>{connection.display_name}{connection.external_account_label ? ` — ${connection.external_account_label}` : ""}</span>
                  <form action={revokeConnectionAction}><input type="hidden" name="connectionId" value={connection.id} /><button type="submit">Révoquer</button></form>
                </div>
              )}
              {connection && (connection.status === "revoked" || connection.status === "expired" || connection.status === "error") && (
                <div className="integration-actions">
                  <span>{connection.display_name} — {connection.status}</span>
                  <form action={removeIntegrationDraftAction}><input type="hidden" name="connectionId" value={connection.id} /><button type="submit">Retirer</button></form>
                </div>
              )}
              {connection && connection.status === "draft" && connection.provider === "proxy" && (
                <form action={saveProxyAction} className="project-form">
                  <input type="hidden" name="connectionId" value={connection.id} />
                  <label>Hôte<input name="host" placeholder="proxy.exemple.com" required /></label>
                  <label>Port<input name="port" type="number" min={1} max={65535} placeholder="8080" required /></label>
                  <label>Type<select name="type" defaultValue="http"><option value="http">HTTP</option><option value="socks5">SOCKS5</option></select></label>
                  <label>Utilisateur (optionnel)<input name="username" autoComplete="off" /></label>
                  <label>Mot de passe (optionnel)<input type="password" name="password" autoComplete="off" /></label>
                  <button className="button button-small" type="submit">Chiffrer et connecter</button>
                </form>
              )}
              {connection && connection.status === "draft" && (
                <div className="integration-actions">
                  <span>{connection.display_name}</span>
                  <form action={removeIntegrationDraftAction}><input type="hidden" name="connectionId" value={connection.id} /><button type="submit">Retirer</button></form>
                </div>
              )}
            </article>
          );
            })}
          </div>
        ))}
      </section>
      <p className="billing-note">Comptes navigateur (modèle JADOMI HUB, gratuit) : déclarez le profil ici, connectez-vous une fois dans le navigateur du worker local, et le worker exécute vos jobs sans aucune clé API. Aucun mot de passe navigateur n&apos;est stocké au SaaS.</p>
    </DashboardShell>
  );
}
