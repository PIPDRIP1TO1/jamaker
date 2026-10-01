/**
 * Adapter ChatGPT web (modèle VIRAL CLONER, gratuit, zéro dépendance).
 * Pilote le profil Chrome local déjà connecté via CDP brut (fetch + WebSocket natifs).
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const { profileDir, loadMapping } = require("../profiles.js");

const CHATGPT_URL = "https://chatgpt.com/";
const NAV_TIMEOUT_MS = 60000;
const ANSWER_TIMEOUT_MS = 240000;
const POLL_MS = 2000;

// Re-exportés pour compatibilité (gemini-images, scripts).
module.exports.profileDir = profileDir;
module.exports.loadMapping = loadMapping;

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

function throwIfDead(child, provider, profile) {
  if (child.exitCode !== null || child.signalCode) {
    throw new Error(`Chrome s'est fermé au démarrage avec ce profil (corrompu ?). Recréez-le : « npm run login -- ${provider} "${profile}" » avec un NOM NEUF, connectez-vous, puis déclarez ce nom dans le SaaS.`);
  }
}

function connect(url) {
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

async function evaluate(cdp, expression, awaitPromise) {
  const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: Boolean(awaitPromise), returnByValue: true });
  if (result.exceptionDetails) throw new Error("Évaluation page impossible.");
  return result.result && result.result.value;
}

const COMPOSER_JS = `(() => {
  const box = document.querySelector('main form [contenteditable="true"]') || document.querySelector('#prompt-textarea') || document.querySelector('main form textarea');
  if (!box) return false;
  const form = box.closest('form');
  return !!(form && form.querySelector('button[type="submit"], [data-testid="send-button"]'));
})()`;

const SEND_JS = `(TEXT => {
  const candidates = [
    document.querySelector('#prompt-textarea'),
    document.querySelector('main form textarea'),
    document.querySelector('main form [contenteditable="true"]'),
    document.querySelector('form textarea'),
    document.querySelector('form [contenteditable="true"]'),
  ].filter(Boolean);
  // Le vrai composer : son formulaire contient un bouton d'envoi.
  const box = candidates.find((el) => {
    const form = el.closest('form');
    return form && form.querySelector('button[type="submit"], [data-testid="send-button"]');
  }) || null;
  if (!box) return 'no-composer';
  const form = box.closest('form');
  if (!form) return 'no-form';
  const btnInfo = Array.from(form.querySelectorAll('button')).map((b) => (b.getAttribute('type') || '') + '/' + (b.getAttribute('aria-label') || '') + '/' + (b.getAttribute('data-testid') || '')).join(' ');
  box.focus();
  const isEditable = box.getAttribute && box.getAttribute('contenteditable') === 'true';
  if (isEditable) {
    document.execCommand('selectAll', false, null);
    if (!document.execCommand('insertText', false, TEXT)) {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(box);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertText', false, TEXT);
    }
  } else {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(box), 'value')?.set || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(box, TEXT); else box.value = TEXT;
  }
  box.dispatchEvent(new Event('input', { bubbles: true }));
  box.dispatchEvent(new Event('change', { bubbles: true }));
  const btn = form.querySelector('[data-testid="send-button"]') || form.querySelector('button[type="submit"]') || form.querySelector('button[aria-label*="Envoyer" i]') || form.querySelector('button[aria-label*="Send" i]');
  if (btn) { btn.click(); return 'clicked:' + btnInfo; }
  const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true });
  box.dispatchEvent(ev);
  return 'enter';
})`;

const ANSWER_JS = `(() => {
  const legacy = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
  const nodes = legacy.length ? legacy : Array.from(document.querySelectorAll('div[data-chatgpt-selection-message-id]'));
  const stopBtn = document.querySelector('[data-testid="stop-button"], button[aria-label*="Arrêter" i], button[aria-label*="Stop" i]');
  const clean = (el) => (el.innerText || '').split('ChatGPT peut faire des erreurs')[0].trim();
  const texts = nodes.map(clean).filter((t) => t.length > 0);
  const text = texts.length ? texts[texts.length - 1].slice(0, 12000) : '';
  return JSON.stringify({ count: texts.length, streaming: !!stopBtn, text });
})()`;

async function chatgptArticle(job, logs) {
  const mapping = loadMapping();
  let inputs = {};
  try {
    inputs = JSON.parse(job.project.config_json || "{}").inputs || {};
  } catch {
    inputs = {};
  }
  const profile = typeof inputs.browserProfile === "string" && inputs.browserProfile.trim() ? inputs.browserProfile.trim() : "Profil principal";
  const prompt = typeof inputs.workerPrompt === "string" && inputs.workerPrompt.trim()
    ? inputs.workerPrompt.trim()
    : "Écris une introduction de recette courte (120 mots).";
  const dir = profileDir("chatgpt", profile, mapping);
  if (!fs.existsSync(dir)) throw new Error(`Profil local introuvable : ${dir}. Lancez « npm run login -- chatgpt "${profile}" » d'abord.`);
  const { findBrowser, stealthArgs, displayArgs, applyStealth } = require("../stealth.js");
  const chrome = findBrowser();
  if (!chrome) throw new Error("Aucun navigateur trouvé (VCBrowser ou Chrome).");
  const port = 9333 + Math.floor(Math.random() * 60);
  logs.push({ level: "info", message: `ChatGPT web : profil « ${profile} » (${chrome.includes("VCBrowser") ? "VCBrowser stealth" : "Chrome"}).` });
  const { killProfileLock } = require("../profiles.js");
  killProfileLock(dir);
  await new Promise((r) => setTimeout(r, 2000));

  const child = spawn(chrome, [
    `--user-data-dir=${dir}`,
    `--remote-debugging-port=${port}`,
    ...stealthArgs(),
    ...displayArgs(false),
    "about:blank",
  ], { detached: true, stdio: "ignore" });
  child.unref();
  let cdp = null;
  try {
    const versionInfo = await waitJson(`http://127.0.0.1:${port}/json/version`, 20000);
    throwIfDead(child, "chatgpt", profile);
    const targets = await waitJson(`http://127.0.0.1:${port}/json/list`, NAV_TIMEOUT_MS, (list) => Array.isArray(list) && list.some((t) => t.type === "page"));
    let page = targets.find((t) => t.type === "page" && t.url.startsWith("http")) || targets.find((t) => t.type === "page");
    if (!page || !page.webSocketDebuggerUrl) throw new Error("Onglet Chrome introuvable.");
    cdp = await connect(page.webSocketDebuggerUrl);
    await applyStealth(cdp, versionInfo && versionInfo.Browser, { spoof: false });
    await cdp.send("Page.enable", {});
    await cdp.send("Runtime.enable", {});
    await cdp.send("Page.navigate", { url: CHATGPT_URL });
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
    if (!ready) throw new Error("ChatGPT : zone de saisie introuvable (connectez-vous d'abord via « npm run login »).");
    const logged = await evaluate(cdp, `(() => { const head = (document.body ? document.body.innerText : '').slice(0, 1500); const loginWall = /(^|\n)\s*(log in|se connecter|s'inscrire|sign up)\b/i.test(head) || /auth\.openai\.com/i.test(window.location.href); return JSON.stringify({ loginWall, head: head.slice(0, 200) }); })()`)
      .then((raw) => { try { return JSON.parse(raw); } catch { return { loginWall: false, head: "" }; } })
      .catch(() => ({ loginWall: false, head: "" }));
    if (logged.loginWall) throw new Error(`ChatGPT : session absente sur ce profil (mur login détecté). Relancez « npm run login -- chatgpt "${profile}" » et connectez-vous.`);
    const sent = await evaluate(cdp, `(${SEND_JS})(${JSON.stringify(prompt)})`);
    logs.push({ level: "info", message: `Invite envoyée (${sent}). Génération en cours…` });
    const answerStart = Date.now();
    let lastCount = 0;
    let stableSince = 0;
    let text = "";
    for (;;) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      let state;
      try {
        state = JSON.parse(await evaluate(cdp, ANSWER_JS));
      } catch {
        continue;
      }
      if (state.text && state.text !== text) {
        text = state.text;
        stableSince = Date.now();
      }
      if (state.count !== lastCount) {
        lastCount = state.count;
        stableSince = Date.now();
      }
      if (text.length > 20 && !state.streaming && Date.now() - stableSince > 6000) break;
      if (Date.now() - answerStart > ANSWER_TIMEOUT_MS) break;
    }
    if (text.length < 20) throw new Error("Réponse ChatGPT vide ou illisible.");
    logs.push({ level: "success", message: `Réponse reçue (${text.length} caractères).` });
    return {
      status: "completed",
      logs,
      output: {
        title: `Article IA — ${job.project.name}`,
        content: { mode: "worker-chatgpt", provider: "chatgpt", profile, prompt: prompt.slice(0, 500), text, executedAt: new Date().toISOString() },
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

module.exports = { chatgptArticle, profileDir, loadMapping };
