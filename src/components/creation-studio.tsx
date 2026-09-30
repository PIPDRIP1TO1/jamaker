"use client";

import { useActionState, useMemo, useState } from "react";
import { generateCreationAction, type CreationState } from "@/app/actions/creation";
import { duplicateExampleAction } from "@/app/actions/projects";
import type { ModuleSetting } from "@/config/module-settings";

type Output = { id: string; title: string; content_json: string; created_at: string };

const initial: CreationState = {};

function DeliverableView({ slug, data }: { slug: string; data: Record<string, unknown> }) {
  const deliverable = (data.deliverable || {}) as Record<string, unknown>;
  if (slug === "animated-story") {
    const episode = (deliverable.episode || {}) as Record<string, unknown>;
    const segA = (deliverable.segmentA || {}) as Record<string, unknown>;
    const segB = (deliverable.segmentB || {}) as Record<string, unknown>;
    const cover = (deliverable.cover || {}) as Record<string, unknown>;
    const insta = (deliverable.instagram || {}) as Record<string, unknown>;
    return (
      <div className="output-list">
        <div className="output-item"><pre>{`ÉPISODE — ${String(episode.title || "")}\nAccroche : ${String(episode.hook || "")}\nRésumé : ${String(episode.storySummary || "")}\nSuivant : partie ${String(episode.nextPart || "")}`}</pre></div>
        <div className="output-item"><pre>{`SEGMENT A (0–15s)\n${String(segA.prompt || "")}`}</pre></div>
        <div className="output-item"><pre>{`RACCORD 15.0s\n${String((deliverable.bridge as Record<string, unknown>)?.matchFrame || "")}`}</pre></div>
        <div className="output-item"><pre>{`SEGMENT B (15–30s)\n${String(segB.prompt || "")}`}</pre></div>
        <div className="output-item"><pre>{`COVER\n${String(cover.prompt || "")}`}</pre></div>
        <div className="output-item"><pre>{`INSTAGRAM\n${String(insta.caption || "")}\nCTA : ${String(insta.callToAction || "")}`}</pre></div>
      </div>
    );
  }
  if (slug === "recipe-video") {
    const scenes = (deliverable.scenes || []) as Array<Record<string, unknown>>;
    const analysis = (deliverable.analysis || {}) as Record<string, unknown>;
    return (
      <div className="output-list">
        <div className="output-item"><pre>{`PROJET — ${String(deliverable.project || "")}\nFormat : ${String(deliverable.format || "")} • ${String(deliverable.sceneCount || scenes.length)} scènes • ${String(deliverable.totalDurationSeconds || "")}s\nContinuité : ${String(deliverable.continuityLock || "")}\nAnalyse : intervalle ${String(analysis.intervalSeconds || "")}s, max ${String(analysis.maxFrames || "")} images`}</pre></div>
        {scenes.map((scene) => (
          <div className="run-row" key={String(scene.id)}><span className="run-dot run-completed" /><strong>{String(scene.id)} — {String(scene.durationSeconds)}s</strong><small>{String(scene.action || "").slice(0, 90)}</small></div>
        ))}
        <div className="output-item"><pre>{`PROMPT SCÈNE 1 (modèle)\n${String(scenes[0]?.prompt || "")}`}</pre></div>
      </div>
    );
  }
  if (slug === "cookbook-marketing") {
    const campaigns = (deliverable.campaigns || []) as Array<Record<string, unknown>>;
    return (
      <div className="output-list">
        <div className="output-item"><pre>{`CAMPAGNE — ${String(deliverable.title || "")}\nPrix : $${Number(deliverable.price || 0).toFixed(2)} • ${String(deliverable.campaignCount || campaigns.length)} publications • ${String(deliverable.cadence || "")}\nDestination : ${String(deliverable.destination || "")}`}</pre></div>
        {campaigns.slice(0, 6).map((campaign) => (
          <div className="run-row" key={String(campaign.id)}><span className="run-dot run-completed" /><strong>{String(campaign.date)} {String(campaign.time)}</strong><small>{String(campaign.angle || "")} — {String(campaign.caption || "").slice(0, 80)}…</small></div>
        ))}
        {campaigns.length > 6 && <p className="billing-note">… +{campaigns.length - 6} autres publications (JSON complet téléchargeable).</p>}
        <div className="output-item"><pre>{`RÉPONSE DM\n${String(deliverable.metaDmReply || "")}`}</pre></div>
      </div>
    );
  }
  return (
    <div className="output-item"><pre>{JSON.stringify(deliverable, null, 2).slice(0, 4000)}</pre></div>
  );
}

