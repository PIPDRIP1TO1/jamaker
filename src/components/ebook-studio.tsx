"use client";

import { useEffect, useMemo, useState } from "react";
import { createEmptyEbook, type EbookProject, type EbookRecipe, type EbookTheme } from "@/lib/ebook-types";

type SitemapItem = { url: string; title: string; category: string; selected: boolean };
type Stage = "library" | "sitemap" | "recipes" | "cover" | "export";

const themes: Array<{ id: EbookTheme; label: string; color: string }> = [
  { id: "gourmet", label: "Gourmet", color: "#c2410c" },
  { id: "minimal", label: "Minimal", color: "#0f172a" },
  { id: "rustic", label: "Rustic", color: "#78350f" },
  { id: "vibrant", label: "Vibrant", color: "#0d9488" },
];

function recipeFromSitemap(item: SitemapItem, index: number): EbookRecipe {
  return {
    id: crypto.randomUUID(), url: item.url, title: item.title, category: item.category,
    prepTime: "15 mins", cookTime: "25 mins", servings: "4 servings",
    ingredients: [], steps: [], tips: "", imageUrl: "", imageSource: "ai", status: "imported",
  };
}

export function EbookStudio({ initialBooks }: { initialBooks: EbookProject[] }) {
  const [books, setBooks] = useState(initialBooks);
  const [book, setBook] = useState<EbookProject | null>(initialBooks[0] || null);
  const [stage, setStage] = useState<Stage>(initialBooks.length ? "library" : "library");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [sitemapItems, setSitemapItems] = useState<SitemapItem[]>([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(book?.recipes[0]?.id || "");

  const selectedRecipe = book?.recipes.find((item) => item.id === selectedRecipeId) || book?.recipes[0] || null;
  const categories = useMemo(() => [...new Set((book?.recipes || []).map((item) => item.category).filter(Boolean))], [book?.recipes]);

  async function persist(project: EbookProject) {
    setSaveStatus("saving");
    const response = await fetch("/api/ebooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(project) });
    const data = await response.json() as { success?: boolean; project?: EbookProject; error?: string };
    if (!response.ok || !data.project) { setSaveStatus("error"); throw new Error(data.error || "Sauvegarde impossible."); }
    setSaveStatus("saved");
    setBooks((current) => [data.project!, ...current.filter((item) => item.id !== data.project!.id)]);
    return data.project;
  }

  useEffect(() => {
    if (!book) return;
    setSaveStatus("saving");
    const timer = window.setTimeout(() => { persist(book).catch(() => setSaveStatus("error")); }, 900);
    return () => window.clearTimeout(timer);
    // Persist each immutable book revision after a short pause.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book]);

  function updateBook(patch: Partial<EbookProject>) {
    setBook((current) => current ? { ...current, ...patch, updatedAt: new Date().toISOString() } : current);
  }

  function updateRecipe(id: string, patch: Partial<EbookRecipe>) {
    if (!book) return;
    updateBook({ recipes: book.recipes.map((recipe) => recipe.id === id ? { ...recipe, ...patch, status: "edited" } : recipe) });
  }

  function selectBook(next: EbookProject, nextStage: Stage = "library") {
    if (book && book.id !== next.id) persist(book).catch(() => setSaveStatus("error"));
    setBook(next); setSelectedRecipeId(next.recipes[0]?.id || ""); setStage(nextStage);
  }

  async function createBook() {
    const fresh = createEmptyEbook();
    setBook(fresh); setSelectedRecipeId(""); setStage("sitemap"); setMessage("Nouveau livre créé.");
  }

  async function removeBook(id: string) {
    if (!window.confirm("Supprimer définitivement ce livre de JA MAKER ?")) return;
    const response = await fetch(`/api/ebooks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) { setMessage("Suppression impossible."); return; }
    const remaining = books.filter((item) => item.id !== id);
    setBooks(remaining); setBook(remaining[0] || null); setStage("library");
  }

  async function analyzeSitemap() {
    if (!sitemapUrl.trim()) return;
    setBusy("sitemap"); setMessage("");
    try {
      const response = await fetch("/api/ebooks/sitemap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: sitemapUrl }) });
      const data = await response.json() as { items?: Array<Omit<SitemapItem, "selected">>; error?: string };
      if (!response.ok) throw new Error(data.error || "Sitemap inaccessible.");
      setSitemapItems((data.items || []).map((item) => ({ ...item, selected: true })));
      setMessage(`${data.items?.length || 0} recettes détectées.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Analyse impossible."); }
    finally { setBusy(""); }
  }

  function importSelected() {
    if (!book) return;
    const existing = new Set(book.recipes.map((item) => item.url));
    const additions = sitemapItems.filter((item) => item.selected && !existing.has(item.url)).map(recipeFromSitemap);
    updateBook({ recipes: [...book.recipes, ...additions] });
    setSelectedRecipeId(additions[0]?.id || book.recipes[0]?.id || "");
    setStage("recipes"); setMessage(`${additions.length} recettes ajoutées au livre.`);
  }

  async function generateRecipe(recipe: EbookRecipe) {
    if (!book) return;
    setBusy(recipe.id); setMessage("");
    try {
      const response = await fetch("/api/ebooks/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: recipe.title, category: recipe.category, language: book.language }) });
      const data = await response.json() as { recipe?: Partial<EbookRecipe>; error?: string };
      if (!response.ok || !data.recipe) throw new Error(data.error || "Génération impossible.");
      updateRecipe(recipe.id, { ...data.recipe, status: "generated" });
      setMessage(`Recette « ${recipe.title} » générée.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Génération impossible."); }
    finally { setBusy(""); }
  }

  async function openPrint() {
    if (!book) return;
    const popup = window.open("", "_blank");
    setBusy("export");
    try {
      await persist(book);
      if (!popup) throw new Error("Le navigateur a bloqué la fenêtre d’impression. Autorisez les popups pour localhost.");
      popup.opener = null;
      popup.location.href = `/api/ebooks/${book.id}/print?print=1`;
    }
    catch (error) { popup?.close(); setMessage(error instanceof Error ? error.message : "Export impossible."); }
    finally { setBusy(""); }
  }

  const stageLabels: Array<{ id: Stage; label: string }> = [
    { id: "library", label: "Mes livres" }, { id: "sitemap", label: "1. Import" }, { id: "recipes", label: "2. Recettes & IA" }, { id: "cover", label: "3. Couverture" }, { id: "export", label: "4. Export" },
  ];

  return (
    <section className="ebook-studio">
      <div className="ebook-hero">
        <div><span className="pill">Centralisé depuis D:\EBOOKS</span><h2>Ebook Studio</h2><p>Construisez le cookbook, gérez les recettes, la couverture et l’export au même endroit que sa campagne marketing.</p></div>
        <div className="ebook-hero-actions"><span className={`ebook-save ebook-save-${saveStatus}`}>{saveStatus === "saving" ? "Sauvegarde…" : saveStatus === "error" ? "Erreur sauvegarde" : "Sauvegardé"}</span><button className="button" type="button" onClick={createBook}>+ Nouveau livre</button></div>
      </div>
      <nav className="ebook-tabs" aria-label="Étapes Ebook Studio">
        {stageLabels.map((item) => <button type="button" key={item.id} className={stage === item.id ? "active" : ""} onClick={() => setStage(item.id)} disabled={item.id !== "library" && !book}>{item.label}</button>)}
      </nav>
      {message && <div className="ebook-message" role="status">{message}</div>}

      {stage === "library" && (
        <div className="ebook-library">
          {!books.length ? <div className="output-empty"><strong>Aucun livre centralisé</strong><p>Créez votre premier Ebook ou importez votre ancien historique.</p></div> : books.map((item) => (
            <article className={book?.id === item.id ? "active" : ""} key={item.id} onClick={() => selectBook(item)}>
              <div className="ebook-thumb" style={item.coverImage ? { backgroundImage: `url(${item.coverImage})` } : { background: item.accentColor }}><span>{item.recipes.length}</span></div>
              <div><strong>{item.title}</strong><p>{item.subtitle || "Sans sous-titre"}</p><small>{item.recipes.length} recettes • {item.language.toUpperCase()}</small></div>
              <div className="ebook-card-actions"><button type="button" onClick={(event) => { event.stopPropagation(); selectBook(item, "recipes"); }}>Ouvrir</button><button className="danger" type="button" onClick={(event) => { event.stopPropagation(); removeBook(item.id); }}>Supprimer</button></div>
            </article>
          ))}
        </div>
      )}

      {stage === "sitemap" && book && (
        <div className="ebook-panel">
          <div className="workspace-topline"><div><span>Importer depuis un sitemap public</span><small>Maximum 300 URL par import</small></div></div>
          <div className="ebook-import-row"><input type="url" value={sitemapUrl} onChange={(event) => setSitemapUrl(event.target.value)} placeholder="https://votre-site.com/sitemap.xml" /><button className="button" type="button" onClick={analyzeSitemap} disabled={busy === "sitemap"}>{busy === "sitemap" ? "Analyse…" : "Analyser"}</button></div>
          {sitemapItems.length > 0 && <><div className="ebook-select-row"><strong>{sitemapItems.filter((item) => item.selected).length}/{sitemapItems.length} sélectionnées</strong><button type="button" onClick={() => setSitemapItems((items) => items.map((item) => ({ ...item, selected: !items.every((entry) => entry.selected) })))}>Tout sélectionner/désélectionner</button></div><div className="ebook-sitemap-list">{sitemapItems.map((item) => <label key={item.url}><input type="checkbox" checked={item.selected} onChange={() => setSitemapItems((items) => items.map((entry) => entry.url === item.url ? { ...entry, selected: !entry.selected } : entry))} /><span><strong>{item.title}</strong><small>{item.category} • {item.url}</small></span></label>)}</div><button className="button ebook-next" type="button" onClick={importSelected}>Importer dans le livre →</button></>}
        </div>
      )}

      {stage === "recipes" && book && (
        <div className="ebook-recipes-layout">
          <aside className="ebook-recipe-list"><div className="workspace-topline"><span>{book.recipes.length} recettes</span><small>{categories.length} catégories</small></div>{book.recipes.map((recipe) => <button type="button" key={recipe.id} className={selectedRecipe?.id === recipe.id ? "active" : ""} onClick={() => setSelectedRecipeId(recipe.id)}><span>{recipe.status === "generated" || recipe.status === "edited" ? "✓" : "·"}</span><div><strong>{recipe.title}</strong><small>{recipe.category}</small></div></button>)}{!book.recipes.length && <p className="billing-note">Importez un sitemap pour commencer.</p>}</aside>
          <div className="ebook-panel ebook-recipe-editor">
            {selectedRecipe ? <>
              <div className="workspace-topline"><div><span>Éditeur de recette</span><small>{selectedRecipe.status}</small></div><button className="button button-small" type="button" onClick={() => generateRecipe(selectedRecipe)} disabled={busy === selectedRecipe.id}>{busy === selectedRecipe.id ? "Génération…" : "Générer avec mon IA"}</button></div>
              <div className="settings-grid">
                <label>Titre<input value={selectedRecipe.title} onChange={(event) => updateRecipe(selectedRecipe.id, { title: event.target.value })} /></label>
                <label>Catégorie<input value={selectedRecipe.category} onChange={(event) => updateRecipe(selectedRecipe.id, { category: event.target.value })} /></label>
                <label>Préparation<input value={selectedRecipe.prepTime} onChange={(event) => updateRecipe(selectedRecipe.id, { prepTime: event.target.value })} /></label>
                <label>Cuisson<input value={selectedRecipe.cookTime} onChange={(event) => updateRecipe(selectedRecipe.id, { cookTime: event.target.value })} /></label>
                <label>Portions<input value={selectedRecipe.servings} onChange={(event) => updateRecipe(selectedRecipe.id, { servings: event.target.value })} /></label>
                <label>Image (URL)<input value={selectedRecipe.imageUrl} onChange={(event) => updateRecipe(selectedRecipe.id, { imageUrl: event.target.value, imageSource: "custom" })} /></label>
                <label className="setting-wide">Ingrédients — quantité | ingrédient<textarea rows={9} value={selectedRecipe.ingredients.map((item) => `${item.amount} | ${item.item}`).join("\n")} onChange={(event) => updateRecipe(selectedRecipe.id, { ingredients: event.target.value.split(/\r?\n/).map((line) => { const [amount, ...rest] = line.split("|"); return { amount: (amount || "").trim(), item: rest.join("|").trim() }; }).filter((item) => item.item) })} /></label>
                <label className="setting-wide">Étapes — une par ligne<textarea rows={10} value={selectedRecipe.steps.join("\n")} onChange={(event) => updateRecipe(selectedRecipe.id, { steps: event.target.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) })} /></label>
                <label className="setting-wide">Astuce du chef<textarea rows={3} value={selectedRecipe.tips || ""} onChange={(event) => updateRecipe(selectedRecipe.id, { tips: event.target.value })} /></label>
              </div>
              <div className="settings-actions"><button className="project-delete" type="button" onClick={() => { updateBook({ recipes: book.recipes.filter((item) => item.id !== selectedRecipe.id) }); setSelectedRecipeId(""); }}>Retirer la recette</button><button className="button" type="button" onClick={() => setStage("cover")}>Couverture →</button></div>
            </> : <div className="output-empty"><strong>Aucune recette</strong><p>Importez d’abord les recettes souhaitées.</p></div>}
          </div>
        </div>
      )}

      {stage === "cover" && book && (
        <div className="ebook-cover-layout">
          <div className="ebook-panel"><div className="workspace-topline"><span>Identité du livre</span><small>Couverture avant, introduction et dos</small></div><div className="settings-grid">
            <label>Titre<input value={book.title} onChange={(event) => updateBook({ title: event.target.value })} /></label><label>Auteur<input value={book.author} onChange={(event) => updateBook({ author: event.target.value })} /></label>
            <label className="setting-wide">Sous-titre<input value={book.subtitle} onChange={(event) => updateBook({ subtitle: event.target.value })} /></label><label>Marque<input value={book.brandName} onChange={(event) => updateBook({ brandName: event.target.value })} /></label><label>Langue<select value={book.language} onChange={(event) => updateBook({ language: event.target.value === "fr" ? "fr" : "en" })}><option value="en">English</option><option value="fr">Français</option></select></label>
            <label className="setting-wide">Image de couverture (URL)<input value={book.coverImage} onChange={(event) => updateBook({ coverImage: event.target.value })} placeholder="https://…" /></label>
            <label className="setting-wide">Titre introduction<input value={book.introTitle} onChange={(event) => updateBook({ introTitle: event.target.value })} /></label><label className="setting-wide">Introduction<textarea rows={6} value={book.introText} onChange={(event) => updateBook({ introText: event.target.value })} /></label>
            <label className="setting-wide">Texte quatrième de couverture<textarea rows={4} value={book.backCoverText} onChange={(event) => updateBook({ backCoverText: event.target.value })} /></label><label className="setting-wide">Bio auteur<textarea rows={3} value={book.backCoverAuthorBio} onChange={(event) => updateBook({ backCoverAuthorBio: event.target.value })} /></label>
          </div><div className="ebook-themes">{themes.map((theme) => <button type="button" key={theme.id} className={book.theme === theme.id ? "active" : ""} onClick={() => updateBook({ theme: theme.id, accentColor: theme.color })}><i style={{ background: theme.color }} />{theme.label}</button>)}</div><div className="settings-actions"><small>Les changements sont sauvegardés automatiquement.</small><button className="button" type="button" onClick={() => setStage("export")}>Aperçu & Export →</button></div></div>
          <div className="ebook-cover-preview" style={{ backgroundImage: book.coverImage ? `linear-gradient(rgba(10,20,14,.2),rgba(10,20,14,.82)),url(${book.coverImage})` : `linear-gradient(145deg,${book.accentColor},#142019)` }}><small>{book.brandName}</small><div><h3>{book.title}</h3><p>{book.subtitle}</p></div><strong>BY {book.author}</strong></div>
        </div>
      )}

      {stage === "export" && book && (
        <div className="ebook-export-layout"><div className="ebook-panel"><div className="workspace-topline"><div><span>Aperçu du cookbook</span><small>{book.recipes.length} recettes • A4</small></div></div><iframe className="ebook-preview-frame" src={`/api/ebooks/${book.id}/print`} title="Aperçu du cookbook" /></div><aside className="ebook-panel ebook-export-actions"><span className="pill">Prêt à exporter</span><h2>{book.title}</h2><p>Ouvrez le document imprimable, puis choisissez « Enregistrer au format PDF » dans la fenêtre d’impression du navigateur.</p><button className="button" type="button" onClick={openPrint} disabled={busy === "export"}>{busy === "export" ? "Préparation…" : "Ouvrir / Enregistrer PDF"}</button><a className="button button-secondary" href={`/api/ebooks/${book.id}/print?download=1`}>Télécharger HTML autonome</a><button className="button button-secondary" type="button" onClick={() => setStage("library")}>Retour à mes livres</button></aside></div>
      )}
    </section>
  );
}
