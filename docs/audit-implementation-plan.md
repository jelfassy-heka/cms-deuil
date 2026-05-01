# Plan de déploiement des recommandations d'audit CMS Héka

## Lots de déploiement

1. Lot 0 — Baseline & garde-fous
2. Lot 1 — Quick wins Partenaire P0
3. Lot 2 — UI partenaire version actuelle
4. Lot 3 — Routing partenaire durable
5. Lot 4 — Data layer / hooks API Partenaire
6. Lot 5 — Performance frontend & dette technique
7. Lot 5.1 — Correctif UI Cocon : contraste & états sélectionnés
8. Lot 6 — Données futures / backend / sécurité : documentation validée, inspection Xano effectuée
9. Xano 6.2A — Création `/me/partner_membership` : validé
10. Lot 7 — Frontend bearer compatibility layer : validé en local, à pousser

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

## Mise à jour de cadrage — Xano

Le projet utilise **2 workspaces Xano** et **3 groupes d’API** :

| Workspace Xano | Groupe API | Usage |
|---|---|---|
| CMS | CMS — `api:M9mahf09` | Partenaires, contrats, codes, demandes, membres, emails transactionnels |
| CMS | Auth — `api:IS_IPWIL` | Authentification CMS |
| App | App — `api:I-Ku3DV8` | Contenus App / Cocon / app-users |

Décisions :

- Auth n’est pas un workspace séparé : c’est un groupe d’API du workspace CMS.
- Les endpoints Cocon vivent dans le workspace App.
- Les endpoints App existants ne doivent pas être déplacés ni modifiés sans analyse d’impact mobile.
- Toute sécurisation Cocon future doit être traitée dans un sous-lot dédié avec décision d’architecture préalable.
- La prochaine action backend sûre est `Xano 6.2A — création de /me/partner_membership`, sans modification de Cocon ni activation globale de l’auth CMS.

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

## Xano 6.2A — Création `/me/partner_membership`

### Statut

Validé.

### Endpoint

- Workspace : CMS.
- Groupe API : Auth — `api:IS_IPWIL`.
- Méthode : `GET`.
- Path : `/me/partner_membership`.
- Auth : bearer `cms_users` obligatoire.
- Publication : OK.

### Réponse

Retourne uniquement :
- `member_id`
- `partner_id`
- `role`
- `status`
- `partner_name`

Aucune liste complète `partner_members`, aucun `user_email`, aucune PII inutile.

### Tests réalisés

- Sans bearer : 401.
- Bearer invalide : 401.
- Compte partenaire avec membership : OK.
- Compte admin pur sans membership : `[]`.
- Table complète `partner_members` jamais exposée.

### Hors périmètre

- `auth/signup` non modifié.
- Filtrage `partner_id` global non activé.
- Endpoints Cocon non touchés.
- Workspace App non touché.
- Frontend non modifié.

### Prochaine étape

Lot 7 — remplacer le `getAll('partner_members')` du login par `/me/partner_membership` et ajouter le bearer aux appels qui seront durcis ensuite.

## Lot 7 — Frontend bearer compatibility layer

### Statut

Livraison locale validée (lint OK, build OK, dev OK). À pousser sur GitHub puis merger après tests manuels.

### Objectif

Adapter le frontend au nouvel endpoint Xano sécurisé `GET /me/partner_membership` et préparer l'envoi du bearer token sur les appels CMS / App / Auth, sans changement backend, sans nouvelle dépendance et sans changement fonctionnel volontaire. Lot non cassant : les endpoints Xano existants acceptent encore les appels actuels sans bearer ; ce lot rend simplement le frontend compatible avec le durcissement à venir.

### Changements appliqués

