# Notes de sécurité frontend — CMS Héka

Document généré au lot 6. Audite les garde-fous **côté client** présents dans le
repo et identifie ceux qui dépendent d'un contrôle backend pour être valides.

> **Principe directeur :** le frontend est une couche de confort, pas une
> couche de sécurité. Toute règle critique (rôles, ownership, limites métier)
> doit être appliquée côté Xano, sous peine d'être contournable. Ce document ne
> liste que ce que fait le client aujourd'hui.

## 1. Authentification

### 1.1 Stockage du token

Implémentation actuelle ([context/AuthContext.jsx](../src/context/AuthContext.jsx)) :

- Token stocké dans `localStorage.heka_auth_token` (clé `heka_auth_token`).
- Profil utilisateur sérialisé dans `localStorage.heka_user`.
- Rôle (`admin` / `partner`) dans `localStorage.heka_role`.
- `partnerId` (entier) et `memberRole` du partenaire dans `localStorage.heka_partner_id` / `heka_member_role`.
- Lecture au montage de l'app (`useEffect` sans deps), ré-hydratation avant rendu.

Constats :

- **Persistance :** `localStorage` survit aux fermetures d'onglet. Bénéfice UX, mais expose le token à toute injection JS (XSS).
- **Pas de refresh token** : un token compromis reste valide jusqu'à son expiration côté Xano.
- **Pas de fingerprinting** ni de double-vérification IP/UA.

Recommandations (à arbitrer dans un lot dédié, pas dans le lot 6) :

- Évaluer un déplacement vers un cookie `HttpOnly + Secure + SameSite=Strict` côté Xano si supporté. Avantage : non lisible par JS, protection XSS native. Limite : nécessite que le backend lise le cookie au lieu d'un header Bearer.
- Sinon : ajouter une CSP stricte côté Vercel pour réduire l'exposition aux XSS.

### 1.2 Login flow

