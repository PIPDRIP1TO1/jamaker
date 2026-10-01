/**
 * Stealth navigateur (subset portable de VIRAL CLONER VCBrowser, gratuit).
 * - Binaire : VCBrowser.exe si présent, sinon Chrome système.
 * - Flags anti-détection au lancement.
 * - Spoof JS injecté via CDP (webdriver, chrome, plugins, langues, permissions).
 * - Identité : User-Agent Chrome réel + timezone/locale (défaut Africa/Casablanca).
 */
const fs = require("node:fs");

function findBrowser() {
  // VCBrowser.exe exige le harness VIRAL (extended-parameters) et refuse un
  // lancement standalone : utilisable uniquement via JAMAKER_BROWSER_PATH
  // explicite. Défaut = Chrome système + stealth porté (vérifié bout-à-bout).
  if (process.env.JAMAKER_BROWSER_PATH) {
    const custom = process.env.JAMAKER_BROWSER_PATH;
    if (fs.existsSync(custom)) return custom;
  }
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    (process.env.LOCALAPPDATA || "") + "\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

function stealthArgs() {
  return [
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-session-crashed-bubble",
    "--hide-crash-restore-bubble",
    "--password-store=basic",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--disable-notifications",
    "--disable-popup-blocking",
    "--force-webrtc-ip-handling-policy=default_public_interface_only",
    "--lang=fr-MA",
    "--window-size=1920,1080",
  ];
}

// ChatGPT bloque le headless (page vide) : headed par défaut pour lui.
// JAMAKER_HEADLESS=1 force headless, =0 force visible. Sinon défaut par adapter.
function displayArgs(headlessDefault = true) {
  const env = process.env.JAMAKER_HEADLESS;
  const headless = env !== undefined ? env !== "0" : headlessDefault;
  return headless ? ["--headless=new"] : ["--start-maximized"];
}

function spoofScript() {
  return `(() => {
    try {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => ['fr-MA', 'fr', 'en-US', 'en'] });
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
      if (!window.chrome) window.chrome = {};
      if (!window.chrome.runtime) window.chrome.runtime = {};
      if (!window.chrome.csi) window.chrome.csi = function () {};
      if (!window.chrome.loadTimes) window.chrome.loadTimes = function () {};
      const plugins = [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
        { name: 'Native Client', filename: 'internal-nacl-plugin' },
      ];
      Object.defineProperty(navigator, 'plugins', { get: () => plugins });
      const originalQuery = window.navigator.permissions && window.navigator.permissions.query;
      if (originalQuery) {
        window.navigator.permissions.query = (params) => (
          params && params.name === 'notifications'
            ? Promise.resolve({ state: 'denied' })
            : originalQuery(params)
        );
      }
      Object.defineProperty(document, 'hidden', { get: () => false });
      Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    } catch (e) {}
  })()`;
}

async function applyStealth(cdp, browserVersion, opts = {}) {
  const { spoof = true } = opts;
  const tz = process.env.JAMAKER_TZ || "Africa/Casablanca";
  const major = String(browserVersion || "").match(/Chrome\/(\d+)/);
  const chromeMajor = major ? major[1] : "154";
  const ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.0.0 Safari/537.36`;
  try {
    await cdp.send("Network.enable", {});
  } catch {}
  try {
    await cdp.send("Network.setUserAgentOverride", { userAgent: ua, userAgentMetadata: { brands: [{ brand: "Chromium", version: chromeMajor }, { brand: "Google Chrome", version: chromeMajor }, { brand: "Not-A.Brand", version: "99" }], fullVersion: `${chromeMajor}.0.0.0`, platform: "Windows", platformVersion: "15.0.0", architecture: "x86", model: "", mobile: false } });
  } catch {}
  try {
    await cdp.send("Emulation.setTimezoneOverride", { timezoneId: tz });
  } catch {}
  try {
    await cdp.send("Emulation.setLocaleOverride", { locale: "fr-MA" });
  } catch {}
  // Le spoof JS casse certaines apps React (ex. ChatGPT ne répond plus) :
  // ne l'activer que là où il est vérifié (Gemini images OK).
  if (spoof) {
    try {
      await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: spoofScript() });
    } catch {}
  }
}

module.exports = { findBrowser, stealthArgs, displayArgs, spoofScript, applyStealth };
