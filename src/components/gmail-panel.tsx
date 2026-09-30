"use client";

import { useActionState } from "react";
import { createGmailDraftAction, type GmailState } from "@/app/actions/gmail";
import type { GmailMessage } from "@/lib/gmail";

const initial: GmailState = {};

export function GmailPanel({ email, messages, hasScope }: { email?: string; messages: GmailMessage[]; hasScope: boolean }) {
  const [state, action, pending] = useActionState(createGmailDraftAction, initial);
  if (!hasScope) {
    return (
      <section className="panel">
        <div className="workspace-topline"><span>Gmail — accès étendu requis</span></div>
        <p className="billing-note">Votre compte Google est lié sans la portée Gmail. Cliquez <b>Connecter avec Google</b> dans Mes connexions pour autoriser la lecture (les brouillons suivront).</p>
        <a className="button button-small" href="/dashboard/integrations">Aller aux connexions</a>
      </section>
    );
  }
  return (
    <>
      <section className="panel">
        <div className="workspace-topline"><span>Boîte Gmail — {email}</span><small>Lecture seule + brouillons (jamais d&apos;envoi auto)</small></div>
        <div className="project-list">
          {messages.length ? messages.map((msg) => (
            <details className="output-item" key={msg.id}>
              <summary><div><strong>{msg.subject}</strong><small>{msg.from} • {msg.date}</small></div><span>Ouvrir</span></summary>
              <pre>{msg.body || msg.snippet}</pre>
            </details>
          )) : <div className="output-empty"><strong>Boîte vide ou inaccessible</strong><p>Vérifiez la connexion Google.</p></div>}
        </div>
      </section>
      <section className="panel">
        <div className="workspace-topline"><span>Nouveau brouillon Gmail</span></div>
        <form action={action} className="project-form">
          <label>Destinataire<input name="to" type="email" required placeholder="nom@exemple.com" /></label>
          <label>Objet<input name="subject" required minLength={2} maxLength={200} placeholder="Objet…" /></label>
          <label>Corps<textarea name="body" required minLength={5} rows={4} placeholder="Contenu du brouillon…" /></label>
          <button className="button button-small" type="submit" disabled={pending}>{pending ? "Création…" : "Créer le brouillon"}</button>
        </form>
        {state.message && <p className="billing-note" role="status">{state.message}</p>}
      </section>
    </>
  );
}
