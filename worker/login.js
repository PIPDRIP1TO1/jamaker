/**
 * JA MAKER Worker — login manuel (modèle VIRAL CLONER).
 *
 * Ouvre Chrome avec le dossier du profil : connectez-vous UNE fois sur le
 * site du compte, puis fermez. La session persiste pour les adapters.
 *
 * Usage : node login.js <provider> [profil]
 *   node login.js deepseek
 *   node login.js chatgpt "Profil principal"
 *
 * Providers : chatgpt, gemini, deepseek, qwen, metaai
 */
const { spawnSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

const LOGIN_URLS = {
  chatgpt: "https://chatgpt.com",
  gemini: "https://gemini.google.com",
  deepseek: "https://chat.deepseek.com/sign_in",
  qwen: "https://chat.qwen.ai",
  metaai: "https://www.meta.ai",
};

const { profileDir, loadMapping, listLocalProfiles } = require("./profiles.js");

function findChrome() {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  // where/which en dernier recours
  try {
    const which = process.platform === "win32" ? "where chrome" : "which google-chrome || which chromium";
    const found = spawnSync(which, { shell: true, encoding: "utf8" }).stdout.split(/\r?\n/).find((l) => l.trim());
    if (found) candidates.push(found.trim());
  } catch {
    // ignore
  }
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

async function main() {
  const provider = String(process.argv[2] || "").toLowerCase();
  const profileName = String(process.argv[3] || "Profil principal");
  if (!LOGIN_URLS[provider]) {
    console.error("Provider inconnu. Choix : " + Object.keys(LOGIN_URLS).join(", "));
    process.exit(1);
  }
  const chrome = findChrome();
  if (!chrome) {
    console.error("Chrome introuvable. Installez Google Chrome puis relancez.");
    process.exit(1);
  }
  const mapping = loadMapping();
  const existing = listLocalProfiles(provider);
  if (existing.length) {
    console.log(`Profils locaux existants (${provider}) : ${existing.join(" • ")}`);
    console.log("Astuce : utilisez le MÊME nom dans SaaS → Mes connexions → Déclarer le profil.\n");
  }
  const dir = profileDir(provider, profileName, mapping);
  fs.mkdirSync(dir, { recursive: true });

  console.log(`\n=== Login ${provider} — profil « ${profileName} » ===`);
  console.log(`Dossier : ${dir}`);
  console.log("1. Chrome s'ouvre : CONNECTEZ-VOUS sur le site (compte gratuit).");
  console.log("2. Vérifiez que vous êtes bien connecté (nouveau chat, historique visible).");
  console.log("3. Revenez ici et appuyez sur Entrée. La session est conservée.\n");

  const child = spawn(chrome, [`--user-data-dir=${dir}`, LOGIN_URLS[provider]], { detached: true, stdio: "ignore" });
  child.unref();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => rl.question("Entrée quand c'est fait (Chrome peut rester ouvert)... ", () => { rl.close(); resolve(); }));
  console.log(`Profil « ${profileName} » prêt. Déclarez-le dans SaaS → Mes connexions → ${provider} → « Déclarer le profil » avec le MÊME nom.`);
}

main();
