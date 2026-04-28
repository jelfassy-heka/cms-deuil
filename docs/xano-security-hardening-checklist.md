# Checklist de hardening Xano — CMS Héka

Document généré au lot 6. Ce fichier liste les contrôles à mettre en place
**côté Xano** pour sécuriser les endpoints consommés par le frontend CMS Héka.
Il se complète de [`docs/api-endpoint-inventory.md`](api-endpoint-inventory.md)
qui dresse la cartographie des appels actuels.

**Convention :** chaque ligne est à cocher après vérification réelle dans Xano
(test d'autorisation, test de payload, test de limite).

## A. Authentification / autorisation

### A.1 Endpoints admin réservés aux admins

- [ ] Tous les endpoints CRUD du workspace **CMS** (`api:M9mahf09`) qui exposent des données multi-partenaires (ex. `partners` listing complet, `app-users`, `posts`, `spaces`, `crm_activity`, `plan-activation-code` listing complet sans filtre, `partner_members` sans filtre) sont protégés par une fonction Xano qui vérifie que `cms_users.user_type === 'admin'`.
- [ ] Tous les endpoints du workspace **App** (`api:I-Ku3DV8`) `admin-*` (subjects, sessions, cuts) sont admin-only.
- [ ] L'endpoint `/auth/signup` (workspace Auth) **exige un bearer admin** (le frontend appelle aujourd'hui sans bearer depuis `AdminAccounts.jsx` — à corriger des deux côtés une fois le backend prêt).

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

### A.5 Login

- [ ] `auth/login` : rate limit (ex. 5 tentatives / 15 min / IP), détection brute force.
- [ ] `auth/login` : message d'erreur générique (ne pas distinguer « email inconnu » de « mot de passe incorrect »).
- [ ] `forgot-password` : rate limit + message générique (ne pas révéler si l'email existe).
- [ ] Le frontend résout le `partnerId` en listant **tous** les `partner_members` après login. → Créer un endpoint dédié `/me/partner_membership` qui retourne uniquement les memberships du token, et adapter le frontend dans un lot dédié.

## B. Cocon

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
