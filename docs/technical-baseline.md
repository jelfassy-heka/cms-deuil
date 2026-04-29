# Baseline technique réelle

Le CDC v3.0 documente React 18 / Vite 5 / Tailwind 3 / React Router 6.
Le repo actuel utilise :
- React 19.x
- React Router DOM 7.x
- Tailwind CSS 4.x
- Vite 8.x

Pour les décisions métier, utiliser le CDC.
Pour les décisions techniques d’exécution, utiliser package.json et package-lock.json.

# Baseline technique réelle — CMS Héka

## Définition du repo

Le repo `cms-deuil` est le frontend privé du CMS Héka : une application React/Vite déployée sur Vercel, connectée à 2 workspaces Xano — CMS et App — et à 3 groupes d’API — CMS, Auth et App — permettant d’administrer les contenus de l’app mobile, les partenaires, les contrats et les codes d’activation.

## Architecture Xano réelle

Le projet utilise 2 workspaces Xano et 3 groupes d’API :

| Workspace Xano | Groupe API | Base API | Usage |
|---|---|---|---|
| CMS | CMS — `api:M9mahf09` | `https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09` | Partenaires, contrats, codes, demandes, membres, emails transactionnels |
| CMS | Auth — `api:IS_IPWIL` | `https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL` | Login, auth/me, signup, verify-password, change-password |
| App | App — `api:I-Ku3DV8` | `https://x8xu-lmx9-ghko.p7.xano.io/api:I-Ku3DV8` | Cocon, contenus App, sessions, thèmes, cuts vidéo, app-users |

Il n’existe pas de workspace Auth séparé : Auth est un groupe d’API du workspace CMS.

## Référence métier

Le CDC CMS Héka v3.0 reste la référence métier, fonctionnelle et roadmap.

Le CDC documente une stack historique :
- React 18
- Vite 5
- Tailwind CSS 3
- React Router 6

## Vérité technique d’exécution

Le repo actuel utilise :
- React 19.x
- React Router DOM 7.x
- Tailwind CSS 4.x
- Vite 8.x
- ESLint 9.x

Pour les décisions métier, utiliser le CDC.
Pour les décisions techniques d’exécution, utiliser `package.json` et `package-lock.json`.

## Scripts projet

- `npm run dev` : lance le serveur local Vite
- `npm run build` : build de production Vite
- `npm run lint` : analyse ESLint
- `npm run preview` : prévisualisation locale du build

## Environnement local constaté

- Node : v24.14.1
- npm : 11.11.0
- Compatibilité Node : OK avec les contraintes actuelles du repo

## Déploiement

Le projet est déployé sur Vercel avec un rewrite SPA vers `index.html`.

## Qualité / lint

La baseline ESLint est stabilisée : `npm run lint` retourne 0 erreur bloquante.
Trois warnings React Hooks restent documentés et seront traités dans un futur lot dette technique.