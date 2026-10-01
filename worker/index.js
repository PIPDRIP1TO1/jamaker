/**
 * JA MAKER Worker local — vos comptes navigateur gratuits, zéro clé API.
 *
 * 1. Vos profils restent sur VOTRE machine (rien n'est envoyé au SaaS sauf
 *    les logs et résultats des jobs).
 * 2. Le worker récupère les jobs "queued" de votre organisation, les exécute
 *    et renvoie le résultat.
 * 3. Adapters : "technical" (validation locale, toujours dispo). Ajoutez vos
 *    adapters navigateur (ChatGPT, DeepSeek, Qwen...) dans ADAPTERS en suivant
 *    le pattern de D:\VIRAL CLONER\source\automations (profil persistant +
 *    file 1-requête-à-la-fois).
 *
 * Config via variables d'environnement :
 *   JAMAKER_URL=https://votre-saas.com (ou http://localhost:3100 en dev)
 *   JAMAKER_WORKER_TOKEN=jwk_... (créé dans Automatisations → Worker local)
 *   JAMAKER_POLL_MS=15000 (optionnel)
 */

const BASE_URL = (process.env.JAMAKER_URL || "http://localhost:3100").replace(/\/$/, "");
const WORKER_TOKEN = process.env.JAMAKER_WORKER_TOKEN || "";
const POLL_MS = Number(process.env.JAMAKER_POLL_MS || 15000);

if (!WORKER_TOKEN) {
  console.error("JAMAKER_WORKER_TOKEN manquant. Créez-le dans Automatisations → Worker local.");
  process.exit(1);
}

async function api(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worker_token: WORKER_TOKEN, ...body }),
  });
  if (res.status === 401) throw new Error("Token worker invalide ou révoqué.");
  if (!res.ok) throw new Error(`SaaS ${res.status}`);
  return res.json();
}

// Adapter "technical" : miroir de l'exécution serveur, 100% local.
// Étapes activées du projet → logs de validation, sans action externe.
async function technicalAdapter(job, logs) {
  logs = logs || [];
  let config = {};
  try {
    config = JSON.parse(job.project.config_json || "{}");
  } catch {
    config = {};
  }
  const steps = Array.isArray(config.steps) ? config.steps.filter((s) => s.enabled !== false) : [];
  for (const step of steps) {
    logs.push({ level: "success", message: `${step.label || "Étape"} validée par le worker local.` });
  }
  logs.push({ level: "success", message: "Exécution worker terminée sans action externe." });
  return {
    status: "completed",
    logs,
    output: {
      title: `Résultat worker — ${job.project.name}`,
      content: { mode: "worker-technical", steps: steps.map((s) => s.label), executedAt: new Date().toISOString() },
    },
  };
}

const ADAPTERS = { technical: technicalAdapter };
try {
  ADAPTERS.chatgpt = require("./adapters/chatgpt.js").chatgptArticle;
} catch (error) {
  console.error("Adapter chatgpt indisponible :", (error && error.message) || error);
}
try {
  ADAPTERS.deepseek = require("./adapters/deepseek.js").deepseekArticle;
} catch (error) {
  console.error("Adapter deepseek indisponible :", (error && error.message) || error);
}
try {
  ADAPTERS["gemini-images"] = require("./adapters/gemini-images.js").geminiImages;
} catch (error) {
  console.error("Adapter gemini-images indisponible :", (error && error.message) || error);
}

function pickAdapter(job) {
  let inputs = {};
  try {
    inputs = JSON.parse(job.project.config_json || "{}").inputs || {};
  } catch {
    inputs = {};
  }
  const wanted = typeof inputs.workerAdapter === "string" ? inputs.workerAdapter : "technical";
  return ADAPTERS[wanted] || ADAPTERS.technical;
}

async function runOnce() {
  const { job } = await api("/api/worker/jobs/next", {});
  if (!job) return false;
  console.log(`Job ${job.id} (${job.project.module_slug} — ${job.project.name})`);
  const logs = [{ level: "info", message: `Worker local : job ${job.id} pris en charge.` }];
  try {
    const result = await pickAdapter(job)(job, logs);
    await api(`/api/worker/jobs/${job.id}/complete`, { ...result, logs: [...logs, ...(result.logs || [])] });
    console.log(`Job ${job.id} : ${result.status}`);
  } catch (error) {
    logs.push({ level: "error", message: String((error && error.message) || error).slice(0, 500) });
    await api(`/api/worker/jobs/${job.id}/complete`, {
      status: "failed",
      error_message: String((error && error.message) || error).slice(0, 500),
      logs,
    });
    console.error(`Job ${job.id} échec :`, (error && error.message) || error);
  }
  return true;
}

async function main() {
  console.log(`Worker JA MAKER → ${BASE_URL} (poll ${POLL_MS}ms) [adapters: ${Object.keys(ADAPTERS).join(",")}]`);
  for (;;) {
    try {
      await runOnce();
    } catch (error) {
      console.error("Poll :", (error && error.message) || error);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

main();
