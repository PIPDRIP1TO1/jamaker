"use client";

import { useActionState, useMemo, useState } from "react";
import { generateCreationAction, type CreationState } from "@/app/actions/creation";
import { duplicateExampleAction } from "@/app/actions/projects";
import type { ModuleSetting } from "@/config/module-settings";

type Output = { id: string; title: string; content_json: string; created_at: string };

const initial: CreationState = {};

const limits: Record<string, { limit: number; name: string }> = {
  instagram: { limit: 2200, name: "Instagram" },
  facebook: { limit: 63206, name: "Facebook" },
  "facebook-pages": { limit: 63206, name: "Facebook Pages" },
  "facebook-groups": { limit: 63206, name: "Facebook Groups" },
  pinterest: { limit: 500, name: "Pinterest" },
  "pinterest-accounts": { limit: 500, name: "Pinterest" },
};

function extractHashtags(text: string) {
  return Array.from(new Set(Array.from(text.matchAll(/#([\p{L}\p{N}_]+)/gu)).map((m) => `#${m[1]}`))).slice(0, 30);
}

export function SocialStudio({ moduleSlug, moduleName, projectId, isExample, settings, inputs, outputs, hasConnection }: {
  moduleSlug: string;
  moduleName: string;
  projectId: string;
  isExample: boolean;
  settings: ModuleSetting[];
  inputs: Record<string, string>;
  outputs: Output[];
  hasConnection: boolean;
}) {
  const [state, action, pending] = useActionState(generateCreationAction, initial);
  const [caption, setCaption] = useState(inputs.caption || "");
  const [title, setTitle] = useState(inputs.contentTitle || "");
  const [publishAt, setPublishAt] = useState(inputs.publishAt || "");
  const network = limits[moduleSlug] || { limit: 2200, name: moduleName };
  const tags = useMemo(() => extractHashtags(caption), [caption]);
  const tooLong = caption.length > network.limit;
  const dateOk = !publishAt || new Date(publishAt).getTime() > Date.now() - 60000;
  const ready = title.trim().length >= 3 && caption.trim().length >= 10 && !tooLong && dateOk;

  return (
    <div className="rc-layout">
      <section className="panel">
        <div className="workspace-topline"><span>Compositeur — {network.name}</span><small>Limite : {network.limit.toLocaleString("fr-FR")} caractères</small></div>
        {isExample && (
          <div className="example-notice">
            <strong>Exemple en lecture seule.</strong>
            <p>Créez votre copie privée pour préparer vos publications.</p>
            <form action={duplicateExampleAction}>
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="moduleSlug" value={moduleSlug} />
              <button className="button" type="submit">Créer ma copie</button>
            </form>
          </div>
        )}
        {!hasConnection && <div className="info-strip"><b>Brouillon uniquement.</b> Aucune publication ne part sans connexion officielle. Connectez le compte dans Mes connexions quand vous êtes prêt.</div>}
        <form action={action} className="project-form">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="moduleSlug" value={moduleSlug} />
          <label>Titre interne<input name="contentTitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nom de la publication" disabled={isExample} /></label>
          <label>Texte de publication<textarea name="caption" value={caption} onChange={(e) => setCaption(e.target.value)} rows={7} placeholder="Caption à valider avant publication…" disabled={isExample} /></label>
          <div className="info-strip">{caption.length.toLocaleString("fr-FR")} / {network.limit.toLocaleString("fr-FR")} caractères{tooLong ? " — TROP LONG" : ""} • {tags.length} hashtag(s){tags.length > 0 ? ` : ${tags.slice(0, 8).join(" ")}` : ""}</div>
          <label>Date souhaitée<input name="publishAt" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} disabled={isExample} /></label>
          {!dateOk && <p className="billing-note" role="status">La date doit être dans le futur.</p>}
          <input type="hidden" name="accountConnection" value={hasConnection ? "draft-only" : "not-connected"} />
          {settings.filter((s) => !["contentTitle", "caption", "publishAt", "accountConnection"].includes(s.key)).map((setting) => (
            <label key={setting.key}>{setting.label}<input name={setting.key} defaultValue={inputs[setting.key] || ""} placeholder={setting.placeholder} disabled={isExample} /></label>
          ))}
          <div className="settings-actions">
            <small>Brouillon privé — publication externe désactivée tant que la connexion n&apos;est pas validée.</small>
            <button className="button" type="submit" disabled={isExample || pending || !ready}>{pending ? "Enregistrement…" : "Enregistrer le brouillon"}</button>
          </div>
        </form>
        {state.message && <p className="billing-note" role="status">{state.message}</p>}
      </section>

      <section className="panel output-panel">
        <div className="workspace-topline"><div><span>Prévisualisation</span><small>{outputs.length} version(s)</small></div></div>
        {!outputs.length ? (
          <div className="output-empty"><strong>Aucun brouillon</strong><p>Composez puis enregistrez pour prévisualiser le rendu.</p></div>
        ) : (
          <div className="output-list">
            {outputs.slice(0, 5).map((output) => {
              let captionText = "";
              try {
                const parsed = JSON.parse(output.content_json) as { deliverable?: { caption?: string; title?: string; requestedSchedule?: string; publicationStatus?: string } };
                captionText = String(parsed.deliverable?.caption || "");
              } catch {
                captionText = "";
              }
              return (
                <details className="output-item" key={output.id}>
                  <summary><div><strong>{output.title}</strong><small>{new Date(output.created_at).toLocaleString("fr-FR")}</small></div><span>Brouillon</span></summary>
                  <pre>{captionText || "(vide)"}</pre>
                  <div className="output-toolbar"><a href={`/api/outputs/${output.id}`}>Télécharger JSON</a></div>
                </details>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
