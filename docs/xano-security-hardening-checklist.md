# Checklist de hardening Xano — CMS Héka

Document généré au lot 6. Ce fichier liste les contrôles à mettre en place **côté Xano** pour sécuriser les endpoints consommés par le frontend CMS Héka.

Le projet utilise **2 workspaces Xano** et **3 groupes d’API** :

| Workspace Xano | Groupe API | Usage |
|---|---|---|
| CMS | CMS — `api:M9mahf09` | Données métier CMS : partenaires, contrats, codes, demandes, membres, emails |
| CMS | Auth — `api:IS_IPWIL` | Authentification CMS : login, me, signup, verify-password, change-password |
| App | App — `api:I-Ku3DV8` | Contenus App / Cocon : thèmes, séances, cuts vidéo, app-users |

Important : Auth est un groupe d’API du workspace CMS, pas un troisième workspace.

Ce fichier se complète de [`docs/api-endpoint-inventory.md`](api-endpoint-inventory.md), qui dresse la cartographie des appels actuels.

**Convention :** chaque ligne est à cocher après vérification réelle dans Xano : test d’autorisation, test de payload, test de limite, publication contrôlée de l’endpoint.


## A. Authentification / autorisation

### A.1 Endpoints admin réservés aux admins

- [ ] Tous les endpoints CRUD du groupe API **CMS** (`api:M9mahf09`) qui exposent des données multi-partenaires sont protégés par une fonction Xano qui vérifie que `cms_users.user_type === 'admin'`, sauf endpoints explicitement destinés aux partenaires et filtrés par `partner_id`.
- [ ] L’endpoint `/auth/signup` du groupe API **Auth** (`api:IS_IPWIL`) exige un bearer admin. Le frontend appelle encore cet endpoint sans bearer depuis `AdminAccounts.jsx` : à corriger dans un lot frontend coordonné.
- [ ] Les endpoints Cocon `admin-*` du groupe API **App** (`api:I-Ku3DV8`) doivent être traités avec prudence : ils sont dans le workspace App et peuvent avoir un impact sur l’application mobile. Ne pas les déplacer ni les modifier sans analyse d’impact.
- [ ] Pour Cocon, préférer une stratégie dédiée : nouveaux endpoints CMS protégés, endpoints proxy CMS, ou sécurisation des endpoints App existants uniquement après confirmation qu’ils ne sont pas consommés par le mobile.

### A.2 Endpoints partenaire filtrés par partner_id

- [ ] `/partners/{id}` refuse 403 si l'`id` ne correspond pas au `partnerId` du token (sauf admin).
- [ ] `/plan-activation-code?partnerId={id}` ne renvoie que les codes du `partnerId` du token (ignorer la valeur cliente, ou refuser si discordante).
- [ ] `/beneficiaries`, `/contracts`, `/code_request`, `/partner_members`, `/contacts` filtrent automatiquement par `partner_id` du token, indépendamment du paramètre cliente.
- [ ] `POST /beneficiaries`, `POST /code_request` : le `partner_id` du payload est **écrasé** par celui du token (jamais accepté tel quel).

### A.3 Cloisonnement inter-partenaires

- [ ] Test : un partner_member A appelle `GET /beneficiaries?partner_id={B}` → réponse vide ou 403, **jamais** la liste de B.
- [ ] Test : un partner_member A appelle `PATCH /beneficiaries/{id_B}` → 403/404.
- [ ] Test : un partner_member A appelle `GET /partners/{id_B}` → 403/404.
- [ ] Test : un partner_member A appelle `POST /partner_members { partner_id: B, … }` → 403 ou écrasé par A.

### A.4 Vérification rôle backend

- [ ] La distinction `user_type === 'admin'` est validée côté backend pour tout endpoint `admin-*` ou CMS multi-partenaires. Le frontend ne doit jamais être considéré comme la source de vérité.
- [ ] La distinction `partner_members.role === 'admin'` (gouvernance partenaire) est validée backend pour : invitations (`POST /partner_members`), changements de rôle (`PATCH /partner_members/{id}.role`), retraits (`DELETE /partner_members/{id}`), modification de `partners` (`PATCH /partners/{id}`).
- [ ] `verify-password` ne sert **que** de second facteur de confirmation, jamais comme contrôle d'autorisation : tout endpoint qui suit un `verify-password` (Cocon delete, génération de codes) doit re-valider le rôle `admin` côté serveur.

### A.5 Login et résolution du partenaire

