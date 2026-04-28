# Plan de déploiement des recommandations d'audit CMS Héka

## Lots de déploiement

1. Lot 0 — Baseline & garde-fous
2. Lot 1 — Quick wins Partenaire P0
3. Lot 2 — UI partenaire version actuelle
4. Lot 3 — Routing partenaire durable
5. Lot 4 — Data layer / hooks API Partenaire
6. Lot 5 — Performance frontend & dette technique
7. Lot 5.1 — Correctif UI Cocon : contraste & états sélectionnés
8. Lot 6 — Données futures / backend / sécurité (non démarré)

## Règles de livraison

- Une branche par lot.
- Pas de refonte globale en une seule passe.
- Un build validé avant tout push.
- Tests fonctionnels manuels documentés à chaque lot.
- Pas de modification backend Xano sans test isolé et publication.
- Ne pas mélanger refonte UI, routing et data layer dans un même lot.
- Cocon L3c et UX Cocon sont considérées comme livrées et testées.
- Toute modification future de Cocon doit être traitée comme un lot dédié, avec tests de régression Cocon complets.

## Mise à jour de cadrage — Cocon

Le CDC CMS Héka v3.0 n'est plus à jour sur l'état de Cocon.

Le CDC indiquait encore :
- L3c en cours / tests bout en bout à valider ;
- UX Cocon à spécifier après L3c.

Statut projet actuel validé :
- L3c est **livrée et testée**.
- L'UX Cocon mentionnée dans le CDC est **livrée et testée**.

Décision :
- Le CDC v3.0 reste une référence historique et métier.
- Pour l'état opérationnel actuel, ce fichier de suivi et les validations de lots font foi.
- Toute évolution future Cocon = lot dédié avec tests de régression Cocon complets.

## Lot 0 — Baseline & garde-fous

### Statut

Validé.

### Environnement

- Dossier de travail final : `~/dev/cms-deuil`.
- Node : v24.14.1 / npm : 11.11.0 — compatibles avec les contraintes du repo.
- `package.json` lisible, `npm pkg get scripts` OK.

### Incidents lot 0 (résolus)

Trois incidents observés, tous d'origine environnement (pas applicatifs) :

1. **Erreurs filesystem dans l'ancien dossier `~/Desktop/cms-deuil`** : `npm ETIMEDOUT` sur lecture de `package.json`, VS Code incapable de lire/écrire certains fichiers, `ENOSPC` (espace disque). → Reprise depuis un clone propre dans `~/dev/cms-deuil`, espace disque libéré, `node_modules` réinstallés.
2. **`eslint.config.js` invalide pour ESLint 9 flat config** (`SyntaxError: Unexpected token '}'`). → Remplacement par une flat config minimale et stable : environnement `browser` pour `src`, environnement `node` pour `scripts` et fichiers de config, règles React Hooks classiques, `react-refresh/only-export-components` retirée temporairement, `no-unused-vars` conservé en erreur.
3. **`npm run build` initialement KO** (ETIMEDOUT npm avant lancement de Vite). → Résolu côté environnement après les actions ci-dessus, build généré OK ensuite.

### Validation locale

- `npm run lint` : OK, 0 erreur.
- `npm run build` : OK.
- `npm run dev` : OK.

À la sortie du lot 0, **3 warnings React Hooks volontairement conservés** pour traitement ultérieur (lot 5) :
- `AdminAccounts.jsx` : dépendance `getPartnerName`.
- `GlobalSearch.jsx` : dépendance `handleSelect`.
- `partner/Dashboard.jsx` : dépendance `navigate`.

### Hors périmètre conservé

- Aucun changement fonctionnel volontaire.
- Aucun endpoint Xano modifié.
- Aucun changement Cocon.
- Aucun changement `package.json` / `package-lock.json`.

## Lot 1 — Quick wins Partenaire P0

### Statut

Validé.

### Objectif

Corriger les irritants P0 de l'espace Partenaire sans refonte globale, sans modification backend et sans toucher à Cocon.

### Validation locale

- `npm run lint` : OK
- `npm run build` : OK
- `npm run dev` : OK

### Tests fonctionnels réalisés

