"use client";

import { useActionState, useMemo, useState } from "react";
import { createSignalAction, deleteMessageAction, type BoardState } from "@/app/actions/messages";
import type { MessageKind, WorkspaceMessage } from "@/lib/messages";

const initial: BoardState = {};

const kindConfig: Record<MessageKind, { singular: string; titleLabel: string; bodyLabel: string; urlLabel: string; titlePlaceholder: string; bodyPlaceholder: string }> = {
  message: { singular: "message", titleLabel: "Objet", bodyLabel: "Contenu", urlLabel: "Lien (optionnel)", titlePlaceholder: "Ex. Brief vidéo à réutiliser", bodyPlaceholder: "Collez ici le contenu utile au workflow…" },
  signal: { singular: "signal", titleLabel: "Signal observé", bodyLabel: "Analyse", urlLabel: "Source publique (URL)", titlePlaceholder: "Ex. Format carrousel qui performe", bodyPlaceholder: "Ce qui marche, pourquoi, pour qui…" },
  keyword: { singular: "mot-clé", titleLabel: "Mot-clé", bodyLabel: "Notes (volume, difficulté, intention)", urlLabel: "URL SERP (optionnel)", titlePlaceholder: "Ex. easy oat yogurt bread", bodyPlaceholder: "Volume estimé, concurrence, angle…" },
  resource: { singular: "ressource", titleLabel: "Titre", bodyLabel: "Description", urlLabel: "Lien", titlePlaceholder: "Ex. Guide des hooks 2026", bodyPlaceholder: "Pourquoi c'est utile…" },
};

export function MessageBoard({ kind, moduleSlug, moduleName, items, exportFileName }: {
  kind: MessageKind;
  moduleSlug: string;
  moduleName: string;
  items: WorkspaceMessage[];
  exportFileName: string;
}) {
  const [state, action, pending] = useActionState(createSignalAction, initial);
  const [filter, setFilter] = useState("");
  const config = kindConfig[kind];
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => `${item.title} ${item.body} ${item.url}`.toLowerCase().includes(q));
  }, [items, filter]);

  function exportJson() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(items, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="module-console">
      <article className="panel module-workspace">
        <div className="workspace-topline"><span>{items.length} {config.singular}(s) — {moduleName}</span><small>Données de votre organisation</small></div>
        <div className="coupon-controls">
          <input placeholder="Filtrer…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrer" />
          <button className="button button-small button-secondary" type="button" onClick={exportJson} disabled={!items.length}>Exporter JSON</button>
        </div>
        <div className="project-list">
          {filtered.length ? filtered.map((item) => (
            <article className="project-row" key={item.id}>
              <div className="project-kind">{config.singular.slice(0, 2).toUpperCase()}</div>
              <div>
                <div className="project-title-line"><strong>{item.title}</strong></div>
                {item.body && <p>{item.body.slice(0, 220)}{item.body.length > 220 ? "…" : ""}</p>}
                {item.url && <p><a href={item.url} target="_blank" rel="noreferrer">{item.url.slice(0, 80)}</a></p>}
                <p>{new Date(item.created_at).toLocaleString("fr-FR")}</p>
              </div>
              <div className="project-actions">
                <form action={deleteMessageAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="moduleSlug" value={moduleSlug} />
                  <button className="project-delete" type="submit">Supprimer</button>
                </form>
              </div>
            </article>
          )) : <div className="output-empty"><strong>{filter ? "Aucun résultat" : "Aucun élément"}</strong><p>{filter ? "Modifiez le filtre." : "Ajoutez votre premier élément avec le formulaire."}</p></div>}
        </div>
      </article>
      <aside className="panel">
        <p className="eyebrow">Nouveau {config.singular}</p>
        <form action={action} className="project-form">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="moduleSlug" value={moduleSlug} />
          <label>{config.titleLabel}<input name="title" required minLength={3} maxLength={120} placeholder={config.titlePlaceholder} /></label>
          <label>{config.bodyLabel}<textarea name="body" rows={4} maxLength={4000} placeholder={config.bodyPlaceholder} /></label>
          <label>{config.urlLabel}<input name="url" maxLength={500} placeholder="https://…" inputMode="url" /></label>
          <button className="button" type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</button>
        </form>
        {state.message && <p className="billing-note" role="status">{state.message}</p>}
      </aside>
    </div>
  );
}
