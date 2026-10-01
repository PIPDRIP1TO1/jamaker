"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { applyWorkerIntroAction, generateRecipeAction, publishRecipeToWordPressAction, reviseRecipeAction, sendRecipeImagesToWorkerAction, sendRecipeIntroToWorkerAction, type PublishState, type RecipeState } from "@/app/actions/recipe";
import { duplicateExampleAction } from "@/app/actions/projects";

type Output = { id: string; title: string; content_json: string; created_at: string };
type Article = { title: string; seoTitle: string; metaDescription: string; focusKeyword: string; introduction: string; ingredients: string[]; instructions: string[]; tips: string[]; faq: Array<{ q: string; a: string }>; internalLinks?: Array<{ label: string; url: string }>; wordCount?: number; imagePrompts: { featured: string; hero: string; ingredients: string; serving: string }; imageUrls?: { featured: string; hero: string; ingredients: string; serving: string }; stockPhotos?: Array<{ url: string; alt: string; photographer: string }>; gutenberg: string; seoBrief?: { primaryKeyword: string; searchIntent: string; audience: string; secondaryKeywords: string[]; outline: string[]; questionsToAnswer: string[]; internalLinkIdeas: string[]; imageSeo: Array<{ role: string; fileName: string; altText: string }> }; seoAudit?: { score: number; grade: string; publishReady: boolean; criticalCount: number; checks: Array<{ id: string; label: string; severity: "pass" | "warning" | "critical"; points: number; maximum: number; detail: string }> } };

function cleanItem(value: string) {
  return value.replace(/^(\s*[-*•]\s*|\s*\d+[.)]\s*)/, "").trim();
}

function isImageOnly(src: string) {
  const text = src.trim();
  if (!text || text.length < 20) return false;
  if (/ingr[eé]dients?\s*:/i.test(text) || /(?:step|étape|instruction)s?\s*(?:by\s*step)?\s*:/i.test(text)) return false;
  return /(photorealistic|food photography|\b8k\b|close-up|macro shot|studio lighting|award-winning|blurred background|[^a-z]shot\b)/i.test(text);
}

function dishTitle(src: string) {
  const first = src.replace(/\r/g, "").split("\n").map((l) => l.trim()).find(Boolean) || "";
  const sentence = first.split(/(?<=[.!?])\s+/)[0] || first;
  const dish = sentence.split(/\s+on\s+a\s+|\s+in\s+a\s+|\s+with\s+|\s*[-–—:]\s*/i)[0] || sentence;
  return dish.trim().split(/\s+/).slice(0, 10).join(" ").slice(0, 120);
}

function parseBrief(brief: string) {
  const src = (brief || "").replace(/\r/g, "");
  const lines = src.split("\n").map((l) => l.trim()).filter(Boolean);
  const imageOnly = isImageOnly(src);
  const titleLine = src.match(/^\s*title\s*:\s*(.+?)\s*$/im)?.[1]?.trim() || (imageOnly ? dishTitle(src) : "") || lines.find((l) => l && !/^(yield|servings?|portions?)\s*:/i.test(l) && !/^(ingredients?|step|étape|instruction|image|prompt|featured|hero|serving)/i.test(l)) || "";
  const ingMatch = src.match(/ingr[eé]dients?\s*:([\s\S]*?)(?:\n\s*(?:step|étape|instruction)\b|featured\s+image|hero\s+image|serving\s+image|ingredients\s+image|image\s*1|$)/i);
  const stepMatch = src.match(/(?:step|étape|instruction)s?\s*(?:by\s*step)?\s*:([\s\S]*?)(?:consistent\s+image\s+prompts|featured\s+image|hero\s+image|ingredients\s+image|serving\s+image|image\s*1|$)/i);
  const toItems = (s?: string, min = 3) => (s ? s.split("\n").map((x) => cleanItem(x)).filter((x) => x && x.length >= min && !/^(consistent|image|prompt)/i.test(x)) : []);
  const ingredients = toItems(ingMatch?.[1], 3);
  const steps = toItems(stepMatch?.[1], 3).filter((s) => s.length >= 12 && /\s/.test(s));
  const labelCount = ["featured", "hero", "ingredients", "serving"].filter((k) => new RegExp(`${k}\\s+image`, "i").test(src)).length;
  const numCount = [1, 2, 3, 4].filter((i) => new RegExp(`image\\s*${i}`, "i").test(src)).length;
  const keyword = src.match(/(?:^|\n)\s*(?:mot-cl[eé]|focus\s*keyword|keyword)\s*:\s*(.+)/i)?.[1]?.split("\n")[0]?.trim().slice(0, 80) || titleLine.toLowerCase();
  function block(labelRe: RegExp) {
    const m = src.match(labelRe);
    if (!m || m.index === undefined) return "";
    const start = m.index + m[0].length;
    const stops = [/featured\s+image/i, /hero\s+image/i, /ingredients\s+image/i, /serving\s+image/i];
    let end = src.length;
    for (const stop of stops) {
      const s = src.slice(start).search(stop);
      if (s >= 0) end = Math.min(end, start + s);
    }
    return src.slice(start, end).replace(/^\s*(\([^)]*\)\s*)?/, "").trim().slice(0, 800);
  }
  return {
    title: titleLine.slice(0, 120),
    keyword: keyword.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, " ").trim().slice(0, 80),
    ingredientsText: ingredients.join("\n"),
    stepsText: steps.join("\n"),
    directionText: imageOnly ? src.trim().slice(0, 2000) : "",
    imageOnly,
    promptFeatured: block(/featured\s+image[^\n]*\n?/i),
    promptHero: block(/hero\s+image[^\n]*\n?/i),
    promptIngredients: block(/ingredients\s+image[^\n]*\n?/i),
    promptServing: block(/serving\s+image[^\n]*\n?/i),
    ing: ingredients.length,
    stepsCount: steps.length,
    images: Math.max(labelCount, numCount),
  };
}

