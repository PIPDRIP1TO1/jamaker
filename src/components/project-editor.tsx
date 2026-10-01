import Link from "next/link";
import type { JaMakerModule } from "@/config/modules";
import type { ModuleProject, ProjectConfig } from "@/lib/module-projects";
import { duplicateExampleAction, generateModuleDraftAction, runAutomationTestAction, saveAutomationScheduleAction, saveProjectSettingsAction, sendToWorkerAction, updateProjectAction } from "@/app/actions/projects";
import { runWorkflowTestAction } from "@/app/actions/projects";
import type { WorkflowEdge, WorkflowNode, WorkflowRun } from "@/lib/workflow-engine";
import type { AutomationSchedule } from "@/lib/automation-engine";
import { getModuleSettings } from "@/config/module-settings";
import type { ModuleOutput } from "@/lib/module-outputs";

type WorkflowView = { nodes: WorkflowNode[]; edges: WorkflowEdge[]; runs: WorkflowRun[] } | null;

export function ProjectEditor({ module, project, config, workflow, automationSchedule, outputs = [] }: { module: JaMakerModule; project: ModuleProject; config: ProjectConfig; workflow?: WorkflowView; automationSchedule?: AutomationSchedule | null; outputs?: ModuleOutput[] }) {
  const isExample = Boolean(project.is_example);
  const settings = getModuleSettings(module.slug);
  const inputs = (config.inputs || {}) as Record<string, unknown>;
  return (
    <>
      <section className="project-editor-head">
        <div><span className={isExample ? "example-badge" : "draft-badge"}>{isExample ? "Exemple" : "Projet privé"}</span><h2>{project.name}</h2><p>{isExample ? "Modèle générique sans donnée personnelle. Dupliquez-le avant de le modifier." : "Ce projet appartient uniquement à votre organisation."}</p></div>
        <div className="module-header-actions">{isExample && <form action={duplicateExampleAction}><input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="moduleSlug" value={module.slug} /><button className="button" type="submit">Créer ma copie</button></form>}{!isExample && module.slug === "automations" && <form action={runAutomationTestAction}><input type="hidden" name="projectId" value={project.id} /><button className="button" type="submit">Exécuter le test</button></form>}<Link className="button button-secondary" href={`/dashboard/tools/${module.slug}`}>Retour au module</Link></div>
      </section>
      <section className="project-editor-grid">
        <article className="panel">
          <div className="workspace-topline"><span>Configuration du projet</span><small>{config.steps.length} étapes</small></div>
          <div className="flow-steps">{config.steps.map((step, index) => <div className="flow-step" key={step.id}><span>{index + 1}</span><div><strong>{step.label}</strong><small>{step.enabled ? "Activée" : "Désactivée"}</small></div>{index < config.steps.length - 1 && <b>↓</b>}</div>)}</div>
        </article>
        <aside className="panel project-properties">
          <p className="eyebrow">Propriétés</p>
          {isExample ? <div className="example-notice"><strong>Lecture seule</strong><p>Ce modèle reste propre et réutilisable. Créez votre copie pour personnaliser les champs.</p></div> : <form action={updateProjectAction} className="project-form"><input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="moduleSlug" value={module.slug} /><label>Nom<input name="name" defaultValue={project.name} minLength={2} maxLength={100} required /></label><label>Description<textarea name="description" defaultValue={project.description} maxLength={500} rows={5} /></label><button className="button" type="submit">Enregistrer</button></form>}
          <div className="privacy-check"><span>✓</span><div><strong>Aucun chemin personnel</strong><small>{config.localPaths.length} chemin local · {config.externalAccounts.length} compte externe</small></div></div>
        </aside>
      </section>
      <section className="module-settings-panel panel">
        <div className="settings-panel-copy">
          <p className="eyebrow">Paramètres métier</p>
          <h2>Entrées de {module.name}</h2>
          <p>{isExample ? "Ces valeurs montrent la structure attendue. Créez une copie pour saisir vos propres données." : "Configurez les données nécessaires à cette création. Elles restent privées à votre organisation."}</p>
        </div>
        {isExample ? <div className="settings-preview-grid">{settings.map((setting) => <div className="setting-preview" key={setting.key}><small>{setting.label}</small><strong>{setting.placeholder || "À renseigner"}</strong></div>)}</div> : <form action={saveProjectSettingsAction} className="settings-form">
          <input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="moduleSlug" value={module.slug} />
          <div className="settings-grid">{settings.map((setting) => { const value = String(inputs[setting.key] ?? ""); return <label className={setting.type === "textarea" ? "setting-wide" : ""} key={setting.key}>{setting.label}{setting.type === "textarea" ? <textarea name={setting.key} defaultValue={value} placeholder={setting.placeholder} rows={4} /> : setting.type === "select" ? <select name={setting.key} defaultValue={value}><option value="">Sélectionner…</option>{setting.options?.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select> : <input name={setting.key} type={setting.type} defaultValue={value} placeholder={setting.placeholder} />}</label>; })}</div>
          <div className="settings-actions"><small>Enregistrement local sécurisé · aucune publication externe</small><button className="button button-small" type="submit">Enregistrer les paramètres</button></div>
        </form>}
      </section>
      {!isExample && <section className="output-panel panel">
        <div className="workspace-topline"><div><span>Résultats du projet</span><small>Prévisualisation locale avant connexion aux services externes</small></div><form action={generateModuleDraftAction}><input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="moduleSlug" value={module.slug} /><button className="button button-small" type="submit">Générer une prévisualisation</button></form></div>
        {outputs.length ? <div className="output-list">{outputs.map((output) => { let content = output.content_json; try { content = JSON.stringify(JSON.parse(output.content_json), null, 2); } catch {} return <details className="output-item" key={output.id}><summary><div><strong>{output.title}</strong><small>{new Date(output.created_at).toLocaleString("fr-FR")}</small></div><span>Prêt</span></summary><div className="output-toolbar"><a href={`/api/outputs/${output.id}`}>Télécharger JSON</a></div><pre>{content}</pre></details>; })}</div> : <div className="output-empty"><strong>Aucun résultat pour le moment</strong><p>Renseignez les paramètres puis lancez une prévisualisation technique.</p></div>}
      </section>}
      {workflow && <section className="workflow-engine-panel panel"><div className="workspace-topline"><div><span>Workflow Engine</span><small>{workflow.nodes.length} nœuds · {workflow.edges.length} connexions</small></div>{!isExample && <form action={runWorkflowTestAction}><input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="moduleSlug" value={module.slug} /><button className="button button-small" type="submit">Lancer un test technique</button></form>}</div><div className="workflow-canvas">{workflow.nodes.map((node, index) => <div className={`workflow-node node-${node.node_type}`} key={node.id}><small>{node.node_type}</small><strong>{node.label}</strong>{index < workflow.nodes.length - 1 && <span>→</span>}</div>)}</div><div className="run-history"><div className="run-history-title"><strong>Dernières exécutions</strong><small>Aucune publication externe pendant les tests techniques</small></div>{workflow.runs.length ? workflow.runs.map((run) => <div className="run-row" key={run.id}><span className={`run-dot run-${run.status}`} /><strong>Test technique</strong><small>{new Date(run.created_at).toLocaleString("fr-FR")}</small><b>{run.status === "completed" ? "Réussi" : run.status}</b></div>) : <p>Aucune exécution pour le moment.</p>}</div></section>}
      {module.slug === "automations" && !isExample && <section className="panel"><div className="workspace-topline"><span>Worker local — comptes navigateur gratuits</span><small>File SaaS → exécution PC</small></div><p className="billing-note">Envoie le job dans la file : le worker local le récupère et l&apos;exécute avec vos profils navigateur (ChatGPT…). Démarrez le worker sur votre PC avant.</p><form action={sendToWorkerAction} className="project-form"><input type="hidden" name="projectId" value={project.id} /><label>Adapter<select name="workerAdapter" defaultValue="technical"><option value="technical">Technique (validation locale)</option><option value="chatgpt">ChatGPT web (article)</option><option value="deepseek">DeepSeek web (article)</option></select></label><label>Profil navigateur<input name="browserProfile" placeholder="Profil principal" maxLength={80} /></label><label>Consigne IA<textarea name="workerPrompt" rows={3} placeholder="Ex. Écris une introduction de recette couscous, 120 mots…" /></label><button className="button button-small" type="submit">Envoyer au worker</button></form></section>}
      {module.slug === "automations" && !isExample && <section className="automation-schedule-panel panel"><div><p className="eyebrow">Scheduler</p><h2>Planning de l&apos;automation</h2><p>Définissez un intervalle local. L&apos;activation prépare la prochaine exécution sans connecter de service externe.</p></div><form action={saveAutomationScheduleAction} className="schedule-form"><input type="hidden" name="projectId" value={project.id} /><label>Intervalle<select name="intervalMinutes" defaultValue={automationSchedule ? JSON.parse(automationSchedule.schedule_json || "{}").intervalMinutes || 60 : 60}><option value="15">Toutes les 15 minutes</option><option value="60">Toutes les heures</option><option value="360">Toutes les 6 heures</option><option value="1440">Chaque jour</option><option value="10080">Chaque semaine</option></select></label><label className="switch-label"><input type="checkbox" name="active" defaultChecked={Boolean(automationSchedule?.active)} /><span>Planning actif</span></label><button className="button button-small" type="submit">Enregistrer le planning</button></form>{automationSchedule?.next_run_at && <small className="next-run">Prochaine exécution préparée : {new Date(automationSchedule.next_run_at).toLocaleString("fr-FR")}</small>}</section>}
    </>
  );
}
