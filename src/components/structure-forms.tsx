"use client";

import { useActionState } from "react";
import { createWorkspaceProfileAction, updateWorkspaceProfileAction, type StructureState } from "@/app/actions/structures";
import type { WorkspaceProfile } from "@/lib/workspace-profiles";

const empty: StructureState = {};
const labels: Record<string, string> = { browser: "Navigateur", social: "Réseau social", content: "Contenu", workspace: "Espace de travail" };

export function StructureCreateForm() {
  const [state, action, pending] = useActionState(createWorkspaceProfileAction, empty);
  return (
    <form action={action} className="project-form">
      <label>Nom<input name="name" required minLength={2} maxLength={100} placeholder="Ex. Profil éditorial principal" /></label>
      <label>Type<select name="profileType"><option value="workspace">Espace de travail</option><option value="browser">Navigateur</option><option value="social">Réseau social</option><option value="content">Contenu</option></select></label>
      <label>Plateforme<input name="platform" maxLength={80} placeholder="Ex. Instagram, WordPress…" /></label>
      <label>État<select name="status"><option value="draft">Brouillon</option><option value="ready">Prêt</option><option value="disabled">Désactivé</option></select></label>
      <label>Notes<textarea name="notes" rows={4} maxLength={1000} placeholder="Rôle de ce profil, sans aucun secret…" /></label>
      <button className="button" type="submit" disabled={pending}>{pending ? "Ajout…" : "Ajouter le profil"}</button>
      {state.message && <p className="billing-note" role="status">{state.message}</p>}
    </form>
  );
}

export function StructureEditForm({ profile }: { profile: WorkspaceProfile }) {
  const [state, action, pending] = useActionState(updateWorkspaceProfileAction, empty);
  return (
    <details className="output-item">
      <summary><div><strong>Modifier</strong><small>{labels[profile.profile_type] || profile.profile_type}</small></div><span>Éditer</span></summary>
      <form action={action} className="project-form">
        <input type="hidden" name="id" value={profile.id} />
        <label>Nom<input name="name" defaultValue={profile.name} required minLength={2} maxLength={100} /></label>
        <label>Plateforme<input name="platform" defaultValue={profile.platform} maxLength={80} /></label>
        <label>État<select name="status" defaultValue={profile.status}><option value="draft">Brouillon</option><option value="ready">Prêt</option><option value="disabled">Désactivé</option></select></label>
        <label>Notes<textarea name="notes" defaultValue={profile.notes} rows={3} maxLength={1000} /></label>
        <button className="button button-small" type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</button>
        {state.message && <p className="billing-note" role="status">{state.message}</p>}
      </form>
    </details>
  );
}
