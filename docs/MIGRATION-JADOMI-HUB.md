# Migration fonctionnelle de JADOMI HUB

La version desktop `D:\VIRAL CLONER\source` sert uniquement de référence en lecture. JA MAKER reste un projet indépendant dans `D:\JAMAKER`.

## Inventaire intégré

Le catalogue JA MAKER recense maintenant 32 modules dans cinq espaces : création, recherche, réseaux sociaux, studio et gestion. Il couvre notamment Workflows, Automatisations, Recipe Creator, Recipe Video, Cookbook Marketing, Animated Story, Facebook, Instagram, Pinterest, WordPress, Video Editor, Mini Canvas, Structures, Mailboxes, Backups, Reports, Community et Marketplace.

## Règle de migration

Le code Electron ne doit pas être copié aveuglément dans le serveur Next.js. Chaque fonction est portée avec :

- un `organizationId` pour isoler les données ;
- une validation serveur des entrées ;
- des permissions par rôle ;
- un historique d'exécution ;
- une connexion personnelle et révocable pour les services externes ;
- aucune dépendance au profil navigateur ou aux secrets d'un autre client.

## Projets exemples

Chaque module crée une seule fois un projet exemple dans l'organisation du client. Cet exemple ne contient ni chemin local, ni compte externe, ni secret, ni média personnel. Le client peut le dupliquer pour créer son propre brouillon ou le supprimer. Un exemple supprimé n'est pas recréé automatiquement.

## Priorité technique

1. **Workflows — socle disponible :** projets, graphe persistant, nœuds, connexions, validation sans boucle, tests techniques et historique d'exécution.
2. **Automations — socle disponible :** planning local, file de tâches, exécutions, retries, arrêt et journaux.
3. **Rapports — disponible :** statistiques réelles des projets, workflows et jobs par organisation.
4. **Sauvegardes — disponible :** export JSON sans mots de passe, sessions, tokens ni clés API.
5. **Connexions — registre disponible :** profils locaux isolés, sans secret ; OAuth et clés chiffrées restent à brancher.
6. **Outils de création — socle disponible :** formulaires spécialisés par module, paramètres privés, prévisualisations techniques persistantes et historique des résultats. Les appels Gemini/OpenAI restent volontairement désactivés tant que les connexions personnelles ne sont pas configurées.
7. **Connecteurs de publication — reportés :** activation après validation des outils de création.
8. **Abonnement et paiement — volontairement reportés.**

## État de validation

- TypeScript strict : validé.
- Build Next.js de production : validé sur 44 routes.
- Base SQLite : schéma auto-initialisé, incluant projets, sorties, workflows, automations, intégrations et rapports.
- Port de développement : `3100`.