- `src/context/AuthContext.jsx` : suppression du `xano.getAll('partner_members')` au login partenaire et remplacement par `GET /me/partner_membership` (workspace CMS, groupe API Auth `api:IS_IPWIL`) avec bearer obligatoire. Sélection du premier membership actif (`status === 'active'`) si présent, sinon premier membership. Refus de login partenaire conservé si la réponse est vide. Plus aucun `user_email` exposé, plus de filtrage côté client.
- `src/lib/xano.js` : ajout du helper `getAuthToken()` / `getAuthHeaders()` (lecture `localStorage.heka_auth_token`, retour vide si absent ou vide). `getHeaders()` injecte automatiquement `Authorization: Bearer <token>` quand un token existe. URLs, méthodes HTTP et payloads inchangés.
- `src/lib/xanoApp.js` : import du helper depuis `./xano` et propagation de `Authorization` sur `getAll`, `post`, `patch`. Endpoints App, payloads et `Content-Type` JSON conservés à l'identique.
- `src/api/partnerApi.js` : ajout de `Authorization` (via le helper) sur `sendNotificationEmail` et `sendCodeEmail`. `changePassword` conserve son comportement (bearer déjà transmis explicitement). Convention `partnerId` (camelCase) sur `getCodes` préservée.
- `src/pages/admin/AdminAccounts.jsx` : ajout de `Authorization` (via le helper) sur le `fetch` `auth/signup`. Payload, UX et validation inchangés. Le header est ignoré tant que `auth/signup` est public côté Xano (Xano 6.2B).
- `src/pages/admin/Cocon.jsx` : ajout de `Authorization` (via le helper) sur les `fetch` `admin-session-delete`, `admin-cut-create/update`, `admin-subject-create/update`, `admin-session-create/update`. Aucun `Content-Type` fixé manuellement sur les multipart (boundaries gérées par le navigateur). FormData, champs `thumbnail` / `thumbNail`, règles cuts, save/delete/upload/reorder inchangés.

### Hors périmètre conservé

- Aucune modification d'endpoint Xano (le lot est purement frontend).
- Aucune modification d'URL, méthode HTTP ou payload backend.
- Aucune modification de la convention `partnerId` sur `plan-activation-code`.
- Aucune modification de la logique métier Cocon ni des règles cuts/uploads/save/delete/reorder.
- Aucune modification d'UI.
- Aucune nouvelle dépendance.
- `package.json` / `package-lock.json` non modifiés.
- Pas de migration vers React Query / SWR / Redux / Zustand, pas de nouveau store global.

### États backend non encore traités

