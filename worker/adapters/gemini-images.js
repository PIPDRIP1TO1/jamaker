/**
 * Adapter Gemini web — images réelles via le compte navigateur (gratuit).
 * Pilote gemini.google.com (profil déjà connecté) en CDP brut, demande la
 * génération d'image pour chaque prompt, récupère les images en base64.
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const { profileDir, loadMapping } = require("./chatgpt.js");

const GEMINI_URL = "https://gemini.google.com/app";
const NAV_TIMEOUT_MS = 60000;
const IMAGE_TIMEOUT_MS = 600000;
const POLL_MS = 3000;

function chromePaths() {
  return [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    (process.env.LOCALAPPDATA || "") + "\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);
}

async function waitJson(url, timeoutMs, predicate) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (!predicate || predicate(data)) return data;
      }
    } catch {
      // chrome pas encore prêt
    }
    if (Date.now() - start > timeoutMs) throw new Error("Chrome introuvable (remote debugging).");
    await new Promise((r) => setTimeout(r, 500));
  }
}

function throwIfDead(child, profile) {
  if (child.exitCode !== null || child.signalCode) {
    throw new Error(`Chrome s'est fermé au démarrage avec ce profil (corrompu ?). Recréez-le : « npm run login -- gemini "${profile}" » avec un NOM NEUF, connectez-vous, puis déclarez ce nom dans le SaaS.`);
  }
}

function connect(url, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    const timer = setTimeout(() => reject(new Error("WebSocket CDP timeout.")), 15000);
    ws.onopen = () => {
      clearTimeout(timer);
      resolve({
        send(method, params, sendTimeoutMs = 30000) {
          return new Promise((res, rej) => {
            const callId = ++id;
            const timeout = setTimeout(() => {
              pending.delete(callId);
              rej(new Error(`CDP ${method} sans réponse (30s).`));
            }, sendTimeoutMs);
            pending.set(callId, {
              res: (value) => {
                clearTimeout(timeout);
                res(value);
              },
              rej: (error) => {
                clearTimeout(timeout);
                rej(error);
              },
            });
            try {
              ws.send(JSON.stringify({ id: callId, method, params: params || {} }));
            } catch (error) {
              clearTimeout(timeout);
              pending.delete(callId);
              rej(error);
            }
          });
        },
        close() {
          try {
            ws.close();
          } catch {
            // ignore
          }
        },
      });
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg.id && pending.has(msg.id)) {
          const { res, rej } = pending.get(msg.id);
          pending.delete(msg.id);
          if (msg.error) rej(new Error(msg.error.message || "CDP error"));
          else res(msg.result);
        }
      } catch {
        // ignore
      }
    };
    ws.onerror = () => reject(new Error("WebSocket CDP impossible."));
  });
}

async function evaluate(cdp, expression) {
  // awaitPromise obligatoire : FETCH_IMAGE_JS est async, sinon on reçoit
  // un handle de promesse vide au lieu du résultat (boucle infinie).
  const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error("Évaluation page impossible.");
  return result.result && result.result.value;
}

const COMPOSER_JS = `(() => {
  const el = document.querySelector('rich-textarea textarea, div[contenteditable="true"], textarea[aria-label]');
  return !!el;
})()`;

const SEND_IMAGE_PROMPT_JS = `(TEXT => {
  const box = document.querySelector('rich-textarea textarea') || document.querySelector('div[contenteditable="true"]') || document.querySelector('textarea[aria-label]');
  if (!box) return 'no-composer';
  box.focus();
  const isContentEditable = box.getAttribute && box.getAttribute('contenteditable') === 'true';
  if (isContentEditable) {
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, TEXT);
  } else {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(box), 'value')?.set || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(box, TEXT); else box.value = TEXT;
  }
  box.dispatchEvent(new Event('input', { bubbles: true }));
  box.dispatchEvent(new Event('change', { bubbles: true }));
  const btn = document.querySelector('button[aria-label*="Send" i], button.send-button, button[mattooltip*="Send" i]');
  if (btn) { btn.click(); return 'clicked'; }
  box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
  return 'enter';
})`;

// Compte les images générées (grandes, ni avatar ni icône). Gemini sert les
// visuels générés en blob: → INCLUS (téléchargeables via fetch dans la page).
const COLLECT_IMAGES_JS = `(KNOWN => {
  const known = new Set(JSON.parse(KNOWN || '[]'));
  const imgs = Array.from(document.querySelectorAll('img')).filter((img) => {
    const w = img.naturalWidth || img.width || 0;
    const src = img.currentSrc || img.src || '';
    if (w < 300 || !src) return false;
    if (src.startsWith('data:') && src.length < 50000) return false;
    if (/avatar|profile|icon|logo|emoji/i.test(src)) return false;
    return true;
  }).map((img) => img.currentSrc || img.src);
  const fresh = imgs.filter((src) => !known.has(src));
  return JSON.stringify({ all: imgs.slice(-12), fresh });
})`;

const FETCH_IMAGE_JS = `(URL => (async () => {
  const all = Array.from(document.querySelectorAll('img'));
  const img = all.find((i) => (i.currentSrc || i.src) === URL) || all.find((i) => (i.naturalWidth || i.width || 0) >= 300);
  if (!img) throw new Error('absente');
  try { await img.decode(); } catch (e) {}
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || 800;
  c.height = img.naturalHeight || 600;
  c.getContext('2d').drawImage(img, 0, 0);
  const dataUrl = c.toDataURL('image/jpeg', 0.88);
  if (typeof dataUrl !== 'string' || dataUrl.length < 20000) throw new Error('vide');
  return JSON.stringify({ contentType: 'image/jpeg', dataUrl: dataUrl.slice(0, 4000000) });
})())`;

async function geminiImages(job, logs) {
  const mapping = loadMapping();
  let inputs = {};
  try {
    inputs = JSON.parse(job.project.config_json || "{}").inputs || {};
  } catch {
    inputs = {};
  }
  const profile = typeof inputs.browserProfile === "string" && inputs.browserProfile.trim() ? inputs.browserProfile.trim() : "Profil principal";
  const prompts = inputs.imagePrompts && typeof inputs.imagePrompts === "object" ? inputs.imagePrompts : null;
  const roles = ["featured", "hero", "ingredients", "serving"];
  const jobs = roles
    .map((role) => ({ role, text: String((prompts && prompts[role]) || inputs[`prompt${role[0].toUpperCase()}${role.slice(1)}`] || "").trim() }))
    .filter((p) => p.text);
  if (!jobs.length) throw new Error("Aucun prompt image dans le projet (générez d'abord le brouillon).");
  const dir = profileDir("gemini", profile, mapping);
  if (!fs.existsSync(dir)) throw new Error(`Profil local introuvable : ${dir}. Lancez « npm run login -- gemini "${profile}" » d'abord.`);
  const chrome = chromePaths().find((p) => fs.existsSync(p));
  if (!chrome) throw new Error("Chrome introuvable sur cette machine.");
  const port = 9433 + Math.floor(Math.random() * 60);
  logs.push({ level: "info", message: `Gemini web : profil « ${profile} », ${jobs.length} image(s) à générer.` });
  const { killProfileLock } = require("../profiles.js");
  killProfileLock(dir);
  await new Promise((r) => setTimeout(r, 2000));

  const child = spawn(chrome, [
    `--user-data-dir=${dir}`,
    `--remote-debugging-port=${port}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--headless=new",
    "about:blank",
  ], { detached: true, stdio: "ignore" });
  child.unref();
  let cdp = null;
  try {
    await waitJson(`http://127.0.0.1:${port}/json/version`, 20000);
    throwIfDead(child, profile);
    const targets = await waitJson(`http://127.0.0.1:${port}/json/list`, NAV_TIMEOUT_MS, (list) => Array.isArray(list) && list.some((t) => t.type === "page"));
    const page = targets.find((t) => t.type === "page" && t.url.startsWith("http")) || targets.find((t) => t.type === "page");
    if (!page || !page.webSocketDebuggerUrl) throw new Error("Onglet Chrome introuvable.");
    cdp = await connect(page.webSocketDebuggerUrl);
    await cdp.send("Page.enable", {});
    await cdp.send("Runtime.enable", {});
    await cdp.send("Page.navigate", { url: GEMINI_URL });
    const start = Date.now();
    let ready = false;
    while (Date.now() - start < NAV_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      try {
        ready = await evaluate(cdp, COMPOSER_JS);
        if (ready) break;
      } catch {
        // page en chargement
      }
    }
    if (!ready) throw new Error("Gemini : zone de saisie introuvable (connectez-vous d'abord via « npm run login »).");
    const loggedRaw = await evaluate(cdp, `(() => { const head = (document.body ? document.body.innerText : '').slice(0, 1500); const loginWall = /(^|\n)\s*(se connecter|sign in|log in)\b/i.test(head) || /accounts\.google\.com/i.test(window.location.href); return JSON.stringify({ loginWall }); })()`).catch(() => '{"loginWall":false}');
    let loginWall = false;
    try {
      loginWall = JSON.parse(loggedRaw).loginWall === true;
    } catch {
      loginWall = false;
    }
    if (loginWall) throw new Error(`Gemini : session absente sur ce profil (mur login détecté). Relancez « npm run login -- gemini "${profile}" » et connectez-vous.`);

    const images = [];
    let known = [];
    for (const item of jobs) {
      const instruction = `Generate an image, no text in the image: ${item.text.slice(0, 800)}`;
      const sent = await evaluate(cdp, `(${SEND_IMAGE_PROMPT_JS})(${JSON.stringify(instruction)})`);
      logs.push({ level: "info", message: `Image ${item.role} demandée (${sent}). Génération en cours…` });
      const imgStart = Date.now();
      let dataUrl = "";
      let lastFreshCount = -1;
      for (;;) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        let state;
        try {
          state = JSON.parse(await evaluate(cdp, `(${COLLECT_IMAGES_JS})(${JSON.stringify(JSON.stringify(known))})`));
        } catch (err) {
          logs.push({ level: "warning", message: `Scan ${item.role} erreur : ${String((err && err.message) || err).slice(0, 120)}` });
          continue;
        }
        const freshCount = state.fresh ? state.fresh.length : 0;
        if (freshCount !== lastFreshCount) {
          logs.push({ level: "info", message: `Scan ${item.role} : ${freshCount} nouvelle(s) image(s).` });
          lastFreshCount = freshCount;
        }
        if (state.fresh && state.fresh.length) {
          const src = state.fresh[state.fresh.length - 1];
          logs.push({ level: "info", message: `Candidat ${item.role} : ${(src || "").slice(0, 60)}` });
          try {
            const rawFetch = await evaluate(cdp, `(${FETCH_IMAGE_JS})(${JSON.stringify(src)})`);
            const fetched = JSON.parse(rawFetch);
            if (typeof fetched.dataUrl === "string" && fetched.dataUrl.startsWith("data:image")) {
              dataUrl = fetched.dataUrl;
              known = state.all;
              break;
            }
            logs.push({ level: "warning", message: `Téléchargement ${item.role} : format inattendu.` });
          } catch (err) {
            logs.push({ level: "warning", message: `Téléchargement ${item.role} erreur : ${String((err && err.message) || err).slice(0, 150)}` });
            continue;
          }
        }
        if (Date.now() - imgStart > IMAGE_TIMEOUT_MS) break;
      }
      if (!dataUrl) {
        logs.push({ level: "warning", message: `Image ${item.role} : rien de récupérable (délai dépassé).` });
        continue;
      }
      logs.push({ level: "success", message: `Image ${item.role} reçue (${Math.round(dataUrl.length / 1024)} Ko).` });
      images.push({ role: item.role, dataUrl });
    }
    if (!images.length) throw new Error("Aucune image récupérée depuis Gemini.");
    return {
      status: "completed",
      logs,
      output: {
        title: `Images Gemini — ${job.project.name}`,
        content: { mode: "worker-gemini-images", provider: "gemini", profile, images, executedAt: new Date().toISOString() },
      },
    };
  } finally {
    try {
      if (cdp) cdp.close();
    } catch {
      // ignore
    }
    try {
      child.kill();
    } catch {
      // ignore
    }
  }
}

module.exports = { geminiImages };
