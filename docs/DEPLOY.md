# Deploy gratuit — Vercel Hobby + Turso

## 1. Turso (SQLite cloud, free tier)
1. Créer un compte sur https://turso.tech
2. `turso db create jamaker`
3. `turso db show jamaker --url` → `TURSO_DATABASE_URL`
4. `turso db tokens create jamaker` → `TURSO_AUTH_TOKEN`
5. Le schéma se crée seul au premier démarrage (`src/lib/db.ts` → `db.exec(schema)`).

Sans ces 2 vars, l'app retombe en mode local `.data/jamaker.sqlite`.

## 2. Vercel (Hobby, free tier)
1. Pousser le repo sur GitHub.
2. https://vercel.com → Add New Project → importer le repo.
3. Environment Variables :
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `JAMAKER_VAULT_KEY` (32 octets base64 : `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)
   - `NEXT_PUBLIC_APP_URL` (ex. `https://jamaker.vercel.app`)
   - `STRIPE_*` optionnel (vide = mode dev).
4. Deploy. Tester `/api/health` puis `/register`.

## 3. Test local partagé (sans deploy) : Cloudflare Tunnel
```
cloudflared tunnel --url http://localhost:3100
```
Partager l'URL `https://....trycloudflare.com`. Le PC doit rester allumé.
