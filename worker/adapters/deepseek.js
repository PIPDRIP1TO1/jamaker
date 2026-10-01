/**
 * Adapter DeepSeek HTTP-direct (pattern VIRAL CLONER, gratuit, zéro navigateur
 * après extraction). Token lu UNE fois depuis le profil local connecté, puis
 * appels API : session + PoW (WASM vendor) + completion SSE.
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const https = require("node:https");
const { profileDir, loadMapping, killProfileLock } = require("../profiles.js");
const { solveDeepSeekPow } = require("../vendor/deepseek-pow/deepseek-pow-index.js");

const DS_HOST = "chat.deepseek.com";
const DS_ORIGIN = "https://chat.deepseek.com";
const NAV_TIMEOUT_MS = 45000;

const SHARED_HEADERS = {
  accept: "*/*",
  "accept-language": "en-US,en;q=0.9",
  origin: DS_ORIGIN,
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
  "x-app-version": "20241129.1",
  "x-client-locale": "en",
  "x-client-platform": "web",
  "x-client-version": "1.8.0",
  'sec-ch-ua': '"Google Chrome";v="154", "Not.A/Brand";v="8", "Chromium";v="154"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
};

function httpsJson(hostname, path, method, headers, body) {
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path, method, headers: { ...headers, ...(payload ? { "content-length": Buffer.byteLength(payload) } : {}) } },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString("utf8") }));
      },
    );
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("HTTP timeout")));
    if (payload) req.write(payload);
    req.end();
  });
}

async function extractSession(profile) {
  const mapping = loadMapping();
  const dir = profileDir("deepseek", profile, mapping);
  if (!fs.existsSync(dir)) throw new Error(`Profil local introuvable : ${dir}. Lancez « npm run login -- deepseek "${profile}" » d'abord.`);
  const chromePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    (process.env.LOCALAPPDATA || "") + "\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean);
  const { findBrowser } = require("../stealth.js");
  const chrome = findBrowser() || chromePaths.find((p) => fs.existsSync(p));
  if (!chrome) throw new Error("Aucun navigateur trouvé.");
  const port = 9533 + Math.floor(Math.random() * 60);
  killProfileLock(dir);
  await new Promise((r) => setTimeout(r, 2000));
  const child = spawn(chrome, [`--user-data-dir=${dir}`, `--remote-debugging-port=${port}`, "--no-first-run", "--no-default-browser-check", "--headless=new", "about:blank"], { detached: true, stdio: "ignore" });
  child.unref();
  let id = 0;
  try {
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (res.ok) break;
      } catch {}
      if (i === 24) throw new Error("Chrome introuvable.");
    }
    if (child.exitCode !== null) throw new Error("Chrome fermé (profil corrompu ?).");
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = targets.find((t) => t.type === "page");
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("ws")); setTimeout(() => rej(new Error("t")), 10000); });
    const send = (method, params) => new Promise((res, rej) => {
      const callId = ++id;
      const to = setTimeout(() => rej(new Error("TIMEOUT")), 25000);
      const h = (e) => { try { const m = JSON.parse(String(e.data)); if (m.id === callId) { ws.removeEventListener("message", h); clearTimeout(to); m.error ? rej(new Error(m.error.message)) : res(m.result); } } catch {} };
      ws.addEventListener("message", h);
      ws.send(JSON.stringify({ id: callId, method, params: params || {} }));
    });
    const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result.value;
    await send("Page.enable", {});
    await send("Runtime.enable", {});
    await send("Page.navigate", { url: "https://chat.deepseek.com/" });
    await new Promise((r) => setTimeout(r, 12000));
    const tokenRaw = await ev(`(() => localStorage.getItem('userToken') || '')()`);
    let token = "";
    try {
      token = JSON.parse(tokenRaw).value || tokenRaw;
    } catch {
      token = tokenRaw;
    }
    if (!token || token.length < 20) throw new Error("Session DeepSeek absente : connectez-vous via « npm run login ». ");
    const cookies = await send("Network.getAllCookies", {});
    const cookieString = (cookies.cookies || []).map((c) => `${c.name}=${c.value}`).join("; ");
    ws.close();
    return { token, cookieString };
  } finally {
    try {
      child.kill();
    } catch {}
  }
}

async function createChatSession(token, cookieString) {
  const res = await httpsJson(DS_HOST, "/api/v0/chat_session/create", "POST", {
    ...SHARED_HEADERS,
    authorization: token,
    cookie: cookieString,
    "content-type": "application/json",
    referer: `${DS_ORIGIN}/`,
  }, {});
  if (res.status !== 200) return null;
  try {
    const parsed = JSON.parse(res.text);
    return parsed?.data?.biz_data?.chat_session?.id || parsed?.data?.chat_session?.id || null;
  } catch {
    return null;
  }
}

async function buildPowHeader(token, cookieString) {
  const res = await httpsJson(DS_HOST, "/api/v0/chat/create_pow_challenge", "POST", {
    ...SHARED_HEADERS,
    authorization: token,
    cookie: cookieString,
    "content-type": "application/json",
    referer: `${DS_ORIGIN}/`,
  }, { target_path: "/api/v0/chat/completion" });
  if (res.status !== 200) return null;
  let challenge;
  try {
    const parsed = JSON.parse(res.text);
    challenge = parsed?.data?.biz_data?.challenge || parsed?.data?.challenge || parsed?.challenge || parsed;
  } catch {
    return null;
  }
  if (!challenge || !challenge.challenge) return null;
  const answer = await solveDeepSeekPow(challenge);
  return Buffer.from(JSON.stringify({
    algorithm: challenge.algorithm || "DeepSeekHashV1",
    challenge: challenge.challenge,
    salt: challenge.salt,
    answer,
    signature: challenge.signature,
    target_path: "/api/v0/chat/completion",
  }), "utf8").toString("base64");
}