- [ ] `auth/login` : rate limit, détection brute force, message d’erreur générique.
- [ ] `forgot-password` : rate limit + message générique, sans révéler si l’email existe.
- [ ] Le frontend résout actuellement le `partnerId` en listant tous les `partner_members` après login. Ce comportement expose de la PII.
- [ ] Créer en priorité un endpoint sécurisé `GET /me/partner_membership` qui retourne uniquement les memberships du token.
- [ ] Sous-lot recommandé : **Xano 6.2A** — créer `/me/partner_membership` uniquement, sans encore restreindre `auth/signup` et sans activer le filtrage `partner_id` global.
- [ ] Après création de `/me/partner_membership`, créer un lot frontend dédié pour remplacer le `getAll('partner_members')` du login.
- [ ] `auth/login` : définir explicitement les inputs attendus `email` et `password` pour éviter la fuite d’un nom interne Xano comme `field_value` sur payload malformé.
- [ ] `auth/login` : remplacer les retours `ERROR_FATAL` sur credentials invalides par une réponse propre et uniforme de type 401 / unauthorized.
- [ ] `auth/login` : vérifier que les cas “email inconnu”, “mot de passe incorrect” et “mot de passe manquant” ont une réponse homogène, sans fuite par message ou par timing.
- [x] Créer un endpoint sécurisé `GET /me/partner_membership` qui retourne uniquement les memberships du token. Fait en Xano 6.2A.
- [ ] Adapter le frontend pour remplacer le `getAll('partner_members')` du login par `/me/partner_membership`.

## État d’avancement — Hardening Xano

### Validé

- [x] `GET /me/partner_membership` créé, publié et testé.
- [x] `POST /auth/signup` restreint aux bearers admin.
- [x] Fonction `security/resolve-partner-context` créée et testée.
- [x] Index utiles créés sur `partner_id`, `partnerId`, `user_email`.
- [x] Lectures partner-scoped sécurisées :
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
- [x] Lectures `partners` sécurisées :
  - `GET /partners`
  - `GET /partners/{id}`
- [x] Writes P0 sécurisés :
  - `POST /beneficiaries`
  - `PATCH /beneficiaries/{id}`
  - `POST /code_request`
- [x] Gouvernance partenaire sécurisée :
  - `POST /partner_members`
  - `PATCH /parnter_members/{id}`
  - `DELETE /partner_members/{id}`
  - `PATCH /partners/{id}`
- [x] Admin-only CRM/CMS restants sécurisés :
  - `crm_activity`
  - `contracts`
  - `contacts`
  - traitement admin `code_request`
  - `POST /partners`
  - `PUT /partners/{id}`
  - `DELETE /partners/{id}`

### À traiter ensuite

- [ ] `POST /send-email`
- [ ] `POST /send-code-email`
- [ ] `POST /plan-activation-code` si encore non durci
- [ ] secrets Brevo hors XanoScript
- [ ] ownership code / destinataire / partenaire
- [ ] rate limiting email/code
- [ ] audit logs
- [ ] Cocon admin hardening
- [ ] alertes IA admin CMS


## B. Cocon

### B.0 Précaution d’architecture

Les endpoints Cocon vivent dans le workspace **App** (`api:I-Ku3DV8`). Les tables manipulées (`therapy-session-subjects`, `therapy-sessions`, `session-videos`) sont liées au contenu consommé par l’application mobile.

Règle projet :

- [ ] Ne pas déplacer les endpoints Cocon du workspace App vers le workspace CMS sans décision d’architecture validée.
- [ ] Ne pas modifier les endpoints App existants tant que leur usage par l’application mobile n’est pas confirmé.
- [ ] Étudier d’abord les options suivantes :
  - nouveaux endpoints CMS protégés dédiés au CMS ;
  - endpoints proxy CMS validant le bearer admin puis appelant la logique App ;
  - sécurisation des endpoints App existants uniquement si l’impact mobile est nul ;
  - validation inter-workspace du token admin CMS si Xano le permet proprement.
- [ ] Toute évolution Cocon backend doit faire l’objet d’un sous-lot dédié avec tests de régression Cocon complets.

### B.1 Endpoints d'écriture

- [ ] `POST /admin-subject-create`, `PATCH /admin-subject-update`, `POST /admin-subject-delete` (si exposé) : admin only.
- [ ] `POST /admin-session-create`, `PATCH /admin-session-update`, `POST /admin-session-delete` : admin only.
- [ ] `POST /admin-cut-create`, `PATCH /admin-cut-update`, `POST /admin-cut-delete` : admin only.

### B.2 Règles métier

- [ ] **Limite max 4 cuts par séance** validée côté backend dans `admin-cut-create` : compter les cuts existants pour `sessionId` et refuser si déjà 4. Ne pas se reposer sur le frontend.
- [ ] Un cut ne peut être créé qu'avec un `sessionId` qui existe et appartient au catalogue Cocon (workspace App).
- [ ] Le réordonnancement de cuts (`admin-cut-update.position`) est validé : positions cohérentes, pas de doublon.

### B.3 Distinction des champs vidéo

