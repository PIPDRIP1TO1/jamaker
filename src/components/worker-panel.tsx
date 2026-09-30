"use client";

import { useActionState } from "react";
import { createWorkerTokenAction, revokeWorkerTokenAction, type WorkerState } from "@/app/actions/worker";

const initial: WorkerState = {};

export function WorkerPanel({ tokens, saasUrl }: { tokens: Array<{ id: string; name: string; last_seen_at: string | null; created_at: string }>; saasUrl: string }) {
  const [state, action, pending] = useActionState(createWorkerTokenAction, initial);
  return (
    <section className="panel">
      <div className="workspace-topline"><span>Worker local — comptes navigateur gratuits</span><small>{tokens.length} token(s)</small></div>
      <p className="billing-note">
        Le worker tourne sur <b>votre PC</b> : il récupère les jobs en attente, pilote vos profils navigateur déjà connectés
        (ChatGPT, DeepSeek, Qwen, Gemini… gratuit, sans clé API) et renvoie les résultats ici. Vos sessions ne quittent jamais votre machine.
      </p>
      <form action={action} className="coupon-controls">
        <input name="name" placeholder="Nom (ex. PC bureau)" maxLength={80} />
        <button className="button button-small" type="submit" disabled={pending}>{pending ? "Création…" : "Créer un token worker"}</button>
      </form>
      {state.message && <p className="billing-note" role="status">{state.message}</p>}
      {state.token && <p className="billing-note"><strong>Token :</strong> {state.token}</p>}
      <div className="project-form">
        <label>Démarrage worker (dans <code>D:\JAMAKER\worker</code>)
          <pre>npm install{"\n"}set JAMAKER_URL={saasUrl}{"\n"}set JAMAKER_WORKER_TOKEN=COLLEZ_LE_TOKEN{"\n"}npm start</pre>
        </label>
      </div>
      {tokens.length > 0 && (
        <div className="jobs-list">
          {tokens.map((token) => (
            <article className="job-row" key={token.id}>
              <span className="pill">{token.last_seen_at ? "vu" : "jamais vu"}</span>
              <div><strong>{token.name}</strong><small>Dernier contact : {token.last_seen_at ? new Date(token.last_seen_at).toLocaleString("fr-FR") : "—"}</small></div>
              <div className="job-actions">
                <form action={revokeWorkerTokenAction}>
                  <input type="hidden" name="id" value={token.id} />
                  <button type="submit">Révoquer</button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