Étapes ([context/AuthContext.jsx:29-112](../src/context/AuthContext.jsx#L29)) :

1. `POST auth/login` (workspace Auth) → `authToken`.
2. `GET auth/me` avec bearer → `user_type`, `email`, `name`, `is_first_login`.
3. Vérification croisée `selectedRole` (« admin » ou « partenaire ») vs `user_type` retourné par `auth/me`.
4. Si partenaire : `xano.getAll('partner_members')` (workspace CMS) puis filtrage côté client par `user_email`.
5. Persistence localStorage + setState.

Garde-fous présents :

- ✅ Refus de login si l'utilisateur sélectionne « Admin » alors que `user_type !== 'admin'` (et inversement).
- ✅ Refus de login partenaire si aucun `partner_members` ne correspond à l'email.
- ✅ Token bearer transmis pour `auth/me`.
- ✅ Le frontend ne décide pas du `user_type` : il est lu côté serveur (mais doit être protégé en écriture).

Limites :

- ⚠️ **Le filtrage `partner_members` se fait côté client après un `getAll`** non filtré → le navigateur reçoit tous les membres. Risque PII massif si le backend ne filtre pas. Voir checklist Xano §A.5.
- ⚠️ **Pas de mécanisme `auth/me` au refresh** : si le token est révoqué côté serveur, l'app continue d'utiliser le `user` localStorage tant qu'aucun appel n'échoue. À rendre plus strict une fois `auth/me` ajouté à l'init de session.

### 1.3 Logout

Implémentation ([context/AuthContext.jsx:114-124](../src/context/AuthContext.jsx#L114)) :

- Suppression de toutes les clés `heka_*` du localStorage.
- Nettoyage des anciennes clés `directus_*` (legacy).
- Reset des states React.

Garde-fous :

- ✅ Pas d'appel backend de logout (pas de session côté serveur à invalider) — limitation acceptée tant que les tokens ont un TTL court.
- ⚠️ Pas de signal aux autres onglets ouverts (un autre onglet conserve la session). À envisager via `BroadcastChannel` ou un `storage` event listener si besoin.

## 2. Routes protégées

### 2.1 Configuration App.jsx

Implémentation ([App.jsx](../src/App.jsx)) :

```jsx
<Route path="/" element={<Navigate to="/login" />} />
<Route path="/login" element={<Login />} />
<Route path="/admin/*" element={<AdminDashboard />} />
<Route path="/partner/*" element={<PartnerDashboard />} />
```

Constats :

- ✅ La racine `/` redirige vers `/login` — pas d'écran par défaut accessible sans login.
- ✅ Code-splitting route-based (lot 5) : les bundles admin/partner ne sont téléchargés qu'à la navigation effective.
- ⚠️ **App.jsx ne contient aucun `ProtectedRoute`** : un utilisateur non authentifié qui tape `/admin` ou `/partner/codes` à la main reçoit le bundle correspondant. Le contrôle effectif a lieu **dans** chaque dashboard (cf. §2.2).

### 2.2 Garde dans les dashboards

#### Partenaire — [pages/partner/Dashboard.jsx](../src/pages/partner/Dashboard.jsx)

```js
useEffect(() => {
  if (!user || !partnerId) navigate('/login')
}, [user, partnerId, navigate])
```

- ✅ Sans `user` ni `partnerId` → redirection `/login`.
- ✅ Un admin qui n'a pas de `partnerId` est aussi renvoyé vers `/login` — comportement souhaité (cf. lot 3).
- ⚠️ **Le contrôle est purement frontend** : un attaquant qui patch le code peut afficher l'écran. Mais sans token, les appels API échouent → ce qui ramène la sécurité au backend.

#### Admin — [pages/admin/Dashboard.jsx](../src/pages/admin/Dashboard.jsx)

- ✅ Un `useEffect` initial vérifie la session et déclenche la redirection si nécessaire.
- ⚠️ Aucun garde plus strict côté UI : si un partenaire « contourne » l'écran, les données ne s'afficheront pas correctement (les appels admin renvoient ce que Xano autorise) mais une partie de l'UI est tout de même rendue. **Le hardening Xano résout ce point.**

### 2.3 Routing profond partenaire (lot 3)

- ✅ Toutes les sous-routes `/partner/*` partagent la même garde via le shell `PartnerDashboard`.
- ✅ Refresh navigateur sur n'importe quelle URL profonde mène d'abord au shell, qui re-vérifie la session avant rendu.
- ✅ Vercel rewrite SPA `/(.*) → /index.html` confirmé dans `vercel.json` — pas de 404 serveur sur les URLs profondes.

## 3. Accès admin

Vérifications côté client :

- ✅ `user_type === 'admin'` côté `auth/me` est la source côté client.
- ⚠️ Tous les appels CRUD admin (`xano.getAll`, etc.) **partent sans header Authorization** dans `lib/xano.js`. Le backend doit donc protéger les endpoints autrement (session implicite Xano, IP, ou re-validation par un proxy).
- ⚠️ Aucune action admin n'inclut un challenge d'authentification fort, à part deux exceptions `verify-password` (génération de codes, suppression Cocon).

Recommandations (lot dédié) :

- Faire transiter le bearer token sur `xano.js` et `xanoApp.js` une fois Xano configuré pour l'exiger.
- Ajouter un `verify-password` (ou MFA) pour les actions vraiment irréversibles : suppression de partenaire, suppression d'admin, signup admin.

## 4. Accès partenaire

- ✅ Le frontend **ne propose pas** d'UI permettant à un partenaire de cibler un autre `partner_id` (pas de champ libre, le `partnerId` vient toujours de l'AuthContext).
- ⚠️ Mais un attaquant peut forger une requête HTTP (curl, devtools) vers `/beneficiaries?partner_id=42` ou `PATCH /partners/42`. **La protection effective dépend uniquement du filtrage Xano** (cf. checklist §A.2 et §A.3).
- ⚠️ Le `data-layer` du lot 4 (`partnerApi.js`) ne renforce pas la sécurité : il standardise les appels, sans ajouter de validation côté client. C'est cohérent avec le principe (le frontend ne peut pas se sécuriser tout seul).

## 5. Stockage côté navigateur

Inventaire complet des clés écrites par le repo :

| Clé localStorage | Source | Contenu | Sensible | Note |
|---|---|---|---|---|
| `heka_auth_token` | AuthContext | Bearer Xano | **Oui** | Vecteur d'XSS si CSP absent. |
| `heka_user` | AuthContext | JSON `{ email, name, user_type, is_first_login }` | Oui | Re-validable au prochain `auth/me`. |
| `heka_role` | AuthContext | `'admin'` ou `'partner'` | — | UI uniquement. |
| `heka_partner_id` | AuthContext | int | — | UI uniquement. |
| `heka_member_role` | AuthContext | `'admin'` ou `'member'` | — | UI uniquement. |
| `directus_token` / `directus_refresh_token` | AuthContext (cleanup) | Legacy | — | Supprimés au logout. |
| `heka_partner_notifs` | `pages/partner/PartnerNotifications.jsx` | sessionStorage : ids de notifications dismissées | Non | Pas de PII. |

Recommandations :

- Aucune clé sensible n'est en `sessionStorage` (utilisé uniquement pour des préférences UI).
- Les clés `heka_partner_id` et `heka_member_role` ne sont que des indications de UI : elles ne donnent **aucun privilège** sans un token valide.

## 6. Risques qui nécessitent backend

À durcir absolument côté Xano (cf. `docs/xano-security-hardening-checklist.md`) :

1. **Filtrage `partner_id` serveur** sur `/beneficiaries`, `/contracts`, `/code_request`, `/partner_members`, `/contacts`, `/plan-activation-code`.
2. **Cloisonnement** : un partner_member A ne peut jamais lire/modifier les données d'un partner B.
3. **`auth/signup` admin-only** (aujourd'hui appelé sans bearer depuis l'écran admin).
4. **Endpoints Cocon** (`admin-*`) admin-only, et limite « max 4 cuts » côté serveur.
5. **`send-email` / `send-code-email`** : valider le couple (token, code, destinataire) pour éviter spam et exfiltration de codes.
6. **Rate limit** sur `auth/login`, `forgot-password`, endpoints d'envoi.
7. **Audit logs** (table dédiée + journalisation systématique).
8. **CORS strict** sur les origines Vercel autorisées.

## 7. Recommandations transverses (frontend)

À étudier dans un lot dédié, pas dans le lot 6 :

- **CSP Content-Security-Policy** côté Vercel : stricte (`default-src 'self'`, `script-src 'self'`, `connect-src https://*.xano.io`, etc.) pour limiter l'impact d'un XSS éventuel.
- **HSTS** au niveau Vercel.
- **Subresource Integrity** sur les assets statiques externes (recharts est packagé avec Vite, donc moins concerné).
- **Audit `npm audit`** : à lancer périodiquement (n'a pas été refait dans ce lot pour ne pas modifier `package.json` / `package-lock.json`).
- **Pas d'`innerHTML`** non sanitisé : revue à effectuer dans un lot futur (le repo utilise majoritairement du JSX déclaratif, mais une revue de tous les `dangerouslySetInnerHTML` éventuels est utile).
- **Re-validation de session au foreground** : sur `visibilitychange`, déclencher un `auth/me` pour détecter une révocation.

## 8. Conclusion

Les garde-fous frontend en place sont cohérents avec une SPA classique : routage protégé par état React, persistance localStorage, redirections automatiques. Ils suffisent à empêcher un utilisateur honnête de tomber au mauvais endroit, mais **ils ne protègent pas contre une requête forgée**. La sécurité critique repose entièrement sur le hardening Xano, dont la checklist est dans `docs/xano-security-hardening-checklist.md`.