- [ ] Le backend Cocon **n'utilise jamais** `introductionVideo` ou `exerciseVideo` pour la vidéo d'une **session** : seul `videoSession` (ou équivalent) est valide. Toute confusion casse le pattern d'upload validé.
- [ ] Le frontend respecte cette convention dans `Cocon.jsx` (à conserver, le payload actuel ne mélange pas les deux).

### B.4 Suppression session

- [ ] `admin-session-delete` cascade proprement : suppression des cuts liés, libération des fichiers, audit log.
- [ ] Le `verify-password` côté frontend reste un garde-fou UX, **pas** une autorisation : le backend doit re-valider `user_type === 'admin'`.

## C. Uploads

### C.1 Pattern Xano validé (à conserver)

Sur tous les endpoints d'upload Cocon multipart (`admin-subject-*`, `admin-session-*`, `admin-cut-*`) :

- [ ] **Inputs scalaires nullable** : chaque champ texte/nombre est déclaré nullable pour accepter les PATCH partiels.
- [ ] **File Resource** sur les champs fichiers (image, audio, vidéo).
- [ ] **Create Variable AVANT Conditional** : la variable de fichier est créée avant le bloc conditionnel qui décide de l'écriture.
- [ ] **Create File From File wrappé dans un Conditional** : on n'appelle `Create File From File` que si l'input fichier est non null.
- [ ] **Edit Record filtré par `inputs.id`** (pour les PATCH).
- [ ] **`first_notnull` mapping** : pour chaque champ d'écriture, utiliser `first_notnull(inputs.field, existing_record.field)` afin de ne pas écraser une valeur existante avec `null`.
- [ ] **L'endpoint est publié** (Xano publish) après modification du flow.

### C.2 Règles frontend (rappel — déjà respectées)

- [ ] Ne pas envoyer `undefined` ou `null` dans le `FormData` pour un champ fichier inchangé : ne pas appeler `formData.append('field', null)`.
- [ ] Ne pas renvoyer les objets fichiers existants (`{ url, path, … }`) — seuls les nouveaux `File` sont envoyés.
- [ ] Ne **jamais** fixer manuellement `Content-Type: multipart/form-data` : laisser le navigateur gérer le boundary. (`Cocon.jsx` ne le fait pas — comportement OK à conserver.)
- [ ] Les champs scalaires sont sérialisés en chaînes lisibles côté `FormData` (ne pas pousser des objets JSON qui se transforment en `[object Object]`).
- [ ] La constante `EXCLUDED_PAYLOAD_KEYS = new Set(['color', 'aiQuestion'])` retire les champs purement frontend du payload.

### C.3 Limites de taille / type

- [ ] Backend valide les `Content-Type` autorisés (frontend déjà strict : `image/jpeg|png|webp`, `audio/mpeg|mp4|x-m4a|wav|ogg`, `video/mp4|quicktime`).
- [ ] Backend impose les limites de taille (frontend : 5 Mo image, 100 Mo audio, 200 Mo vidéo). Backend doit refuser au-delà.
- [ ] Backend rejette les fichiers dont le contenu réel ne correspond pas au MIME annoncé (anti-bypass).

## D. Audit logs