- `auth/signup` reste public côté Xano (Xano 6.2B à venir).
- Le filtrage `partner_id` côté serveur n'est pas encore activé (Xano 6.1 à venir).
- Les endpoints Cocon (workspace App) ne sont pas modifiés et restent ouverts côté backend (Xano 6.3 à étudier avec analyse d'impact mobile).

### Validation locale

- `npm run lint` : OK, 0 erreur, 0 warning.
- `npm run build` : OK, 11 chunks, plus gros chunk `SharedUI` 287 kB (gzip 89 kB), aucune régression.
- `npm run dev` : OK, démarrage en ~210 ms.

### Tests manuels à dérouler avant merge

- Login admin.
- Login partenaire avec membership : récupération du `partner_id` et du `role` via `/me/partner_membership`.
- Login partenaire sans membership : refus avec message conservé.
- Logout : nettoyage complet du localStorage.
- Refresh navigateur : ré-hydratation OK.
- `/partner`, `/partner/codes`, `/partner/team`.
- `/admin`.
- Création de compte admin / partenaire (compte de test si possible).
- Ouverture Cocon simple : pas de régression d'affichage avec les nouveaux headers.

### Prochaines actions backend Xano

Ordre recommandé après validation du Batch 4 :

1. **Batch 5 — Emails / codes / secrets / ownership**
   - `POST /send-email`
   - `POST /send-code-email`
   - `POST /plan-activation-code` si encore non durci
   - validation ownership destinataire / code / `partner_id`
   - sécurisation de la clé Brevo
   - rate limiting léger si possible
   - audit préparatoire si disponible

2. **Batch 6 — Audit logs**
   - création table `audit_logs`
   - endpoint admin `/admin/audit-logs`
   - fonction `create_audit_log`
   - branchement sur actions critiques

3. **Batch 7 — Rate limiting / auth hardening**
   - `auth/login`
   - `forgot-password`
   - `verify-password`
   - endpoints email/code

4. **Batch 8 — Cocon / App mobile**
   - uniquement après analyse d’impact mobile
   - ne jamais modifier un endpoint App existant sans validation
   - créer des endpoints CMS dédiés si nécessaire

5. **Batch 9 — Alertes IA**
   - endpoints admin CMS autour de `ai-messages.alert`
   - table `ai_alert_reviews`
   - visibilité admin CMS uniquement
   
### Prochaines actions frontend

À planifier dans un lot dédié après Xano 6.2A :

1. **Lot 7 — Frontend bearer compatibility layer**
   - Ajouter le bearer token aux clients `xano.js`, `xanoApp.js` et aux fetch custom.
   - Remplacer `getAll('partner_members')` par `/me/partner_membership`.
   - Adapter `AdminAccounts.jsx` pour transmettre le bearer admin à `auth/signup`.
   - Ajouter le bearer aux appels Cocon sans modifier les payloads.
   - Garder provisoirement `partnerId` sur `plan-activation-code` tant que la migration `partner_id` n’est pas faite.

2. **Lot frontend post-Brevo**
   - Exploiter les nouveaux champs email : ouvert, cliqué, bounce, délivré.

3. **Lot frontend post-migration `partner_id`**
   - Remplacer `partnerId` par `partner_id` sur `plan-activation-code` après compat backend.

   ## Xano 6.1 — Batch 4 — Admin-only CRM/CMS restants

### Statut

Validé.

### Objectif

Sécuriser les endpoints CRM/CMS restants manipulant des données internes ou multi-partenaires, en les réservant aux admins Héka.

### Périmètre

Workspace concerné :

- `CMS_HEKA_CLONE` — workspace `#17`
- API group CMS — `api:M9mahf09`

Workspaces non touchés :

- `TEST_HEKA_CLONE_TEST` — workspace `#16`
- `HEKA` — workspace `#9`
- Workspace App / mobile
- Cocon

### Endpoints publiés

17 endpoints ont été publiés avec `auth=300 (cms_users)` :

#### crm_activity

- `GET /crm_activity`
- `GET /crm_activity/{id}`
- `POST /crm_activity`
- `PATCH /crm_activity/{id}`
- `DELETE /crm_activity/{id}`

#### contracts

- `POST /contracts`
- `PATCH /contracts/{id}`
- `DELETE /contracts/{id}`

#### contacts

- `POST /contacts`
- `PATCH /contacts/{id}`
- `DELETE /contacts/{id}`

#### code_request — traitement admin

- `PATCH /code_request/{id}`
- `PUT /code_request/{id}`
- `DELETE /code_request/{id}`

#### partners — actions admin critiques

- `POST /partners`
- `PUT /partners/{id}`
- `DELETE /partners/{id}`

### Sécurité appliquée

Tous les endpoints concernés appliquent désormais :

- bearer `cms_users` obligatoire ;
- résolution du contexte via `security/resolve-partner-context` ;
- accès réservé aux admins CMS ;
- refus des partenaires sur les actions CRM/admin ;
- `404` contrôlé sur les endpoints `{id}` ;
- protection spécifique sur `DELETE /partners/{id}` :
  - interdiction explicite de supprimer `partners.id=1` ;
  - contrôle FK sur 6 tables :
    - `partner_members.partner_id`
    - `Beneficiaries.partner_id`
    - `contracts.partner_id`
    - `contacts.partner_id`
    - `code_request.partner_id`
    - `plan-activation-code.partnerId`

### Bugs corrigés

Trois endpoints `POST` créaient auparavant des lignes quasi vides avec seulement `created_at`.

Corrections appliquées :

- `POST /contracts` : mapping complet des 9 champs du schéma.
- `POST /contacts` : mapping complet des 7 champs du schéma.
- `POST /crm_activity` : mapping complet des 7 champs du schéma.

### Tests réalisés

- Sans bearer : `401` sur 17/17 endpoints.
- Bearer partenaire : `403` sur les endpoints admin-only.
- Bearer admin : opérations attendues validées.
- `{id}` inexistant : `404` contrôlé.
- `PATCH` partiel : champs non envoyés préservés.
- `POST` / `PUT` : persistance des champs validée.
- `DELETE /partners/1` : refus explicite validé.
- Données temporaires : toutes nettoyées.
- Sanity check final : 15/15 tests OK.

### Hors périmètre conservé

- `send-email` non touché.
- `send-code-email` non touché.
- Aucun `audit_logs` créé.
- Aucun rate limiting ajouté.
- Aucun endpoint Cocon modifié.
- Aucun endpoint App/mobile modifié.
- Aucun changement frontend.
- Aucune migration `partnerId` vers `partner_id`.

### Réserves / backlog

- `send-email` et `send-code-email` restent à sécuriser.
- La clé Brevo reste à sortir du XanoScript si elle est encore codée en dur.
- `audit_logs` reste à créer.
- Le rate limiting reste à traiter.
- Les endpoints Cocon App/mobile restent hors périmètre et nécessitent un lot dédié.
- Les alertes IA restent à traiter via endpoints admin dédiés.