- CTA Partenaire vérifiés (navigation morte `new_request` corrigée).
- Navigation vers les demandes/support vérifiée.
- Filtres rapides PartnerCodes vérifiés.
- Envoi unitaire / groupé vérifié.
- Confirmation PartnerTeam vérifiée (modale partagée à la place de `window.confirm`).
- Responsive partenaire vérifié.

### Hors périmètre conservé

- Pas de refonte dashboard.
- Pas de routing profond.
- Pas de data layer.
- Pas de modification Cocon.
- Pas de modification backend Xano.
- Pas de modification `package.json` / `package-lock.json`.

## Lot 2 — UI partenaire version actuelle

### Statut

Validé.

### Objectif

Améliorer l'UI/UX des écrans Partenaire avec les données actuellement disponibles, sans modification backend, sans routing profond et sans toucher à Cocon.

### Validation locale

- `npm run lint` : OK
- `npm run build` : OK
- `npm run dev` : OK

### Tests fonctionnels réalisés

Dashboard partenaire :
- KPI principaux lisibles.
- Actions prioritaires visibles (bloc « À faire maintenant »).
- Aucun chiffre inventé ou ambigu.
- Responsive mobile vérifié.

PartnerCodes :
- Recherche, filtres, import CSV, export, envoi unitaire, envoi groupé : OK.
- Codes bruts masqués en lecture, copie à la demande conservée.
- Responsive mobile vérifié.

PartnerTeam :
- Recentrage sur les actions de gouvernance, métriques business hors-sujet retirées.
- Responsive mobile vérifié.

PartnerProfile :
- Admin : édition OK.
- Non-admin : lecture seule propre, plus d'inputs grisés.
- Responsive mobile vérifié.

PartnerHelp :
- FAQ lisible, raccourcis ajoutés, CTA support/demandes fonctionnels.

### Données non affichées faute de champs disponibles

- Email ouvert / cliqué détaillé.
- Date d'activation précise.
- Relance recommandée calculée.
- Adoption par département/service.
- Cohortes d'envoi.

### Hors périmètre conservé

- Pas de routing profond.
- Pas de data layer.
- Pas de modification backend Xano.
- Pas de modification Cocon.
- Pas de modification `package.json` / `package-lock.json`.
- Pas de nouvelle dépendance.

## Lot 3 — Routing partenaire durable

### Statut

Validé.

### Objectif

Migrer progressivement la navigation interne de l'espace Partenaire vers des routes profondes, sans changement backend, sans refonte UI et sans toucher à Cocon.

### Validation locale

- `npm run lint` : OK
- `npm run build` : OK
- `npm run dev` : OK

### Tests fonctionnels réalisés

- `/partner` affiche le dashboard partenaire.
- `/partner/codes`, `/partner/team`, `/partner/contract`, `/partner/requests`, `/partner/requests/new`, `/partner/profile`, `/partner/help`, `/partner/notifications` : OK.
- Refresh navigateur validé sur les routes profondes.
- Bouton retour navigateur validé.
- Sidebar desktop et mobile validées.
- CTA internes partenaires validés.
- Accès auth partenaire / admin / non-auth vérifié.

### Résultat

L'espace Partenaire dispose désormais d'URLs profondes partageables et compatibles refresh navigateur grâce au routing React Router et au rewrite SPA Vercel.

### Hors périmètre conservé

- Pas de data layer.
- Pas de modification backend Xano.
- Pas de modification Cocon.
- Pas de refonte UI globale.
- Pas de nouvelle dépendance.
- Pas de modification `package.json` / `package-lock.json`.

## Lot 4 — Data layer / hooks API Partenaire

### Statut

Validé.

### Objectif

Centraliser progressivement la couche data Partenaire sans modifier le comportement utilisateur, sans nouvelle dépendance et sans backend.

### Validation locale

