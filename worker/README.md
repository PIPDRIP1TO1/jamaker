# Worker local JA MAKER — comptes navigateur gratuits, zéro clé API

Le SaaS gère, le worker exécute **sur votre machine**. Vos sessions
(ChatGPT, DeepSeek, Qwen, Gemini web…) ne quittent jamais votre PC :
seuls les logs et résultats remontent.

## Démarrage (gratuit)

```powershell
cd D:\JAMAKER\worker
npm install
$env:JAMAKER_URL="http://localhost:3100"
$env:JAMAKER_WORKER_TOKEN="jwk_..."
npm start
```

Le token se crée dans **Automatisations → Worker local → Créer un token worker**.
Copiez-le aussitôt (affiché une seule fois). `last_seen_at` prouve la connexion.
Révocable à tout moment.

## Boucle d'exécution

1. `POST /api/worker/jobs/next` — réclame le plus vieux job `queued` (→ `running`).
2. Adapter local (`technical` par défaut : valide les étapes, sans action externe).
3. `POST /api/worker/jobs/:id/complete` — logs + statut + `module_outputs` (`worker_result`).

## Ajouter un adapter navigateur (pattern VIRAL CLONER)

Comme `D:\VIRAL CLONER\source\automations\deepseekBrowser.js` :

- profil persistant par organisation (`user-data-dir` local, login manuel une fois) ;
- file 1-requête-à-la-fois par profil (round-robin) ;
- jamais de secret navigateur envoyé au SaaS : seuls `logs` + `output` remontent ;
- choisissez l'adapter via `inputs.workerAdapter` dans la config du projet.

## Mapping comptes SaaS → profils locaux

Les comptes déclarés dans **Mes connexions → Comptes navigateur**
(ChatGPT, Gemini, DeepSeek, Qwen, Meta AI) arrivent au worker via le job :
`inputs.browserAccount = "<provider>:<profil>"` (ex. `deepseek:Profil principal`).
Mappez-les vers vos dossiers de profils dans `worker/profiles.json` :

```json
{
  "deepseek:Profil principal": "D:/profils/deepseek-principal",
  "chatgpt:Profil principal": "D:/profils/chatgpt-principal"
}
```

Connectez-vous une fois dans chaque profil (Chrome avec ce `user-data-dir`),
puis le worker réutilise la session. Aucun mot de passe ne transite par le SaaS.

## Sécurité

- Token `jwk_` = secret d'organisation : stocké en SHA-256 côté SaaS.
- Billing inchangé : sans abonnement actif, les jobs ne sont pas mis en file.
- En production (`Turso`), le worker tourne chez le client, pas chez l'hébergeur.