const genInitial: RecipeState = {};
const revInitial: RecipeState = {};
const pubInitial: PublishState = {};

export function RecipeCreatorStudio({ projectId, isExample, initial, outputs, hasBrowserAi, hasWordPress }: { projectId: string; isExample: boolean; initial: Record<string, string>; outputs: Output[]; hasBrowserAi: boolean; hasWordPress: boolean }) {
  const [brief, setBrief] = useState(initial.brief || "");
  const [title, setTitle] = useState(initial.recipeTitle || "");
  const [keyword, setKeyword] = useState(initial.focusKeyword || "");
  const [ingredients, setIngredients] = useState(initial.ingredients || "");
  const [steps, setSteps] = useState(initial.steps || "");
  const [meta, setMeta] = useState(initial.metaDescription || "");
  const [direction, setDirection] = useState(initial.imageDirection || "");
  const [promptFeatured, setPromptFeatured] = useState(initial.promptFeatured || "");
  const [promptHero, setPromptHero] = useState(initial.promptHero || "");
  const [promptIngredients, setPromptIngredients] = useState(initial.promptIngredients || "");
  const [promptServing, setPromptServing] = useState(initial.promptServing || "");
  const [lang, setLang] = useState(initial.language || "en");
  const [seoTitle, setSeoTitle] = useState(initial.seoTitle || "");
  const [author, setAuthor] = useState(initial.authorName || "");
  const [dupPolicy, setDupPolicy] = useState(initial.duplicatePolicy || "ask");
  const [internalLinks, setInternalLinks] = useState(initial.internalLinks || "");
  const [genState, genAction, genPending] = useActionState(generateRecipeAction, genInitial);
  const [revState, revAction, revPending] = useActionState(reviseRecipeAction, revInitial);
  const [pubState, pubAction, pubPending] = useActionState(publishRecipeToWordPressAction, pubInitial);
  const [imgState, imgAction, imgPending] = useActionState(sendRecipeImagesToWorkerAction, genInitial);
  const [introState, introAction, introPending] = useActionState(sendRecipeIntroToWorkerAction, genInitial);
  const [workerProfile, setWorkerProfile] = useState("Profil principal");
  const [approveText, setApproveText] = useState(false);
  const [approveImages, setApproveImages] = useState(false);
  const briefRef = useRef<HTMLTextAreaElement>(null);
  const d = useMemo(() => parseBrief(brief), [brief]);

  function fillFromBrief() {
    // Lit le DOM directement (ref) : insensible à tout état périmé.
    const raw = briefRef.current?.value ?? brief;
    if (raw !== brief) setBrief(raw);
    const parsed = parseBrief(raw);
    if (!parsed.title && !parsed.ingredientsText && !parsed.stepsText && !parsed.directionText) return;
    if (parsed.title) setTitle(parsed.title);
    if (parsed.keyword) setKeyword(parsed.keyword);
    if (parsed.ingredientsText) setIngredients(parsed.ingredientsText);
    if (parsed.stepsText) setSteps(parsed.stepsText);
    if (parsed.directionText) setDirection(parsed.directionText);
    if (parsed.promptFeatured) setPromptFeatured(parsed.promptFeatured);
    if (parsed.promptHero) setPromptHero(parsed.promptHero);
    if (parsed.promptIngredients) setPromptIngredients(parsed.promptIngredients);
    if (parsed.promptServing) setPromptServing(parsed.promptServing);
  }
  const latest: (Output & { article: Article | null }) | null = useMemo(() => {
    // Dernier BROUILLON recette (les résultats worker ont une autre forme).
    const first = outputs.find((output) => {
      try {
        const parsed = JSON.parse(output.content_json) as { ingredients?: unknown; instructions?: unknown };
        return Array.isArray(parsed.ingredients) && Array.isArray(parsed.instructions);
      } catch {
        return false;
      }
    });
    if (!first) return null;
    try {
      return { ...first, article: JSON.parse(first.content_json) as Article };
    } catch {
      return { ...first, article: null };
    }
  }, [outputs]);
  const canPublish = approveText && approveImages && Boolean(latest?.article?.seoAudit?.publishReady);
  const workerTexts = useMemo(() => {
    const found: Array<{ id: string; title: string; created_at: string; text: string }> = [];
    for (const output of outputs) {
      try {
        const parsed = JSON.parse(output.content_json) as { mode?: string; text?: string };
        if ((parsed.mode === "worker-chatgpt" || parsed.mode === "worker-deepseek") && typeof parsed.text === "string" && parsed.text.length > 20) {
          found.push({ id: output.id, title: output.title, created_at: output.created_at, text: parsed.text.slice(0, 2000) });
        }
      } catch {
        // ignore
      }
    }
    return found;
  }, [outputs]);
  const workerImages = useMemo(() => {
    const found: Array<{ id: string; title: string; created_at: string; images: Array<{ role: string; dataUrl: string }> }> = [];
    for (const output of outputs) {
      try {
        const parsed = JSON.parse(output.content_json) as { mode?: string; images?: Array<{ role: string; dataUrl: string }> };
        if (parsed.mode === "worker-gemini-images" && Array.isArray(parsed.images) && parsed.images.length) {
          found.push({ id: output.id, title: output.title, created_at: output.created_at, images: parsed.images });
        }
      } catch {
        // ignore
      }
    }
    return found;
  }, [outputs]);

  return (
    <div className="rc-layout">
      <section className="panel">
        <div className="workspace-topline"><span>Brief complet — coller tout en une fois</span><small>{hasBrowserAi ? "Comptes navigateur déclarés" : "Moteur local gratuit"}</small></div>
        {isExample && (
          <div className="example-notice">
            <strong>Exemple en lecture seule — les champs sont verrouillés.</strong>
            <p>Cliquez ci-dessous pour créer votre copie privée et écrire votre recette.</p>
            <form action={duplicateExampleAction}>
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="moduleSlug" value="recipe-creator" />
              <button className="button" type="submit">Créer ma copie et écrire</button>
            </form>
          </div>
        )}
        <form action={genAction} className="project-form">
          <input type="hidden" name="projectId" value={projectId} />
          <label>Collez ici tout le texte de votre recette<textarea ref={briefRef} name="brief" value={brief} onChange={(e) => setBrief(e.target.value)} rows={8} placeholder={"Title: Cookies protéinés\nIngredients:\n...\nStep by Step:\n...\nImage 1: ..."} disabled={isExample} /></label>
          <div className="info-strip">Détection auto — Titre : {d.title || "Non détecté"} • Ingrédients : {d.ing} • Étapes : {d.stepsCount} • Images : {d.images}/4{d.imageOnly ? " • Brief image détecté" : ""} <button type="button" className="button button-small" onClick={fillFromBrief} disabled={isExample}>Remplir les champs depuis le brief</button></div>
          <div className="settings-grid">
            <label>Titre<input name="recipeTitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. pain au chocolat facile" disabled={isExample} /></label>
            <label>Mot-clé<input name="focusKeyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="easy chocolate bread" disabled={isExample} /></label>
            <label className="setting-wide">Ingrédients (un par ligne)<textarea name="ingredients" value={ingredients} onChange={(e) => setIngredients(e.target.value)} rows={5} disabled={isExample} /></label>
            <label className="setting-wide">Étapes (une par ligne)<textarea name="steps" value={steps} onChange={(e) => setSteps(e.target.value)} rows={5} disabled={isExample} /></label>
            <label>Langue<select name="language" value={lang} onChange={(e) => setLang(e.target.value)} disabled={isExample}><option value="fr">Français</option><option value="en">English</option><option value="ar">العربية</option></select></label>
            <label>Meta description<textarea name="metaDescription" value={meta} onChange={(e) => setMeta(e.target.value)} rows={2} disabled={isExample} /></label>
            <label>Titre SEO (optionnel)<input name="seoTitle" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="Ex. Easy Chocolate Bread (No Yeast)" disabled={isExample} /></label>
            <label>Auteur (rotation auto si vide)<input name="authorName" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Ex. Salma B." disabled={isExample} /></label>
            <label>Anti-doublon<select name="duplicatePolicy" value={dupPolicy} onChange={(e) => setDupPolicy(e.target.value)} disabled={isExample}><option value="ask">Demander confirmation</option><option value="force_new">Toujours forcer</option><option value="update_existing">Préparer la mise à jour</option></select></label>
            <label className="setting-wide">Direction images<textarea name="imageDirection" value={direction} onChange={(e) => setDirection(e.target.value)} rows={2} disabled={isExample} /></label>
            <label className="setting-wide">Liens internes (maillage SEO — un par ligne : Titre | https://votresite.com/…)<textarea name="internalLinks" value={internalLinks} onChange={(e) => setInternalLinks(e.target.value)} rows={2} placeholder="Ex. Tajine poulet citron | https://monsite.com/tajine-poulet-citron" disabled={isExample} /></label>
            <label className="setting-wide">Prompt image 1 — Featured (4:3)<textarea name="promptFeatured" value={promptFeatured} onChange={(e) => setPromptFeatured(e.target.value)} rows={3} placeholder="Détecté depuis le brief ou à compléter" disabled={isExample} /></label>
            <label className="setting-wide">Prompt image 2 — Hero (3:4)<textarea name="promptHero" value={promptHero} onChange={(e) => setPromptHero(e.target.value)} rows={3} placeholder="Détecté depuis le brief ou à compléter" disabled={isExample} /></label>
            <label className="setting-wide">Prompt image 3 — Ingrédients (3:4)<textarea name="promptIngredients" value={promptIngredients} onChange={(e) => setPromptIngredients(e.target.value)} rows={3} placeholder="Détecté depuis le brief ou à compléter" disabled={isExample} /></label>
            <label className="setting-wide">Prompt image 4 — Service (3:4)<textarea name="promptServing" value={promptServing} onChange={(e) => setPromptServing(e.target.value)} rows={3} placeholder="Détecté depuis le brief ou à compléter" disabled={isExample} /></label>
          </div>
          <div className="settings-actions">
            <small>{isExample ? "Dupliquez pour activer" : "Brouillon privé, aucune publication auto"}</small>
            <button className="button" type="submit" disabled={isExample || genPending}>{genPending ? "Génération…" : "Générer le brouillon"}</button>
          </div>
        </form>
        {genState.message && <p className="billing-note" role="status">{genState.message}</p>}
        {!hasBrowserAi && <p className="billing-note">Astuce : déclarez vos comptes navigateur gratuits (ChatGPT, Gemini…) dans Mes connexions → le worker local s&apos;en servira pour l&apos;IA.</p>}
      </section>

      <section className="panel">
        <div className="workspace-topline"><span>Introduction IA (worker local, gratuit)</span><small>ChatGPT / DeepSeek via vos profils</small></div>
        <form action={introAction} className="settings-actions">
          <input type="hidden" name="projectId" value={projectId} />
          <label>IA worker<select name="adapter" defaultValue="chatgpt"><option value="chatgpt">ChatGPT web</option><option value="deepseek">DeepSeek web</option></select></label>
          <label>Profil<input name="browserProfile" value={workerProfile} onChange={(e) => setWorkerProfile(e.target.value)} maxLength={80} /></label>
          <small>{hasBrowserAi ? "Introduction rédigée par vos comptes navigateur (gratuit)." : "Déclarez un compte navigateur, connectez-vous via LOGIN.bat, démarrez le worker."}</small>
          <button className="button button-small" type="submit" disabled={isExample || introPending}>{introPending ? "Envoi…" : "Générer l'intro via worker"}</button>
        </form>
        {introState.message && <p className="billing-note" role="status">{introState.message}</p>}
        {workerTexts.length > 0 && (
          <div>
            <div className="workspace-topline"><span>Intros IA du worker</span><small>{latest ? "Cliquez pour appliquer" : "Générez un brouillon pour pouvoir les appliquer"}</small></div>
            {workerTexts.map((item) => (
              <details className="output-item" key={item.id}>
                <summary><div><strong>{item.title}</strong><small>{new Date(item.created_at).toLocaleString("fr-FR")}</small></div><span>Appliquer</span></summary>
                <pre>{item.text}</pre>
                <form action={applyWorkerIntroAction}>
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="workerOutputId" value={item.id} />
                  <button className="button button-small" type="submit" disabled={!latest}>Utiliser comme introduction</button>
                </form>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className="panel output-panel">
        <div className="workspace-topline"><div><span>Prévisualisation + validation</span><small>{outputs.length} version(s)</small></div></div>
        {!latest || !latest.article ? (
          <div className="output-empty"><strong>Aucun brouillon</strong><p>Renseignez le brief puis lancez la génération.</p></div>
        ) : (
          <>
            <h2>{latest.article.title}</h2>
            <p className="billing-note">SEO : {latest.article.seoTitle} • {latest.article.metaDescription}{typeof latest.article.wordCount === "number" ? ` • ${latest.article.wordCount} mots` : ""}</p>
            {latest.article.seoAudit && (
              <div className="seo-dashboard">
                <div className={`seo-score ${latest.article.seoAudit.publishReady ? "seo-ready" : "seo-blocked"}`}>
                  <strong>{latest.article.seoAudit.score}</strong><span>/100</span><small>{latest.article.seoAudit.grade}</small>
                </div>
                <div className="seo-checks">
                  {latest.article.seoAudit.checks.map((check) => (
                    <div className={`seo-check seo-${check.severity}`} key={check.id}>
                      <span>{check.severity === "pass" ? "✓" : check.severity === "critical" ? "×" : "!"}</span>
                      <div><strong>{check.label}</strong><small>{check.detail}</small></div>
                      <b>{check.points}/{check.maximum}</b>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {latest.article.seoBrief && (
              <details className="seo-brief-card">
                <summary><strong>Brief SEO utilisé</strong><span>Intent, cluster, plan et maillage interne</span></summary>
                <div className="seo-brief-grid">
                  <div><small>Intent</small><strong>{latest.article.seoBrief.searchIntent}</strong><p>{latest.article.seoBrief.audience}</p></div>
                  <div><small>Mots-clés secondaires</small><p>{(latest.article.seoBrief.secondaryKeywords || []).join(" • ")}</p></div>
                  <div><small>Plan recommandé</small><ol>{(latest.article.seoBrief.outline || []).map((item) => <li key={item}>{item}</li>)}</ol></div>
                  <div><small>Liens internes à ajouter</small><ul>{(latest.article.seoBrief.internalLinkIdeas || []).map((item) => <li key={item}>{item}</li>)}</ul></div>
                </div>
              </details>
            )}
            <div className="output-item"><pre>{`${latest.article.introduction || ""}\n\nINGRÉDIENTS:\n- ${(latest.article.ingredients || []).join("\n- ")}\n\nINSTRUCTIONS:\n${(latest.article.instructions || []).map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nFAQ:\n${(latest.article.faq || []).map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n")}`}</pre></div>
            <div className="output-item"><pre>{`IMAGES (prompts pour Gemini) :\n1. ${latest.article.imagePrompts?.featured || ""}\n2. ${latest.article.imagePrompts?.hero || ""}\n3. ${latest.article.imagePrompts?.ingredients || ""}\n4. ${latest.article.imagePrompts?.serving || ""}`}</pre></div>
            {(latest.article.internalLinks || []).length > 0 && (
              <div className="output-item"><strong>Maillage interne ({(latest.article.internalLinks || []).length})</strong><ul>{(latest.article.internalLinks || []).map((l) => <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer">{l.label}</a></li>)}</ul></div>
            )}
            <p className="billing-note">Carte WP Recipe Maker : créée automatiquement au publish (shortcode remplacé par le vrai id, sinon plugin à installer).</p>
            {latest.article.stockPhotos && latest.article.stockPhotos.length > 0 && (
              <div>
                <div className="workspace-topline"><span>Photos pro (Pexels, fiable)</span></div>
                <div className="settings-preview-grid">
                  {latest.article.stockPhotos.map((photo, index) => (
                    <div className="setting-preview" key={index}>
                      <small>{photo.alt.slice(0, 60)} — {photo.photographer}</small>
                      <a href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt={photo.alt} loading="lazy" style={{ width: "100%", borderRadius: 12 }} /></a>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="output-toolbar"><a href={`/api/outputs/${latest.id}`}>Télécharger JSON</a></div>
            <div className="settings-grid">
              <label><input type="checkbox" checked={approveText} onChange={(e) => setApproveText(e.target.checked)} /> Texte validé (titre, contenu, SEO)</label>
              <label><input type="checkbox" checked={approveImages} onChange={(e) => setApproveImages(e.target.checked)} /> Images validées (4 prompts relus)</label>
            </div>
            <form action={revAction} className="project-form">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="outputId" value={latest.id} />
              <label>Demander une modification à l&apos;IA<textarea name="instruction" rows={3} placeholder="Ex. Raccourcis l'intro et ajoute un conseil conservation." required /></label>
              <button className="button button-small" type="submit" disabled={revPending}>{revPending ? "Révision…" : "Appliquer la modification (nouvelle version)"}</button>
            </form>
            {revState.message && <p className="billing-note" role="status">{revState.message}</p>}
            <form action={pubAction} className="settings-actions">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="outputId" value={latest.id} />
              <input type="hidden" name="approved" value={canPublish ? "1" : ""} />
              <small>{canPublish ? (hasWordPress ? `SEO + validations OK — ${workerImages.length > 0 ? `${workerImages[0].images.length}/4 image(s) worker prête(s)` : "aucune image worker : prompts seuls"}. Création d’un brouillon WordPress.` : "SEO + validations OK — connectez WordPress pour publier.") : latest.article.seoAudit && !latest.article.seoAudit.publishReady ? "Audit SEO bloqué : corrigez les erreurs critiques avant WordPress." : "Validez texte + images pour débloquer la publication."}</small>
              <button className="button button-small" type="submit" disabled={!canPublish || pubPending}>{pubPending ? "Publication…" : hasWordPress ? "Publier en brouillon WordPress" : "Valider et publier (WP non connecté)"}</button>
            </form>
            {pubState.message && <p className="billing-note" role="status">{pubState.message}</p>}
            {pubState.link && <p className="billing-note"><a href={pubState.link} target="_blank" rel="noreferrer">Ouvrir le brouillon WordPress →</a></p>}
            <form action={imgAction} className="settings-actions">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="outputId" value={latest.id} />
              <label>Profil Gemini local<input name="browserProfile" value={workerProfile} onChange={(e) => setWorkerProfile(e.target.value)} maxLength={80} /></label>
              <small>{hasBrowserAi ? "Images réelles via votre compte Gemini (worker local)." : "Déclarez Gemini dans Mes connexions, connectez-vous via LOGIN.bat, démarrez le worker."}</small>
              <button className="button button-small" type="submit" disabled={imgPending}>{imgPending ? "Envoi…" : "Générer 4 images via worker (Gemini)"}</button>
            </form>
            {imgState.message && <p className="billing-note" role="status">{imgState.message}</p>}
            {workerImages.length > 0 && (
              <div>
                <div className="workspace-topline"><span>Images Gemini du worker</span><small>{workerImages[0].title}</small></div>
                <div className="settings-preview-grid">
                  {workerImages[0].images.map((img) => (
                    <div className="setting-preview" key={img.role}>
                      <small>{img.role}</small>
                      <a href={img.dataUrl} target="_blank" rel="noreferrer"><img src={img.dataUrl} alt={`${latest.title} — ${img.role}`} loading="lazy" style={{ width: "100%", borderRadius: 12 }} /></a>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