function parseSSE(text, state) {
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const raw = line.slice(6).trim();
    if (!raw) continue;
    let d;
    try {
      d = JSON.parse(raw);
    } catch {
      continue;
    }
    if (typeof d.p === "string") state.seenPaths.add(d.p);
    // Fragments nus {"v":"..."} sans path (continuation) : annexer si contexte RESPONSE.
    if (!d.p && typeof d.v === "string") {
      if (state.currentType === "RESPONSE") state.text += d.v;
      continue;
    }
    if ((d.p === "response/status" || d.p === "quasi_status") && d.o === "SET" && (d.v === "FINISHED" || d.v === "COMPLETE" || d.v === "Success")) {
      state.finished = true;
      continue;
    }
    if (typeof d.p === "string" && d.p.endsWith("/content") && !d.p.includes("thinking") && !d.p.includes("fragments") && !d.p.includes("search") && typeof d.v === "string") {
      state.text += d.v;
      state.currentType = "RESPONSE";
      continue;
    }
    if (d.p === "response/fragments/-1/content" && typeof d.v === "string") {
      if (state.currentType === "RESPONSE") state.text += d.v;
      continue;
    }
    if ((d.p === "response/fragments" && d.o === "APPEND") || (d.p === "response" && d.o === "BATCH" && Array.isArray(d.v))) {
      const ops = d.p === "response" ? d.v : [{ p: d.p, o: d.o, v: d.v }];
      for (const op of ops) {
        if (op.p === "fragments" && op.o === "APPEND") {
          const frags = Array.isArray(op.v) ? op.v : [op.v];
          for (const frag of frags) {
            if (frag && frag.type === "RESPONSE") {
              state.currentType = "RESPONSE";
              state.text += frag.content || "";
            }
          }
        }
      }
    }
    // ── Format C : objet réponse complet (1er paquet : fragments initiaux).
    if (d.v && typeof d.v === "object") {
      const resp = d.v.response || d.v;
      const ao = resp.accumulated_output;
      if (ao && typeof ao.content === "string" && ao.content) {
        state.text += ao.content;
        state.currentType = "RESPONSE";
      }
      if (resp.fragments && Array.isArray(resp.fragments)) {
        for (const frag of resp.fragments) {
          if (frag && frag.type === "RESPONSE" && frag.content) {
            state.currentType = "RESPONSE";
            state.text += frag.content;
          }
        }
      }
    }
  }
}

async function deepseekArticle(job, logs) {
  logs = logs || [];
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
  logs.push({ level: "info", message: `DeepSeek web : profil « ${profile} », session en cours de lecture…` });
  const { token, cookieString } = await extractSession(profile);
  logs.push({ level: "info", message: "Session lue, création du chat…" });
  const sessionId = await createChatSession(token, cookieString);
  if (!sessionId) throw new Error("DeepSeek : session expirée, reconnectez-vous via « npm run login ».");
  const powHeader = await buildPowHeader(token, cookieString);
  const body = {
    chat_session_id: sessionId,
    parent_message_id: null,
    model_type: "default",
    prompt,
    ref_file_ids: [],
    thinking_enabled: false,
    search_enabled: false,
    preempt: false,
  };
  const headers = {
    ...SHARED_HEADERS,
    accept: "text/event-stream",
    authorization: token,
    cookie: cookieString,
    "content-type": "application/json",
    referer: `${DS_ORIGIN}/`,
    "x-client-timezone-offset": String(-new Date().getTimezoneOffset() * 60),
  };
  if (powHeader) headers["x-ds-pow-response"] = powHeader;
  const text = await new Promise((resolve, reject) => {
    const req = https.request({ hostname: DS_HOST, path: "/api/v0/chat/completion", method: "POST", headers }, (res) => {
      if (res.statusCode === 401 || res.statusCode === 403) {
        res.resume();
        reject(new Error("DeepSeek : session expirée (HTTP " + res.statusCode + ")."));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error("DeepSeek HTTP " + res.statusCode));
        return;
      }
      const state = { text: "", currentType: "", finished: false, seenPaths: new Set() };
      let buffer = "";
      const timer = setTimeout(() => {
        req.destroy(new Error("Réponse trop longue (5 min)."));
      }, 300000);
      res.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        parseSSE(lines.join("\n"), state);
      });
      res.on("end", () => {
        clearTimeout(timer);
        parseSSE(buffer, state);
        resolve(state.text.trim());
      });
      res.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    req.on("error", reject);
    const payload = JSON.stringify(body);
    req.setHeader("content-length", Buffer.byteLength(payload));
    req.write(payload);
    req.end();
  });
  if (!text || text.length < 20) throw new Error("Réponse DeepSeek vide ou illisible.");
  logs.push({ level: "success", message: `Réponse reçue (${text.length} caractères).` });
  return {
    status: "completed",
    logs,
    output: {
      title: `Article IA — ${job.project.name}`,
      content: { mode: "worker-deepseek", provider: "deepseek", profile, prompt: prompt.slice(0, 500), text: text.slice(0, 12000), executedAt: new Date().toISOString() },
    },
  };
}

module.exports = { deepseekArticle, parseSSE };
