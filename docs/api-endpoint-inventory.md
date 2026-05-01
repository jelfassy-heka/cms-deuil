# Cartographie des endpoints backend utilisés par le frontend CMS Héka

Document généré au lot 6 (audit). **Ce fichier est purement descriptif** — aucune
modification d'endpoint, d'URL ou de payload n'est faite côté frontend dans ce lot.

## Workspaces et groupes d’API Xano

Le projet utilise **2 workspaces Xano** et **3 groupes d’API** consommés par le frontend.

| Workspace Xano | Groupe API | Base URL | Usage principal | Auth attendue |
|---|---|---|---|---|
| **CMS** | **CMS — `api:M9mahf09`** | `https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09` | CRUD admin/partner sur les tables métier : `partners`, `partner_members`, `code_request`, `plan-activation-code`, `beneficiaries`, `contracts`, `crm_activity`, `contacts`, endpoints transactionnels `send-email`, `send-code-email`, `forgot-password`. | Depuis le lot 7, tous les appels portés par `xano.js` et les fetch custom `send-email` / `send-code-email` transmettent `Authorization: Bearer <token>` quand un token est présent. Le contrôle effectif côté Xano reste à activer (Xano 6.1). |
| **CMS** | **Auth — `api:IS_IPWIL`** | `https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL` | `auth/login`, `auth/me`, `auth/signup`, `verify-password`, `change-password`, `me/partner_membership`. | Bearer requis pour `auth/me`, `change-password`, `verify-password`, `me/partner_membership`. Depuis le lot 7, `auth/signup` transmet aussi le bearer admin (header ignoré tant que Xano 6.2B n'est pas livré). |
| **App** | **App — `api:I-Ku3DV8`** | `https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8` | Contenus App et Cocon : `admin-subjects`, `admin-sessions`, `admin-videos`, `admin-subject-*`, `admin-session-*`, `admin-cut-*`, `app-users`. | Depuis le lot 7, `xanoApp.js` et tous les fetch Cocon transmettent `Authorization: Bearer <token>`. À traiter avec prudence : certains endpoints ou tables App peuvent être utilisés par l’application mobile. Ne pas déplacer ni modifier sans analyse d’impact. |

Important : Auth n’est pas un workspace séparé. C’est un groupe d’API du workspace CMS.

| Workspace | Base URL | Usage principal | Auth attendue |
|---|---|---|---|
| **CMS** | `https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09` | CRUD admin/partner sur les tables métier (`partners`, `partner_members`, `code_request`, `plan-activation-code`, `beneficiaries`, `contracts`, `crm_activity`, `contacts`, `posts`, `spaces`, `alerts`, `posts-documents`, `post-reactions`, `post-reaction-images`) + endpoints transactionnels `send-email`, `send-code-email`, `forgot-password`. | À durcir : la majorité des appels CRUD partent **sans header `Authorization`**. Le frontend filtre côté client. → Voir checklist Xano. |
| **App** | `https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8` | Lecture/écriture du contenu Cocon (`admin-subjects`, `admin-sessions`, `admin-subject-*`, `admin-session-*`, `admin-cut-*`) et lecture `app-users`. | À durcir : appels Cocon sans bearer (sauf delete via `verify-password` côté frontend). |
| **Auth** | `https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL` | `auth/login`, `auth/me`, `auth/signup`, `verify-password`, `change-password`. | Bearer token requis pour `auth/me`, `change-password`. `signup` actuellement appelé depuis l'écran admin sans bearer. |

Le token retourné par `auth/login` est stocké dans `localStorage.heka_auth_token`. Depuis le lot 7, il est transmis automatiquement par `xano.js`, `xanoApp.js`, les fetch custom `send-email` / `send-code-email`, l'appel `auth/signup` (AdminAccounts) et tous les fetch Cocon. Les seuls appels volontairement publics sont `auth/login` et `forgot-password`. Le bearer reste sans effet côté Xano tant que les durcissements (Xano 6.1, 6.2B, 6.3) ne sont pas activés ; ce lot rend le frontend compatible sans changement fonctionnel.

## Légende

- **Sensible** : oui si l'endpoint manipule des PII (email, téléphone, identifiants), des données contractuelles (codes d'activation, contrat) ou exécute une action irréversible (delete, send email).
- **Accès attendu** : niveau d'autorisation que le backend devrait imposer.
- **Risque** : faiblesse identifiée *côté frontend* (rappel : seul le backend peut faire foi).