(Voir `docs/future-data-roadmap.md` §D pour la structure de la table d'audit.)

À journaliser en priorité, dès que la table sera créée :

- [ ] **Auth** : `auth/login` (succès/échec), `auth/signup`, `change-password`, `verify-password`.
- [ ] **Comptes admin** : création/suppression `cms_users` admin, modification de rôle.
- [ ] **Comptes partenaire** : création/suppression `partner_members`, changement de rôle, invitation envoyée.
- [ ] **Codes** : génération (`POST /plan-activation-code`), envoi unitaire (`updateBeneficiary` + `send-code-email`), envoi groupé.
- [ ] **Imports CSV** : lot de partenaires (`Partners.jsx` import), lot de salariés (`PartnerCodes.jsx` import) — log un événement par lot et un par échec.
- [ ] **Demandes** : création (`POST /code_request`), traitement (`PATCH /code_request/{id}`).
- [ ] **Cocon** : create/update/delete subject, session, cut.
- [ ] **Suppression session avec verify-password** : log avec l'identité du `verify-password`.
- [ ] **Suppressions admin Users.jsx** (`posts-documents`, `post-reaction-images`) : critique car irréversibles.

Champs minimum par événement : `actor_user_id`, `actor_email`, `actor_role`, `acted_at`, `object_type`, `object_id`, `action_type`, `endpoint`. Optionnel mais recommandé : `previous_values`, `new_values`, `ip_address`, `user_agent`.

## E. Plan de tests Xano

À exécuter dans Xano (run / inspector) ou via un client HTTP avec différents bearer tokens.

### E.1 Matrices d'autorisation

Pour chaque endpoint listé dans `api-endpoint-inventory.md`, valider :

- [ ] **Test admin autorisé** : token admin → 200 avec données.
- [ ] **Test partenaire autorisé** : token partner_member sur ses propres données → 200.
- [ ] **Test partenaire autre `partner_id`** : token partner_member A sur des données B → 403 ou liste vide. **Jamais** la donnée de B.
- [ ] **Test non-auth** : sans bearer → 401 (sauf endpoints volontairement publics : `auth/login`, `forgot-password`).
- [ ] **Test partner_member non-admin sur action admin partenaire** (invitation, removal, role change) → 403.

### E.2 Payloads

- [ ] **Payload minimal** : seuls les champs requis → 200.
- [ ] **Payload avec `partner_id` discordant** : token partner A, body avec `partner_id: B` → backend doit forcer A (ou refuser).
- [ ] **Payload avec champs admin réservés** (ex. `crm_status`, `is_first_login`, `user_type`) depuis un partenaire → ignorés / refusés.

### E.3 Uploads

- [ ] **Upload absent** : PATCH sans le champ fichier → la valeur existante est préservée (pattern `first_notnull`).
- [ ] **Upload nouveau fichier** : champ fichier valide → remplace l'ancien.
- [ ] **PATCH partiel** : modifier uniquement le `title` n'altère ni les fichiers ni les autres champs.
- [ ] **Type non autorisé** : envoi d'un `.exe` → refus 4xx.
- [ ] **Taille excessive** : envoi >200 Mo sur un endpoint vidéo → refus 4xx avec message clair.

### E.4 Suppressions

- [ ] **Suppression d'un objet existant** : 200 + cascade complète.
- [ ] **Suppression d'un objet inexistant** : 404.
- [ ] **Suppression d'un objet appartenant à un autre partner** : 403.

### E.5 Limites métier

- [ ] **Cocon : 5e cut sur une séance qui en a déjà 4** → refus.
- [ ] **Partner_members : retrait du dernier admin d'un partner** → refus.
- [ ] **`auth/signup` sans bearer admin** (une fois le contrôle ajouté côté backend) → refus.

## F. Recommandations transverses

- [ ] **CORS** : limiter strictement aux origines de production (et de preview Vercel) — pas de wildcard.
- [ ] **Rate limit global** par token + par IP, particulièrement sur `auth/login`, `forgot-password`, `send-email`, `send-code-email`.
- [ ] **TTL des tokens** : durée raisonnable + rotation. Un long-lived token en localStorage est sensible si XSS.
- [ ] **CSP** côté frontend (Vercel) : ajouter une `Content-Security-Policy` stricte pour limiter l'impact d'un XSS éventuel sur le token. Hors-scope du lot 6 (config Vercel), mais à planifier.
- [ ] **Logs de sécurité** : conserver les `auth/login` échoués au moins 90 jours avec horodatage et IP pour détection.
- [ ] **Secrets backend Brevo / RevenueCat** : ne jamais les exposer dans la réponse Xano.
- [ ] **Endpoints `app-users`** : extrêmement sensibles (PII de tous les utilisateurs de l'app mobile) — durcir en priorité.

## G. Suivi

Une fois ce hardening complet :

1. Mettre à jour cette checklist en cochant chaque ligne validée.
2. Ouvrir un lot frontend de **micro-corrections** pour aligner les appels qui peuvent maintenant porter un bearer token (ex. `xano.js` et `xanoApp.js` n'envoient pas de header Authorization aujourd'hui — un lot dédié pourrait les ajouter sans changer les payloads).
3. Documenter dans `audit-implementation-plan.md` le passage en revue.

## Emails, codes et Brevo — Batch 5 à venir

### Objectif

Sécuriser les endpoints qui envoient des emails, manipulent des codes d’accès ou exposent une clé Brevo.

Endpoints à inspecter :

- `POST /send-email`
- `POST /send-code-email`
- `POST /plan-activation-code` si encore non durci
- autres endpoints liés à génération / envoi de codes si présents

### Contrôles attendus

- Bearer obligatoire.
- Admin ou partenaire autorisé selon le template / l’action.
- Le partenaire ne peut envoyer un email qu’à un destinataire appartenant à son `partner_id`.
- Le partenaire ne peut envoyer un code que si le code appartient à son `partner_id`.
- Le backend ne doit jamais faire confiance au `partner_id` client.
- `send-code-email` doit valider :
  - le code ;
  - le bénéficiaire ;
  - le destinataire ;
  - le `partner_id` ;
  - le statut éventuel du code.
- `send-email` doit valider :
  - le template ;
  - le destinataire ;
  - le rôle de l’acteur ;
  - le périmètre partenaire si applicable.
- Toute clé Brevo codée en dur doit être remplacée par une variable secrète Xano.
- Ajouter du rate limiting si possible sans modifier les contrats frontend.
- Ne pas envoyer d’email réel pendant les tests sauf validation explicite.