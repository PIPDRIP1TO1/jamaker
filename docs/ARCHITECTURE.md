# Architecture cible de JA MAKER

## Frontières du produit

JA MAKER facture l'accès à sa plateforme. Les comptes externes appartiennent toujours au client. L'abonnement JA MAKER ne doit donc jamais être confondu avec les abonnements Meta, Google ou IA.

Le plan initial coûte **20 USD par mois**. Un coupon peut réduire le montant facturé, mais ne modifie jamais le prix catalogue du plan.

## Modules prévus

1. **Identité** — utilisateurs, organisations, rôles et sessions.
2. **Abonnement** — plans, paiements récurrents, factures et état d'accès.
3. **Connexions** — OAuth par organisation, jetons chiffrés et révocation.
4. **Automations** — définitions, exécutions, reprise sur erreur et limites.
5. **Contenus** — projets, médias, validations et exports.
6. **Audit** — historique des actions sensibles et diagnostics.

## Règles non négociables

- Toutes les données métier portent un `organizationId`.
- Un utilisateur ne peut lire ou modifier que les organisations dont il est membre.
- Les jetons OAuth ne sont jamais envoyés au navigateur après leur stockage.
- Les webhooks sont signés et idempotents.
- Les coupons sont créés et validés côté fournisseur de paiement ; le navigateur ne décide jamais du montant final.
- Une automation ne publie rien sans une autorisation explicite de l'utilisateur.
- Un abonnement expiré suspend les exécutions, sans supprimer les données.

## Phases

- **Phase 0 — terminée :** socle Next.js, identité visuelle, navigation et écrans fonctionnels statiques.
- **Phase 1 — socle local terminé :** SQLite persistant pour le développement Windows, authentification, sessions en base et organisations propriétaires. Le déploiement utilisera PostgreSQL avec les mêmes frontières de données.
- **Phase 2 — socle local terminé :** plan fixe à 20 USD, tables d'abonnement, coupons et événements de facturation, validation serveur des coupons et contrôle d'accès des automations. Le checkout et les webhooks seront activés avec le fournisseur de paiement retenu.
- **Phase 3 :** première connexion OAuth officielle.
- **Phase 4 :** première automation complète avec journal d'exécution.