## A. Endpoints appelés via `src/lib/xano.js` (workspace CMS)

`xano` enveloppe les CRUD génériques `getAll(table, params)`, `getOne(table, id)`, `create(table, data)`, `update(table, id, data)`, `remove(table, id)` sur la base CMS. Depuis le lot 7, chaque appel transmet `Authorization: Bearer <token>` quand `localStorage.heka_auth_token` est présent (helper `getAuthHeaders`). Les payloads, URLs et méthodes HTTP sont strictement inchangés.

| Source | Fonction / composant | Méthode | Endpoint | Workspace | Usage métier | Sensible | Accès attendu | Risque | Remarque |
|---|---|---|---|---|---|---|---|---|---|
| `context/AuthContext.jsx` | `signIn` (lot 7) | GET | `/me/partner_membership` | CMS / Auth | Résolution sécurisée du partner_id après login partenaire. Réponse limitée aux memberships du token (`member_id`, `partner_id`, `role`, `status`, `partner_name`). Remplace l'ancien `getAll('partner_members')` + filtre client. | Oui (mais minimal) | Authentifié uniquement | Faible — bearer obligatoire côté Xano (6.2A). | Sélection : premier `status === 'active'` sinon premier de la liste. |
| `api/partnerApi.js` | `getPartner` | GET | `/partners/{id}` | CMS | Détail d'un partenaire pour Dashboard / Codes / Team / Profile partenaire. | Oui (données contractuelles + PII contact) | Partenaire (uniquement le sien) ou admin | Backend doit refuser si l'`id` ne correspond pas au `partnerId` du token. |
| `api/partnerApi.js` | `getCodes` | GET | `/plan-activation-code?partnerId={id}` | CMS | Liste des codes d'activation d'un partenaire. | **Très sensible** (codes = secrets fonctionnels) | Partenaire (uniquement le sien) ou admin | Si filtrage non appliqué backend, fuite massive de codes. Note : ici le param est `partnerId` (camelCase) — divergent du reste, à conserver tel quel côté frontend. |
| `api/partnerApi.js` | `getBeneficiaries` | GET | `/beneficiaries?partner_id={id}` | CMS | Liste des salariés d'un partenaire. | Oui (PII salariés) | Partenaire (uniquement le sien) ou admin | RLS Xano à valider. |
| `api/partnerApi.js` | `getContracts` | GET | `/contracts?partner_id={id}` | CMS | Contrat partenaire. | Oui (données contractuelles) | Partenaire (uniquement le sien) ou admin | RLS Xano à valider. |
| `api/partnerApi.js` | `getRequests` | GET | `/code_request?partner_id={id}` | CMS | Demandes du partenaire. | Oui | Partenaire / admin | RLS à valider. |
| `api/partnerApi.js` | `getMembers` | GET | `/partner_members?partner_id={id}` | CMS | Membres de l'espace partenaire. | Oui (PII team) | Partenaire / admin | RLS à valider. |
| `api/partnerApi.js` | `createBeneficiary` | POST | `/beneficiaries` | CMS | Ajout manuel ou import CSV de salariés. | Oui | Partenaire / admin | Backend doit vérifier que `partner_id` du payload = celui du token. |
| `api/partnerApi.js` | `updateBeneficiary` | PATCH | `/beneficiaries/{id}` | CMS | Maj statut/code après envoi (PartnerCodes). | Oui | Partenaire / admin | Backend doit vérifier ownership + interdire la modification du `partner_id`. |
| `api/partnerApi.js` | `createMember` | POST | `/partner_members` | CMS | Invitation collaborateur. | Oui | Partenaire admin uniquement | Backend doit empêcher un membre simple de créer. |
| `api/partnerApi.js` | `updateMember` | PATCH | `/partner_members/{id}` | CMS | Changement de rôle. | Oui | Partenaire admin uniquement | Backend doit refuser auto-promotion. |
| `api/partnerApi.js` | `removeMember` | DELETE | `/partner_members/{id}` | CMS | Retrait collaborateur. | Oui (action irréversible) | Partenaire admin uniquement | Backend doit refuser self-remove du dernier admin. |
| `api/partnerApi.js` | `updatePartner` | PATCH | `/partners/{id}` | CMS | Maj infos entreprise par admin partenaire. | Oui | Partenaire admin (sien) ou admin Héka | RLS + interdire la modification d'attributs réservés admin (ex. statut). |
| `api/partnerApi.js` | `createRequest` | POST | `/code_request` | CMS | Création de demande (codes/RDV/assistance/démo/renouvellement). | Oui | Partenaire | Backend doit forcer `partner_id` = celui du token, ignorer toute valeur cliente. |
| `pages/admin/Dashboard.jsx` | `useEffect` initial + polling 60 s | GET | `/partners`, `/plan-activation-code`, `/code_request`, `/contracts`, `/beneficiaries`, `/partner_members` | CMS | Vue admin tableau de bord. | Oui | Admin uniquement | Si non protégé, n'importe quel utilisateur loggé voit toute la donnée. |
| `pages/admin/Partners.jsx` | useEffect / handleSubmit / import CSV | GET / POST | `/partners`, POST `/partners`, POST `/contacts` | CMS | Liste, création partenaire et contacts associés. | Oui | Admin uniquement | RLS + validation des emails dupliqués. |
| `pages/admin/PartnerModal.jsx` | `useEffect` détail | GET | `/crm_activity`, `/partner_members`, `/beneficiaries`, `/plan-activation-code`, PATCH `/partners/{id}`, POST `/crm_activity` | CMS | Fiche partenaire admin avec sous-tableaux. | Oui | Admin uniquement | RLS Xano. |
| `pages/admin/CRM.jsx` | useEffect / handleSubmit | GET `/partners`, GET `/crm_activity`, POST `/crm_activity` | CMS | Activités CRM. | Oui | Admin uniquement | RLS. |
| `pages/admin/Requests.jsx` | useEffect / approve-reject | GET `/code_request`, GET `/partners`, PATCH `/code_request/{id}` | CMS | Traitement des demandes partenaires. | Oui | Admin uniquement | RLS + audit trail. |
| `pages/admin/AdminAccounts.jsx` | useEffect / handleCreate / handleRemove | GET `/partners`, GET `/partner_members`, POST `/partner_members`, DELETE `/partner_members/{id}` | CMS | Création de comptes admin/partenaires (combiné `auth/signup`). | Oui (action de gouvernance) | Admin uniquement | À durcir. |
| `pages/admin/AllBeneficiaries.jsx` | useEffect | GET `/beneficiaries`, GET `/partners` | CMS | Vue agrégée de tous les salariés. | Oui (PII multi-partenaires) | Admin uniquement | RLS critique. |
| `pages/admin/Analytics.jsx` | useEffect | GET `/plan-activation-code`, GET `/partners`, GET `/beneficiaries`, GET `/contracts` | CMS | Stats globales. | Oui | Admin uniquement | RLS. |
| `pages/admin/ActivityLog.jsx` | useEffect | GET `/crm_activity`, `/code_request`, `/plan-activation-code`, `/beneficiaries`, `/partner_members`, `/partners` | CMS | Journal d'activité reconstitué côté client. | Oui | Admin uniquement | RLS. À remplacer à terme par une vraie table d'audit serveur (voir roadmap). |
| `pages/admin/CodeGenerator.jsx` | handleGenerate | GET `/partners`, GET `/plan-activation-code`, POST `/plan-activation-code` | CMS | Génération de codes (avec étape `verify-password`). | **Très sensible** | Admin uniquement | Backend doit re-valider le rôle après `verify-password` (le mot de passe seul n'est pas une preuve d'autorisation). |
| `pages/admin/Users.jsx` | useEffect / suppressions | GET `/plan-activation-code`, `/spaces`, `/posts`, `/post-reactions`, `/partners`, `/beneficiaries`, `/alerts`, `/posts-documents`, `/post-reaction-images` | CMS | Vue admin utilisateurs app + nettoyages. | Oui | Admin uniquement | RLS. |

