/** Helpers profils navigateur partagés (login.js + adapters). */
const fs = require("node:fs");
const path = require("node:path");
const { execSync, spawnSync } = require("node:child_process");

function slugifyProfile(name) {
  return String(name || "").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "principal";
}

function loadMapping() {
  try {
    const file = path.join(__dirname, "profiles.json");
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    // ignore
  }
  return {};
}

function profileDir(provider, profileName, mapping) {
  const map = mapping || loadMapping();
  const key = `${provider}:${profileName}`;
  if (map[key]) return map[key];
  return path.join(__dirname, "profiles", provider, slugifyProfile(profileName));
}

function listLocalProfiles(provider) {
  try {
    const base = path.join(__dirname, "profiles", provider);
    if (!fs.existsSync(base)) return [];
    return fs.readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

// Tue les Chrome qui verrouillent ce dossier de profil (pattern VIRAL CLONER :
// un seul navigateur par profil). Ne touche jamais les autres profils.
function killProfileLock(dir) {
  const needle = String(dir).toLowerCase();
  // Verrous périmés d'un kill brutal (pattern VIRAL CLONER) : sinon Chrome refuse de démarrer.
  for (const lock of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
    try {
      fs.rmSync(path.join(dir, lock), { force: true });
    } catch {
      // ignore
    }
  }
  try {
    if (process.platform === "win32") {
      // wmic est obsolète/fragile : PowerShell CIM à la place.
      const safe = needle.replace(/'/g, "''");
      const out = spawnSync(
        "powershell",
        ["-NoProfile", "-Command", `Get-CimInstance Win32_Process -Filter "name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${safe}*' } | Select-Object -ExpandProperty ProcessId`],
        { encoding: "utf8", timeout: 20000 },
      ).stdout || "";
      for (const pid of out.split(/\s+/).map((s) => s.trim()).filter((s) => /^\d+$/.test(s))) {
        try {
          process.kill(Number(pid), "SIGKILL");
        } catch {
          try {
            execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
          } catch {
            // ignore
          }
        }
      }
    } else {
      try {
        execSync(`pkill -f ${JSON.stringify(dir)}`);
      } catch {
        // aucun process ou pkill absent
      }
    }
  } catch {
    // ignore
  }
}

module.exports = { slugifyProfile, loadMapping, profileDir, listLocalProfiles, killProfileLock };
