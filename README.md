# JA MAKER

Nouvelle base indépendante pour le SaaS JA MAKER. Ce projet ne dépend pas du code de `D:\VIRAL CLONER`.

## Principe commercial

- abonnement mensuel JA MAKER fixé à 20 USD avant coupon ;
- chaque client connecte ses propres comptes externes (Bring Your Own Accounts) ;
- aucun compte Meta, Gmail ou IA partagé entre clients ;
- les secrets seront chiffrés et les autorisations révocables ;
- si l'abonnement expire, les automations sont suspendues mais les données restent lisibles et exportables.
- les coupons seront validés côté serveur par le fournisseur de paiement, jamais calculés uniquement dans le navigateur.

## Démarrage local

```powershell
npm install
npm run dev
```

Puis ouvrir `http://localhost:3100`.

## État actuel

Socle SaaS complet et vérifié (typecheck + build 48 routes + tests E2E logique) :

- **Identité & équipe :** inscription, connexion, sessions en base, organisations, invitations par lien (7 jours, lié à l'e-mail), rôles owner/admin/member, journal d'audit.
- **Abonnement 20 USD :** plan fixe, coupons validés côté serveur, checkout dev traçable, webhooks idempotents (`/api/webhooks/stripe`), automations suspendues sans suppression si expiré. Stripe réel en attente des clés.
- **Coffre BYOA :** secrets AES-256-GCM jamais renvoyés au navigateur (`JAMAKER_VAULT_KEY`) ; OpenAI (clé), WordPress (mot de passe d'application), OAuth dev simulé ; révocation à tout moment.
- **Création :** Recipe Creator (brief + détection auto + IA optionnelle + validation + révision + **publication brouillon WordPress réelle**), Recipe Video, Cookbook Marketing, Animated Story (studios dédiés + historique), Mini Canvas, Video Editor, Image Cleaner, Reel Studio (locaux).
- **Social :** compositeurs Facebook/Instagram/Pinterest (compteurs, hashtags, checklist, brouillons validés, publication bloquée sans connexion officielle).
- **Recherche :** carnets locaux (signaux, mots-clés) avec filtre + export ; collecte auto après connexions officielles.
- **Gestion :** Structures (CRUD + statuts), Boîtes mail (notes workflow), Sauvegardes (export complet + restauration projets/résultats/graphes, plannings inactifs, reconnexion requise), Communauté (ressources), Marketplace (6 modèles installables en projet privé).
- **Base :** SQLite local (`.data/jamaker.sqlite`) + support Turso HTTP pour deploy serverless gratuit. Voir [docs/DEPLOY.md](docs/DEPLOY.md).

Le catalogue technique reprend les 32 fonctions utiles recensées dans JADOMI HUB. Voir [docs/MIGRATION-JADOMI-HUB.md](docs/MIGRATION-JADOMI-HUB.md) pour l'ordre de migration.

## Reste volontairement externe (comptes du client, jamais partagés)

1. Paiement Stripe réel (clés + prix à brancher).
2. OAuth Meta/Google/Pinterest officiels (connexions dev simulées en attendant).
3. Publication auto vers les réseaux (brouillons validés prêts).
4. Scraping automatique (carnets manuels en attendant).
