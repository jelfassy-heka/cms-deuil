# Cartographie des endpoints backend utilisés par le frontend CMS Héka

Document généré au lot 6 (audit). **Ce fichier est purement descriptif** — aucune
modification d'endpoint, d'URL ou de payload n'est faite côté frontend dans ce lot.

## Workspaces Xano

Trois groupes d'API Xano distincts sont consommés par le frontend :

| Workspace | Base URL | Usage principal | Auth attendue |
|---|---|---|---|
| **CMS** | `https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09` | CRUD admin/partner sur les tables métier (`partners`, `partner_members`, `code_request`, `plan-activation-code`, `beneficiaries`, `contracts`, `crm_activity`, `contacts`, `posts`, `spaces`, `alerts`, `posts-documents`, `post-reactions`, `post-reaction-images`) + endpoints transactionnels `send-email`, `send-code-email`, `forgot-password`. | À durcir : la majorité des appels CRUD partent **sans header `Authorization`**. Le frontend filtre côté client. → Voir checklist Xano. |
| **App** | `https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8` | Lecture/écriture du contenu Cocon (`admin-subjects`, `admin-sessions`, `admin-subject-*`, `admin-session-*`, `admin-cut-*`) et lecture `app-users`. | À durcir : appels Cocon sans bearer (sauf delete via `verify-password` côté frontend). |
| **Auth** | `https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL` | `auth/login`, `auth/me`, `auth/signup`, `verify-password`, `change-password`. | Bearer token requis pour `auth/me`, `change-password`. `signup` actuellement appelé depuis l'écran admin sans bearer. |

Le token retourné par `auth/login` est stocké dans `localStorage.heka_auth_token`. Il est explicitement transmis seulement pour `auth/me`, `change-password` (PartnerProfile) et `verify-password` (Cocon delete). Tous les autres appels dépendent donc d'une protection backend par session implicite ou d'une politique d'autorisation côté Xano.

## Légende

- **Sensible** : oui si l'endpoint manipule des PII (email, téléphone, identifiants), des données contractuelles (codes d'activation, contrat) ou exécute une action irréversible (delete, send email).
- **Accès attendu** : niveau d'autorisation que le backend devrait imposer.
- **Risque** : faiblesse identifiée *côté frontend* (rappel : seul le backend peut faire foi).

## A. Endpoints appelés via `src/lib/xano.js` (workspace CMS)

`xano` enveloppe les CRUD génériques `getAll(table, params)`, `getOne(table, id)`, `create(table, data)`, `update(table, id, data)`, `remove(table, id)` sur la base CMS. Aucun de ces appels ne porte de header `Authorization` aujourd'hui.

| Source | Fonction / composant | Méthode | Endpoint | Workspace | Usage métier | Sensible | Accès attendu | Risque | Remarque |
|---|---|---|---|---|---|---|---|---|---|
| `context/AuthContext.jsx` | `signIn` | GET | `/partner_members` | CMS | Récupère **tous** les partner_members puis filtre par `user_email` côté client pour résoudre `partner_id` après login. | Oui (PII liste complète) | Auth (toute personne loggée) | **Élevé** — exposition de la liste complète des members à un simple GET. | À remplacer par un endpoint dédié filtré par email côté backend. Voir checklist Xano §A. |
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

Tous les endpoints Cocon partent **sans `Authorization`**. La protection actuelle repose uniquement sur la confidentialité des URLs et la validation `verify-password` côté frontend pour la suppression.

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
| `pages/admin/AdminAccounts.jsx` | `handleCreate` | POST | `/auth/signup` | Auth | Création d'un nouveau compte (admin ou partenaire) — appelé depuis l'écran admin. | **Très sensible** | Admin uniquement | **Aucun bearer token n'est transmis dans l'appel actuel.** Si l'endpoint accepte les requêtes anonymes, il devient un signup public. À auditer côté Xano. |
| `pages/admin/CodeGenerator.jsx` | `handleGenerate` | POST | `/verify-password` | Auth | Confirme le password admin avant génération de codes. | Oui | Authentifié | Confirme uniquement le password — ne suffit pas comme contrôle d'accès. |
| `pages/admin/Cocon.jsx` | `handleDeleteSession` | POST | `/verify-password` | Auth | Confirme le password admin avant suppression de séance. | Oui | Authentifié | Idem. |
| `api/partnerApi.js` | `changePassword` | POST | `/change-password` | Auth | Modification du mot de passe (PartnerProfile). | Oui | Authentifié (le sien) | Bearer token transmis ✓. |

## Synthèse risques majeurs

1. **Filtrage côté client uniquement** sur la grande majorité des CRUD CMS et App. Toute la sécurité dépend de la configuration Xano.
2. **`auth/signup` appelé sans bearer token** depuis l'écran admin → risque de signup public si non bridé serveur.
3. **`/partner_members` listé entièrement** au login pour résoudre le `partnerId` → fuite de PII team.
4. **Endpoints Cocon sans bearer** → catalogue et CRUD ouverts si Xano n'impose pas de session.
5. **`verify-password` n'est pas un contrôle d'autorisation** — un mot de passe valide ne prouve pas le rôle admin.
6. **`send-code-email` et `send-email`** doivent valider l'ownership pour éviter spam/exfiltration.

Toutes ces faiblesses sont *côté frontend par construction* (un client ne peut pas s'auto-protéger). Le hardening doit être réalisé côté Xano — cf. `docs/xano-security-hardening-checklist.md`.