## B. Endpoints transactionnels (workspace CMS, raw fetch)

| Source | Fonction | Méthode | Endpoint | Workspace | Usage métier | Sensible | Accès attendu | Risque | Remarque |
|---|---|---|---|---|---|---|---|---|---|
| `pages/Login.jsx` | `handleForgotPassword` | POST | `/forgot-password` | CMS | Reset password public. | Oui (vecteur d'enumeration) | Public | Backend doit limiter le rate, ne pas révéler l'existence de l'email. |
| `api/partnerApi.js` | `sendNotificationEmail` | POST | `/send-email` | CMS | Email transactionnel via `template_id`. Utilisé par Dashboard partenaire (T#13/T#15), PartnerProfile (T#12), PartnerTeam (T#11), AdminAccounts, Requests, etc. | Oui (envoi à des tiers) | Selon template : admin ou partenaire connecté | Backend doit valider que l'utilisateur a le droit d'envoyer ce template_id à cet email. Sinon, vecteur de spam/spear phishing. |
| `api/partnerApi.js` | `sendCodeEmail` | POST | `/send-code-email` | CMS | Envoi du code d'activation (T#9). | **Très sensible** | Partenaire authentifié uniquement | Backend doit valider que le `code` appartient bien au partner du token, et que le `to_email` est bien un bénéficiaire de ce partner. Sinon, fuite directe de codes. |

## C. Endpoints Cocon (workspace App)

### Précaution importante — endpoints App / application mobile

Les endpoints Cocon vivent dans le workspace **App**. Ils manipulent des tables également liées à l’application mobile : `therapy-session-subjects`, `therapy-sessions`, `session-videos`, etc.

Règle de sécurité projet :

- Ne pas déplacer brutalement les endpoints Cocon du workspace App vers le workspace CMS.
- Ne pas modifier les endpoints App existants tant que leur usage exact par l’application mobile n’est pas confirmé.
- Toute sécurisation Cocon devra faire l’objet d’un sous-lot dédié, avec analyse d’impact mobile.
- Option préférée à étudier : créer de nouveaux endpoints CMS protégés ou des endpoints proxy dédiés au CMS, plutôt que modifier les endpoints App existants s’ils sont consommés par le mobile.
- La casse des champs Cocon doit rester strictement respectée : `thumbnail` côté subject, `thumbNail` côté session.

Depuis le lot 7, tous les endpoints Cocon (via `xanoApp.js` ou fetch direct) reçoivent `Authorization: Bearer <token>` quand un token est présent. Aucun `Content-Type` n'est fixé manuellement sur les multipart (boundaries gérées par le navigateur). Le contrôle d'autorisation effectif reste à activer côté Xano (Xano 6.3, à étudier avec analyse d'impact mobile préalable). La validation `verify-password` côté frontend reste un garde-fou UX, pas un contrôle d'autorisation.

| Source | Fonction | Méthode | Endpoint | Workspace | Usage métier | Sensible | Accès attendu | Risque | Remarque |
|---|---|---|---|---|---|---|---|---|---|
| `pages/admin/Cocon.jsx` | `fetchAll` | GET | `/admin-subjects`, `/admin-sessions` | App | Liste des thèmes et séances Cocon. | Oui (catalogue) | Admin uniquement | À durcir. |
| `pages/admin/Cocon.jsx` | `handleSave` | POST | `/admin-subject-create` | App | Création d'un thème. | Oui | Admin uniquement | Multipart, suit le pattern Xano (file resource + create file from file conditionnel). |
| `pages/admin/Cocon.jsx` | `handleSave` | PATCH | `/admin-subject-update` | App | Mise à jour partielle d'un thème. | Oui | Admin uniquement | Multipart, PATCH partiel — voir pattern dans la checklist. |
| `pages/admin/Cocon.jsx` | `handleSave` | POST | `/admin-session-create` | App | Création d'une séance. | Oui | Admin uniquement | Multipart. Champs `videoSession` distinct de `introductionVideo`/`exerciseVideo`. |
| `pages/admin/Cocon.jsx` | `handleSave` | PATCH | `/admin-session-update` | App | Maj partielle séance. | Oui | Admin uniquement | Multipart. Ne pas réenvoyer les fichiers existants. |
| `pages/admin/Cocon.jsx` | `handleSave` | POST/PATCH | `/admin-cut-create`, `/admin-cut-update` | App | CRUD cuts (vidéos rattachées à une séance). | Oui | Admin uniquement | Backend doit valider `max 4 cuts par séance` et rattachement à une séance existante. |
| `pages/admin/Cocon.jsx` | `handleDeleteCut` | POST | `/admin-cut-delete` | App | Suppression d'un cut + reordering. | Oui (irréversible) | Admin uniquement | Backend doit vérifier ownership de la séance/cut. |
| `pages/admin/Cocon.jsx` | `handleDeleteSession` | POST | `/admin-session-delete` | App | Suppression d'une séance avec validation `verify-password`. | Oui (irréversible, cascade) | Admin uniquement | Le password seul ne protège pas — un attaquant non-admin avec un mot de passe valide pourrait théoriquement appeler l'endpoint. Vérification rôle backend obligatoire. |
| `pages/admin/Cocon.jsx` | `handleMoveCut` (drag & drop) | PATCH | `/admin-cut-update` (×2) | App | Réordonnancement positions. | Oui | Admin uniquement | RLS. |
| `pages/admin/Dashboard.jsx`, `pages/admin/Users.jsx`, `pages/admin/Analytics.jsx` | useEffect | GET | `/app-users` | App | Liste des utilisateurs app mobile. | Oui (PII massive) | Admin uniquement | À durcir absolument. |

## D. Endpoints d'authentification (workspace Auth)

| Source | Fonction | Méthode | Endpoint | Workspace | Usage métier | Sensible | Accès attendu | Risque | Remarque |
|---|---|---|---|---|---|---|---|---|---|
| `context/AuthContext.jsx` | `signIn` | POST | `/auth/login` | Auth | Login email + password → `authToken`. | Oui | Public | Backend doit imposer rate limit + détection brute force. |
| `context/AuthContext.jsx` | `signIn` | GET | `/auth/me` | Auth | Lecture du profil logué (avec bearer). | Oui | Authentifié | Bearer token requis ✓. |
| `context/AuthContext.jsx` | `signIn` (lot 7) | GET | `/me/partner_membership` | Auth | Résolution du `partner_id` après login partenaire. Bearer obligatoire côté Xano (6.2A). Réponse limitée aux memberships du token. | Oui | Authentifié | Plus aucune liste complète `partner_members` exposée. |
| `pages/admin/AdminAccounts.jsx` | `handleCreate` | POST | `/auth/signup` | Auth | Création d'un nouveau compte (admin ou partenaire) — appelé depuis l'écran admin. | **Très sensible** | Admin uniquement | Lot 7 : le bearer admin est désormais transmis si dispo. Header ignoré tant que Xano 6.2B n'a pas durci l'endpoint (signup encore public côté backend). |
| `pages/admin/CodeGenerator.jsx` | `handleGenerate` | POST | `/verify-password` | Auth | Confirme le password admin avant génération de codes. | Oui | Authentifié | Confirme uniquement le password — ne suffit pas comme contrôle d'accès. |
| `pages/admin/Cocon.jsx` | `handleDeleteSession` | POST | `/verify-password` | Auth | Confirme le password admin avant suppression de séance. | Oui | Authentifié | Idem. |
| `api/partnerApi.js` | `changePassword` | POST | `/change-password` | Auth | Modification du mot de passe (PartnerProfile). | Oui | Authentifié (le sien) | Bearer token transmis ✓. |

## Synthèse risques majeurs

1. **Filtrage `partner_id` serveur** non encore activé côté Xano sur la majorité des CRUD CMS et App. Le bearer transmis depuis le lot 7 prépare le contrôle (Xano 6.1).
2. **`auth/signup` encore public côté backend** → ressource à durcir (Xano 6.2B). Le frontend transmet déjà le bearer admin.
3. ✅ ~~`/partner_members` listé entièrement au login~~ — **résolu au lot 7** : remplacé par `/me/partner_membership` (réponse limitée au token).
4. **Endpoints Cocon sans contrôle backend** → catalogue et CRUD admin restent ouverts tant que Xano 6.3 n'est pas livré, malgré le bearer envoyé par le frontend.
5. **`verify-password` n'est pas un contrôle d'autorisation** — un mot de passe valide ne prouve pas le rôle admin.
6. **`send-code-email` et `send-email`** doivent valider l'ownership pour éviter spam/exfiltration. Le bearer est désormais transmis.

Toutes ces faiblesses sont *côté frontend par construction* (un client ne peut pas s'auto-protéger). Le hardening doit être réalisé côté Xano — cf. `docs/xano-security-hardening-checklist.md`.

## État de durcissement actuel — CMS `api:M9mahf09`

### Endpoints sécurisés

Les familles suivantes sont désormais durcies avec bearer `cms_users` et contrôles de rôle / ownership côté Xano :

#### Lectures partner-scoped

- `GET /beneficiaries`
- `GET /beneficiaries/{id}`
- `GET /contracts`
- `GET /contracts/{id}`
- `GET /code_request`
- `GET /code_request/{id}`
- `GET /partner_members`
- `GET /partner_members/{id}`
- `GET /contacts`
- `GET /contacts/{id}`
- `GET /plan-activation-code`

#### Partners

- `GET /partners`
- `GET /partners/{id}`
- `POST /partners`
- `PUT /partners/{id}`
- `PATCH /partners/{id}`
- `DELETE /partners/{id}`

#### Writes partner-scoped

- `POST /beneficiaries`
- `PATCH /beneficiaries/{id}`
- `POST /code_request`

#### Gouvernance partenaire

- `POST /partner_members`
- `PATCH /parnter_members/{id}`
- `DELETE /partner_members/{id}`

#### Admin-only CRM/CMS

- `GET /crm_activity`
- `GET /crm_activity/{id}`
- `POST /crm_activity`
- `PATCH /crm_activity/{id}`
- `DELETE /crm_activity/{id}`
- `POST /contracts`
- `PATCH /contracts/{id}`
- `DELETE /contracts/{id}`
- `POST /contacts`
- `PATCH /contacts/{id}`
- `DELETE /contacts/{id}`
- `PATCH /code_request/{id}`
- `PUT /code_request/{id}`
- `DELETE /code_request/{id}`

### Endpoints encore à traiter

- `POST /send-email`
- `POST /send-code-email`
- `POST /plan-activation-code` si encore non durci
- endpoints liés à Brevo
- endpoints de recherche globale à créer
- audit logs à créer

### Risques restants — emails transactionnels

`send-email` et `send-code-email` restent des surfaces sensibles.

Risques à traiter :

- envoi abusif d’emails ;
- exfiltration de codes ;
- destinataire non vérifié ;
- code appartenant à un autre partenaire ;
- template non autorisé ;
- clé Brevo exposée dans le XanoScript ;
- absence de rate limiting ;
- absence d’audit log.

Ces endpoints doivent faire l’objet du Batch 5.