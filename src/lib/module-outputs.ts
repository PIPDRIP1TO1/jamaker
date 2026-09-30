import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import type { ProjectConfig } from "@/lib/module-projects";

export type ModuleOutput = { id: string; output_type: string; status: "ready" | "failed"; title: string; content_json: string; created_at: string };

function cleanInputs(inputs: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(inputs).filter(([, value]) => String(value ?? "").trim()).map(([key, value]) => [key, String(value).trim()]));
}

function buildDraft(moduleSlug: string, config: ProjectConfig) {
  const inputs = cleanInputs(config.inputs || {});
  const activeSteps = config.steps.filter((step) => step.enabled).map((step, index) => ({ order: index + 1, action: step.label }));
  const common = { module: moduleSlug, mode: "local-technical-preview", inputs, activeSteps, externalAction: false };
  if (moduleSlug === "animated-story") {
    const part = Number(inputs.episodeNumber || 1);
    const series = inputs.seriesName || "Série sans titre";
    const idea = inputs.direction || inputs.chapterIdea || "Une nouvelle aventure visuelle et émotionnelle";
    const continuity = inputs.previousEpisode || "Aucune continuité précédente fournie";
    const bible = inputs.seriesBible || "Identité des personnages et décor à préciser";
    const sound = inputs.dialogueMode === "dialogue" ? "short natural dialogue, cinematic music and synchronized sound effects" : "visual storytelling only, cinematic music and synchronized sound effects, no spoken dialogue";
    const ending = inputs.endingMode === "complete" ? "a satisfying complete ending" : "an emotional payoff followed by a light visual cliffhanger";
    const bridge = `At exactly 15.0 seconds, hold a clean match frame: the characters remain fully visible, proportions locked, camera direction unchanged, action paused at its most readable transition point.`;
    return { ...common, deliverable: {
      episode: { series, part, title: `${series} — Part ${part}`, hook: idea, storySummary: `Continue from: ${continuity}. Develop: ${idea}. Finish with ${ending}.`, nextPart: part + 1 },
      segmentA: { duration: "0–15s", beats: ["0–3s: immediate visual hook", "3–7s: clear goal", "7–11s: escalating obstacle", "11–15s: transition action"], prompt: `Vertical 9:16 cinematic animated episode, PART ${part}, segment A (0–15 seconds). CONTINUITY: ${continuity}. STORY DIRECTION: ${idea}. CHARACTER AND VISUAL LOCK: ${bible}. Use fast readable 2–4 second beats, consistent anatomy and scale, ${sound}. ${bridge}` },
      bridge: { matchFrame: bridge },
      segmentB: { duration: "15–30s", beats: ["15–19s: resume exact match frame", "19–23s: complication peaks", "23–27s: emotional payoff", "27–30s: ending"], prompt: `Vertical 9:16 cinematic animated episode, PART ${part}, segment B (15–30 seconds). START FROM THE EXACT PROVIDED MATCH FRAME with identical characters, wardrobe, proportions, lighting, lens and screen direction. Continue: ${idea}. Deliver ${ending}; ${sound}. No reset, no redesign, no time jump.` },
      cover: { format: "Instagram Reel cover 9:16", headline: `${series} · Part ${part}`, prompt: `Create a polished vertical cover using the same locked character design: ${bible}. Show the main emotional moment from this episode, strong focal point, safe title area, no extra characters, no watermark.` },
      instagram: { caption: `${series} — Part ${part}. A new chapter begins… What do you think happens next?`, callToAction: "Follow for Part " + (part + 1) },
    } };
  }
  if (moduleSlug === "recipe-creator") {
    const title = inputs.recipeTitle || "Recette sans titre";
    const ingredients = (inputs.ingredients || "").split(/\r?\n/).map((item) => item.replace(/^[-*\d.)\s]+/, "").trim()).filter(Boolean);
    const steps = (inputs.steps || "").split(/\r?\n/).map((item) => item.replace(/^[-*\d.)\s]+/, "").trim()).filter(Boolean);
    const keyword = inputs.focusKeyword || title.toLowerCase();
    const imageDirection = inputs.imageDirection || "bright natural food photography, close framing, realistic textures, clean styling";
    return { ...common, deliverable: {
      article: { title, language: inputs.language || "en", introduction: `${title} is presented as an approachable recipe with clear ingredients and practical steps.`, ingredients, instructions: steps, conclusion: `Serve ${title} fresh and adjust seasoning to taste.` },
      seo: { focusKeyword: keyword, seoTitle: `${title} | Easy Step-by-Step Recipe`, metaDescription: inputs.metaDescription || `Learn how to make ${title} with simple ingredients, clear instructions and practical serving tips.` },
      imagePrompts: { featured: `Featured food image 4:3 of ${title}, ${imageDirection}, finished dish fills the frame, no text, no watermark.`, hero: `Vertical hero image 3:4 of ${title}, ${imageDirection}, appetizing close-up, no text.`, ingredients: `Vertical ingredients image 3:4 for ${title}, all listed ingredients neatly arranged, ${imageDirection}, no labels.`, serving: `Vertical serving image 3:4 of ${title} ready to eat, ${imageDirection}, realistic portion and garnish.` },
      recipeSchema: { "@context": "https://schema.org", "@type": "Recipe", name: title, recipeIngredient: ingredients, recipeInstructions: steps.map((text, index) => ({ "@type": "HowToStep", position: index + 1, text })) },
      wordpress: { mode: inputs.wordpressMode || "draft", status: "connection-required", publicationAllowed: false },
    } };
  }
  if (moduleSlug === "recipe-video") {
    const recipe = inputs.recipeName || "Recette à définir";
    const sceneCount = Math.max(2, Math.min(12, Number(inputs.maxScenes || 4)));
    const duration = Math.max(4, Math.min(8, Number(inputs.sceneDuration || 4)));
    const direction = inputs.creativeDirection || "macro food cinematography, camera focused on the recipe, hands only when the action requires them";
    const actions = ["show the ingredients and target result", "prepare the main ingredient", "mix or season with precise hand movement", "shape or assemble the recipe", "cook with visible texture change", "check doneness", "plate the finished recipe", "final close-up and serving moment"];
    const scenes = Array.from({ length: sceneCount }, (_, index) => ({ id: `S${String(index + 1).padStart(2, "0")}`, durationSeconds: duration, action: actions[index % actions.length], startFrame: `Clean readable start frame for ${actions[index % actions.length]}`, endFrame: `Exact completed state of the action, ready to match the next scene`, prompt: `${inputs.aspectRatio || "9:16"} video of ${recipe}. Scene ${index + 1}/${sceneCount}: ${actions[index % actions.length]}. ${direction}. Preserve the same kitchen, utensils, ingredient state, lighting and female hands with transparent nail polish when hands are necessary. No face, no text, no watermark, no copied background from the source video.` }));
    return { ...common, deliverable: { project: inputs.projectName || recipe, recipe, analysis: { intervalSeconds: Number(inputs.analysisInterval || 0.8), maxFrames: Number(inputs.maxFrames || 180), sourceVideo: "upload-required", copyrightRule: "Source video guides recipe actions only; never reproduce its people, hands, utensils, board, pan or décor." }, format: inputs.aspectRatio || "9:16", sceneCount, totalDurationSeconds: sceneCount * duration, continuityLock: "Same approved kitchen, tool identity, food state progression and hands across all scenes.", scenes, qualityGate: { startEndPairsRequired: true, continuityReviewRequired: true, status: "awaiting-source-video" } } };
  }
  if (moduleSlug === "cookbook-marketing") {
    const title = inputs.bookTitle || "Cookbook à définir";
    const url = inputs.offerUrl || "Lien à compléter";
    const price = Number(inputs.price || 12.99);
    const weeks = Math.max(1, Math.min(12, Number(inputs.weeks || 4)));
    const visualCount = Math.max(1, Math.min(4, Number(inputs.visualCount || 4)));
    const brief = inputs.campaignBrief || `Présenter les bénéfices pratiques de ${title}`;
    const start = /^\d{4}-\d{2}-\d{2}$/.test(inputs.startDate || "") ? new Date(`${inputs.startDate}T12:00:00Z`) : new Date();
    const dayOffsets = [0, 2, 4];
    const campaigns = Array.from({ length: weeks * 3 }, (_, index) => {
      const date = new Date(start); date.setUTCDate(start.getUTCDate() + Math.floor(index / 3) * 7 + dayOffsets[index % 3]);
      const dateValue = date.toISOString().slice(0, 10);
      const trackingUrl = url.includes("?") ? `${url}&utm_source=instagram&utm_medium=organic&utm_campaign=cookbook_${dateValue.replaceAll("-", "")}` : `${url}?utm_source=instagram&utm_medium=organic&utm_campaign=cookbook_${dateValue.replaceAll("-", "")}`;
      const angles = ["benefit-led hook", "what is inside", "easy recipe transformation", "social proof and urgency"];
      return { id: `campaign-${index + 1}`, date: dateValue, time: inputs.publishTime || "12:00", status: "draft", product: title, angle: angles[index % angles.length], caption: `${brief}\n\nDiscover ${title} for $${price.toFixed(2)}. Instant digital access and practical recipes you can use today.\n\nComment “COOKBOOK” and we’ll send the details.\n\n${trackingUrl}\n\n#cookbook #easyrecipes #homecooking #recipeideas`, visualPrompts: Array.from({ length: visualCount }, (_, visualIndex) => `Instagram carousel slide ${visualIndex + 1}/${visualCount}, 4:5 at 1080x1350, full-bleed professional food marketing visual for “${title}”, angle: ${angles[(index + visualIndex) % angles.length]}, coherent palette inspired by the official book cover, clean safe text zones, no blank lower area, no watermark.`) };
    });
    return { ...common, deliverable: { account: inputs.instagramHandle || "À connecter", title, destination: url, price, format: "Instagram 4:5 · 1080×1350", cadence: "Lundi, mercredi et vendredi", visualCount, campaignCount: campaigns.length, campaigns, metaDmReply: `Thanks for your interest in ${title}. It is available for $${price.toFixed(2)} with instant digital access. View it here: ${url}`, publishing: { status: "validation-required", externalAction: false } } };
  }
  if (moduleSlug === "video-editor") return { ...common, deliverable: { format: inputs.projectFormat || "9:16", resolution: inputs.resolution || "1080p", fps: Number(inputs.fps || 30), timeline: "Montage magnétique sans espace entre les clips", notes: inputs.editingNotes || "Notes à compléter" } };
  if (inputs.source || inputs.keywords) return { ...common, deliverable: { source: inputs.source || "Source à compléter", keywords: (inputs.keywords || "").split(",").map((item) => item.trim()).filter(Boolean), limit: Number(inputs.limit || 25), objective: inputs.objective || "Analyse à préciser", compliance: "Sources publiques autorisées uniquement" } };
  if (inputs.caption || inputs.publishAt) return { ...common, deliverable: { title: inputs.contentTitle || "Publication sans titre", caption: inputs.caption || "Caption à compléter", requestedSchedule: inputs.publishAt || "Non planifiée", connection: inputs.accountConnection || "not-connected", publicationStatus: "draft-validation-required" } };
  if (inputs.brief || inputs.outputFormat) return { ...common, deliverable: { brief: inputs.brief || "Brief à compléter", format: inputs.outputFormat || "1080x1350", quality: inputs.quality || "standard", status: "ready-for-render-provider" } };
  return { ...common, deliverable: { objective: inputs.objective || "Objectif à compléter", checklist: activeSteps.map((step) => step.action) } };
}