- `npm run lint` : OK (réduction d'1 warning par effet de bord — voir lot 5).
- `npm run build` : OK.
- `npm run dev` : OK.

### Livrables

- `src/api/partnerApi.js` : façade unique pour `getPartner`, `getCodes`, `getBeneficiaries`, `getContracts`, `getRequests`, `getMembers`, CRUD beneficiaries / partner_members / partners / code_request, et endpoints custom `sendNotificationEmail`, `sendCodeEmail`, `changePassword`.
- `src/utils/partnerMetrics.js` : fonctions pures `computeCodeStats`, `computeBeneficiariesWithoutCode`, `computeOpenRequestsCount`, `enrichBeneficiaries`, `countByEnrichedStatus`, `computeSendChartData`, `computeDonutData`, `computeTeamStats`.
- `src/hooks/usePartnerDashboardData.js`, `usePartnerCodes.js`, `usePartnerTeam.js` : hooks simples (state + useEffect, pas de cache, pas de retry, refetch manuel).

### Comportements préservés

- Loading states, error states, toasts, optimistic UI, import CSV, export, filtres rapides, envoi unitaire, envoi groupé, garde d'authentification.
- Routing du lot 3 inchangé.
- Aucune URL backend, méthode HTTP, payload ou header modifié.
- Divergence backend documentée dans `partnerApi.js` : `plan-activation-code` attend `partnerId` (camelCase) là où les autres tables attendent `partner_id` (snake_case).

### Hors périmètre conservé

- Pas de modification backend Xano.
- Pas de modification Cocon.
- Pas de refonte UI.
- Pas de nouvelle dépendance.
- Pas de TanStack Query / SWR / Redux / Zustand.
- Pas de modification `package.json` / `package-lock.json`.

## Lot 5 — Performance frontend & dette technique

### Statut

Validé.

### Objectif

Traiter la performance frontend et la dette technique restante sans changer le comportement utilisateur.

### Validation locale

- `npm run lint` : OK, **0 erreur, 0 warning**.
- `npm run build` : OK, **plus aucun chunk > 500 kB**, plus de warning Rollup.
- `npm run dev` : OK.

### Warnings React Hooks corrigés

- `AdminAccounts.jsx` : `getPartnerName` enveloppé dans `useCallback([partners])`, ajouté aux dépendances du `useMemo`.
- `GlobalSearch.jsx` : `handleSelect` déplacé avant `handleKeyDown` et ajouté aux dépendances du `useCallback`.
- `partner/Dashboard.jsx` : warning `navigate` éliminé dès le lot 4 par effet de bord (la garde d'auth est dans un `useEffect` qui inclut désormais `navigate` dans ses deps).

### Code-splitting route-based

Stratégie appliquée :
1. **App.jsx** — `AdminDashboard` et `PartnerDashboard` chargés via `React.lazy()` + `<Suspense fallback>`.
2. **admin/Dashboard.jsx** — `Cocon` (le composant le plus volumineux du repo, ~2 000 lignes) chargé via `React.lazy()` + `<Suspense fallback>`. Aucune modification de `Cocon.jsx`.
3. **Login** reste eager (composant léger, point d'entrée).
4. **Pas de manualChunks** dans `vite.config.js` : Rollup détecte automatiquement les modules partagés (SharedUI, recharts, xano) et les hisse dans des chunks dédiés.
5. **`chunkSizeWarningLimit` non touché** : la limite par défaut (500 kB) est respectée par chacun des 11 chunks générés.

### Comparaison build

| | Avant lot 5 | Après lot 5 |
|---|---|---|
| Nombre de chunks | 1 | 11 |
| Plus gros chunk | 934.01 kB (gzip 251 kB) | 286.51 kB (gzip 88 kB) — chunk SharedUI partagé |
| Bundle entrée `/login` | 934 kB / gzip 251 kB | 187 kB / gzip 59 kB |
| Warning chunk > 500 kB | Oui | Non |

Détail des chunks (post-build) :
- `index` : 187 kB / gzip 59 kB — entrée + Login + router.
- `Dashboard` (admin) : 202 kB / gzip 44 kB.
- `Dashboard` (partner) : 97 kB / gzip 21 kB.
- `Cocon` : 47 kB / gzip 12 kB — chargé uniquement à l'ouverture de l'écran Cocon.
- `SharedUI` : 287 kB / gzip 88 kB — composants UI + recharts (partagé entre admin et partner).
- `xano`, `PieChart`, `AuthContext`, `jsx-runtime`, CSS : chunks utilitaires.

### Tests fonctionnels réalisés

- Login : OK.
- Routes admin principales : OK.
- Routes partenaire profondes (`/partner`, `/partner/codes`, `/partner/team`, `/partner/contract`, `/partner/requests`, `/partner/requests/new`, `/partner/profile`, `/partner/help`, `/partner/notifications`) : OK.
- Refresh navigateur sur `/partner/codes` : OK.
- Bouton retour navigateur : OK.
- Accès Cocon depuis l'admin : fallback « Chargement de Cocon… » bref puis rendu Cocon identique au lot précédent. Aucune régression visible.
- Navigation mobile partenaire : OK.

### Hors périmètre conservé

- Pas de modification Cocon.
- Pas de modification backend Xano.
- Pas de refonte UI.
- Pas de nouvelle dépendance.
- Pas de modification `package.json` / `package-lock.json`.
- Pas de modification de la data layer du lot 4.

## Lot 5.1 — Correctif UI Cocon : contraste & états sélectionnés

### Statut

Validé.

### Objectif

Corriger uniquement l’UI de Cocon pour améliorer la lisibilité des vignettes de thèmes, des blocs de thèmes ouverts, des bandes couleur et des états actifs, sans changement fonctionnel ni backend.

### Validation locale

- `npm run lint` : OK
- `npm run build` : OK
- `npm run dev` : OK

### Corrections appliquées

- Vignettes de thèmes rendues plus visibles sur fond clair.
- Bande latérale colorée ajoutée ou fiabilisée sur les cartes de thèmes.
- Couleur d’accent héritée des champs couleur du thème :
  - `borderColor`
  - `titleColor`
  - `backgroundColor`
  - fallback Héka si couleur invalide ou absente.
- Surbrillance du thème ouvert/sélectionné.
- Bloc de thème ouvert mieux contrasté avec bordure, ombre et rappel de couleur.
- Séance active surbrillée avec teinte légère héritée de la couleur du thème.
- Contour de séance active renforcé avec la couleur du thème.
- Placeholder de vignette séance légèrement teinté si thumbnail absente.

### Tests fonctionnels réalisés

- Ouverture Cocon : OK.
- Cartes de thèmes visibles sur fond clair : OK.
- Bande latérale colorée visible sur chaque thème : OK.
- Ouverture d’un thème : surbrillance thème OK.
- Bloc de thème ouvert : contraste OK.
- Ouverture d’une séance : surbrillance séance OK.
- Ouverture d’un cut depuis une séance : séance parente toujours active visuellement.
- Fermeture drawer : disparition correcte de la surbrillance séance.
- Save / delete / upload / reorder : pas de régression visible.
- Responsive Cocon : OK.

### Hors périmètre conservé

- Pas de modification backend Xano.
- Pas de modification endpoint.
- Pas de modification des payloads FormData.
- Pas de modification des règles métier Cocon.
- Pas de modification de la logique cuts.
- Pas de modification `package.json` / `package-lock.json`.
- Pas de nouvelle dépendance.
- Pas de modification hors `Cocon.jsx`, sauf documentation de suivi.

## Lot 6 — Données futures / backend / sécurité

### Statut

Volet documentation **validé**. Prochaines étapes opérationnelles côté Xano à planifier.

### Objectif

Préparer la roadmap données futures, backend et sécurité **sans refonte
frontend, sans nouvelle dépendance et sans modification backend directe**. Le
lot 6 produit la cartographie et les checklists qui guideront les chantiers
backend et les lots frontend ultérieurs (alignement bearer, intégrations
Brevo/RevenueCat/Bridge App, table d'audit, etc.).

### Livrables documentaires

- [`docs/api-endpoint-inventory.md`](api-endpoint-inventory.md) — cartographie complète des endpoints utilisés (3 workspaces Xano : CMS, App, Auth) avec source frontend, méthode HTTP, sensibilité, accès attendu et risques identifiés.
- [`docs/future-data-roadmap.md`](future-data-roadmap.md) — données manquantes à produire côté backend, regroupées par thème (codes/activation, partenaires/salariés, support, audit/sécurité), avec priorité, dépendance externe et blocage actuel pour chacune.
- [`docs/xano-security-hardening-checklist.md`](xano-security-hardening-checklist.md) — checklist actionnable de durcissement Xano : auth/autorisation, Cocon, uploads (pattern validé), audit logs, plan de tests.
- [`docs/frontend-security-notes.md`](frontend-security-notes.md) — audit des garde-fous existants côté client (AuthContext, routes protégées, stockage token/localStorage, logout, écrans partenaires) et limites qui nécessitent absolument un contrôle backend.

### Validation locale

- `npm run lint` : OK, 0 erreur, 0 warning.
- `npm run build` : OK.
- `npm run dev` : OK.

Aucun fichier source applicatif (`.jsx` / `.js` autre que documentation) n'a été modifié dans ce lot — uniquement `docs/`.

### Risques majeurs identifiés (à durcir côté Xano)

1. **Filtrage côté client uniquement** sur la majorité des CRUD CMS et App (`xano.js` et `xanoApp.js` n'envoient pas de bearer aujourd'hui). Toute la sécurité repose sur la configuration Xano.
2. **`auth/signup` appelé sans bearer** depuis l'écran admin — risque de signup public si Xano n'impose pas un contrôle.
3. **Liste complète de `partner_members` exposée** au login pour résoudre le `partnerId` côté client → fuite PII team.
4. **Endpoints Cocon `admin-*` sans bearer** : catalogue + CRUD Cocon ouverts si Xano ne valide pas la session.
5. **`verify-password` n'est pas un contrôle d'autorisation** — un mot de passe valide ne prouve pas le rôle admin ; backend doit re-valider après.
6. **`send-code-email` / `send-email`** doivent valider l'ownership (token / code / destinataire) pour éviter spam et exfiltration de codes.

### Hors périmètre

- Aucune modification d'endpoint Xano (pas d'accès backend depuis ce lot).
- Aucun affichage de données futures côté frontend (pas de mock).
- Aucun changement UI, route ou data layer.
- Aucune intégration Brevo / RevenueCat / Bridge App.
- Aucune nouvelle dépendance.
- `package.json` / `package-lock.json` non modifiés.

### Prochaines actions backend Xano (à planifier hors repo)

Dans l'ordre suggéré :

1. **Activer le filtrage `partner_id` côté serveur** sur tous les endpoints listés dans la checklist §A.2 et §A.3.
2. **Restreindre `auth/signup`** aux bearers admin et adapter l'appel frontend dans un lot frontend dédié (`AdminAccounts.jsx`).
3. **Créer un endpoint `/me/partner_membership`** qui retourne les memberships du token, pour remplacer le `getAll('partner_members')` du login.
4. **Sécuriser les endpoints Cocon `admin-*`** (admin only + validation max 4 cuts par séance côté serveur).
5. **Créer la table `audit_logs`** et journaliser les actions critiques listées dans la checklist §D.
6. **Mettre en place rate limiting** sur `auth/login`, `forgot-password`, `send-email`, `send-code-email`.
7. **Activer le pipeline Brevo → Xano** (webhooks ouvert/clic/bounce) pour débloquer les KPI funnel email du lot 2.
8. **Aligner conventions** : éliminer la divergence `partnerId` (camelCase) sur `plan-activation-code` au profit de `partner_id` (snake_case) — nécessite migration Xano + lot frontend de réalignement.

### Prochaines actions frontend (à planifier dans des lots dédiés, après hardening backend)

- Ajouter le bearer token aux clients `xano.js` et `xanoApp.js` une fois Xano configuré pour l'exiger.
- Remplacer `getAll('partner_members')` par l'endpoint `/me/partner_membership`.
- Adapter `AdminAccounts.jsx` pour transmettre le bearer admin sur `auth/signup`.
- Étudier une CSP stricte et le passage d'éventuel cookie HttpOnly côté Vercel (cf. `frontend-security-notes.md` §7).
- Reprendre l'affichage frontend des données débloquées (date d'envoi, ouvert, activation, relances, adoption par département…) dans des lots dédiés une fois disponibles.