export function CreationStudio({ moduleSlug, moduleName, projectId, isExample, settings, inputs, outputs }: {
  moduleSlug: string;
  moduleName: string;
  projectId: string;
  isExample: boolean;
  settings: ModuleSetting[];
  inputs: Record<string, string>;
  outputs: Output[];
}) {
  const [state, action, pending] = useActionState(generateCreationAction, initial);
  const [approvedA, setApprovedA] = useState(false);
  const [approvedB, setApprovedB] = useState(false);
  const latest = useMemo(() => {
    const first = outputs[0];
    if (!first) return null;
    try {
      return { ...first, data: JSON.parse(first.content_json) as Record<string, unknown> };
    } catch {
      return null;
    }
  }, [outputs]);

  return (
    <div className="rc-layout">
      <section className="panel">
        <div className="workspace-topline"><span>Paramètres — {moduleName}</span><small>{settings.length} champs</small></div>
        {isExample && (
          <div className="example-notice">
            <strong>Exemple en lecture seule.</strong>
            <p>Créez votre copie privée pour saisir vos données.</p>
            <form action={duplicateExampleAction}>
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="moduleSlug" value={moduleSlug} />
              <button className="button" type="submit">Créer ma copie</button>
            </form>
          </div>
        )}
        <form action={action} className="project-form">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="moduleSlug" value={moduleSlug} />
          <div className="settings-grid">
            {settings.map((setting) => (
              <label className={setting.type === "textarea" ? "setting-wide" : ""} key={setting.key}>
                {setting.label}
                {setting.type === "textarea" ? (
                  <textarea name={setting.key} defaultValue={inputs[setting.key] || ""} placeholder={setting.placeholder} rows={4} disabled={isExample} />
                ) : setting.type === "select" ? (
                  <select name={setting.key} defaultValue={inputs[setting.key] || ""} disabled={isExample}>
                    <option value="">Sélectionner…</option>
                    {setting.options?.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                  </select>
                ) : setting.type === "checkbox" ? (
                  <span className="switch-label"><input type="checkbox" name={setting.key} defaultChecked={inputs[setting.key] === "1"} disabled={isExample} /><span>{setting.placeholder || "Activer"}</span></span>
                ) : (
                  <input name={setting.key} type={setting.type} defaultValue={inputs[setting.key] || ""} placeholder={setting.placeholder} disabled={isExample} />
                )}
              </label>
            ))}
          </div>
          <div className="settings-actions">
            <small>{isExample ? "Dupliquez pour activer" : "Brouillon privé, aucune action externe"}</small>
            <button className="button" type="submit" disabled={isExample || pending}>{pending ? "Génération…" : "Générer la prévisualisation"}</button>
          </div>
        </form>
        {state.message && <p className="billing-note" role="status">{state.message}</p>}
      </section>

      <section className="panel output-panel">
        <div className="workspace-topline"><div><span>Résultat + validation</span><small>{outputs.length} version(s)</small></div>{latest && <div className="output-toolbar"><a href={`/api/outputs/${latest.id}`}>Télécharger JSON</a></div>}</div>
        {!latest ? (
          <div className="output-empty"><strong>Aucun résultat</strong><p>Renseignez les paramètres puis lancez la génération.</p></div>
        ) : (
          <>
            <h2>{latest.title}</h2>
            <DeliverableView slug={moduleSlug} data={latest.data} />
            <div className="settings-grid">
              <label><input type="checkbox" checked={approvedA} onChange={(e) => setApprovedA(e.target.checked)} /> Contenu relu et validé</label>
              <label><input type="checkbox" checked={approvedB} onChange={(e) => setApprovedB(e.target.checked)} /> Prêt pour l&apos;étape suivante</label>
            </div>
            <p className="billing-note">{approvedA && approvedB ? "Validations OK — résultat exploitable (export JSON ci-dessus)." : "Cochez les 2 validations pour marquer ce résultat comme exploitable."}</p>
          </>
        )}
        {outputs.length > 1 && (
          <div className="run-history"><div className="run-history-title"><strong>Versions</strong><small>Historique complet</small></div>
            {outputs.map((o) => <div className="run-row" key={o.id}><span className="run-dot run-completed" /><strong>{o.title}</strong><small>{new Date(o.created_at).toLocaleString("fr-FR")}</small><a className="project-open" href={`/api/outputs/${o.id}`}>JSON</a></div>)}
          </div>
        )}
      </section>
    </div>
  );
}