export async function generateModuleDraft(organizationId: string, projectId: string, moduleSlug: string, config: ProjectConfig) {
  const db = await getDb();
  const id = randomUUID();
  const content = buildDraft(moduleSlug, config);
  await db.query(`INSERT INTO module_outputs (id, project_id, organization_id, output_type, status, title, content_json) VALUES ($1, $2, $3, 'technical_draft', 'ready', $4, $5)`, [id, projectId, organizationId, `Prévisualisation technique — ${moduleSlug}`, JSON.stringify(content)]);
  if (moduleSlug === "animated-story") {
    const nextConfig = { ...config, inputs: { ...config.inputs, previousEpisode: JSON.stringify((content as { deliverable?: { episode?: unknown } }).deliverable?.episode || {}), episodeNumber: String(Math.max(1, Number(config.inputs.episodeNumber || 1)) + 1) } };
    await db.query("UPDATE module_projects SET status = 'ready', config_json = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND organization_id = $3", [JSON.stringify(nextConfig), projectId, organizationId]);
  } else {
    await db.query("UPDATE module_projects SET status = 'ready', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND organization_id = $2", [projectId, organizationId]);
  }
  return id;
}

export async function listModuleOutputs(organizationId: string, projectId: string) {
  const db = await getDb();
  const result = await db.query<ModuleOutput>("SELECT id, output_type, status, title, content_json, created_at FROM module_outputs WHERE organization_id = $1 AND project_id = $2 ORDER BY datetime(created_at) DESC LIMIT 8", [organizationId, projectId]);
  return result.rows;
}
