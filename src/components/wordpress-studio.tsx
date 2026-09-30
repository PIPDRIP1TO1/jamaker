"use client";

import { useActionState } from "react";
import { createWordPressCategoryAction, publishWordPressPostAction, type WpState } from "@/app/actions/wordpress";

const empty: WpState = {};

export function WordPressStudio({ categories, siteHost }: { categories: Array<{ id: number; name: string; count: number }>; siteHost: string }) {
  const [pubState, pubAction, pubPending] = useActionState(publishWordPressPostAction, empty);
  const [catState, catAction, catPending] = useActionState(createWordPressCategoryAction, empty);
  return (
    <div className="module-console">
      <article className="panel module-workspace">
        <div className="workspace-topline"><span>Publier un brouillon — {siteHost}</span><small>Statut brouillon uniquement</small></div>
        <form action={pubAction} className="project-form">
          <label>Titre<input name="title" required minLength={3} maxLength={200} placeholder="Titre de l'article" /></label>
          <label>Contenu (HTML ou texte)<textarea name="content" required minLength={20} rows={8} placeholder="<p>Votre contenu…</p>" /></label>
          <label>Catégorie<select name="categoryId" defaultValue="">
            <option value="">Sans catégorie</option>
            {categories.map((cat) => <option value={cat.id} key={cat.id}>{cat.name} ({cat.count})</option>)}
          </select></label>
          <div className="settings-actions">
            <small>Brouillon invisible au public — validation dans WordPress.</small>
            <button className="button" type="submit" disabled={pubPending}>{pubPending ? "Publication…" : "Publier en brouillon"}</button>
          </div>
        </form>
        {pubState.message && <p className="billing-note" role="status">{pubState.message}</p>}
        {pubState.link && <p className="billing-note"><a href={pubState.link} target="_blank" rel="noreferrer">Ouvrir le brouillon →</a></p>}
      </article>
      <aside className="panel">
        <p className="eyebrow">Catégories ({categories.length})</p>
        <ul className="backup-list">{categories.length ? categories.map((cat) => <li key={cat.id}>{cat.name} — {cat.count} article(s)</li>) : <li>Aucune catégorie trouvée</li>}</ul>
        <form action={catAction} className="project-form">
          <label>Nom<input name="name" required minLength={2} maxLength={100} placeholder="Ex. Recettes" /></label>
          <label>Slug (optionnel)<input name="slug" maxLength={100} placeholder="ex-recettes" /></label>
          <button className="button button-small" type="submit" disabled={catPending}>{catPending ? "Création…" : "Créer la catégorie"}</button>
        </form>
        {catState.message && <p className="billing-note" role="status">{catState.message}</p>}
      </aside>
    </div>
  );
}
