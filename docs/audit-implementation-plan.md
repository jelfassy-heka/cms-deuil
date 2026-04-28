# Plan de déploiement des recommandations d’audit CMS Héka

# Plan de déploiement des recommandations d’audit CMS Héka

## Baseline — Lot 0

### Environnement

- Dossier de travail final : `~/dev/cms-deuil`
- Ancien dossier problématique : `~/Desktop/cms-deuil`
- Node : v24.14.1
- npm : 11.11.0
- `package.json` lisible : OK
- `npm pkg get scripts` : OK

### Incident local résolu

Des erreurs locales ont été observées dans l’ancien dossier Desktop :
- npm `ETIMEDOUT` sur lecture de `package.json`
- VS Code incapable de lire/écrire certains fichiers
- `ENOSPC: no space left on device`

Analyse :
- problème local filesystem / espace disque / dossier Desktop ;
- pas une erreur applicative React/Vite confirmée.

Action :
- reprise depuis un clone propre dans `~/dev/cms-deuil` ;
- espace disque libéré ;
- dépendances réinstallées proprement.

### Validation technique

- `npm run lint` : OK avec 0 erreur et 3 warnings React Hooks conservés.
- Warnings conservés :
  - `AdminAccounts.jsx` : dépendance `getPartnerName`
  - `GlobalSearch.jsx` : dépendance `handleSelect`
  - `partner/Dashboard.jsx` : dépendance `navigate`
- `npm run build` : OK, build généré.
- Warning build : taille de chunk élevée, préexistant, non bloquant pour le lot 0.
- `npm run dev` : OK / KO à compléter après test local.

### Changements lot 0

- Ajout des fichiers de documentation baseline.
- Stabilisation minimale de la configuration ESLint.
- Correction des erreurs ESLint bloquantes simples.
- Aucun changement fonctionnel volontaire.
- Aucun endpoint Xano modifié.
- Aucun changement Cocon.
- Aucun changement `package.json` ou `package-lock.json`.



## Analyse environnement

Une erreur `ETIMEDOUT` a été observée précédemment sur `npm run build`.
À ce stade, la lecture de `package.json` et des scripts npm fonctionne.
L’erreur précédente semble donc être un incident local/transitoire npm ou réseau, pas une erreur applicative confirmée.

## Lots de déploiement

1. Lot 0 — Baseline & garde-fous
2. Lot 1 — Quick wins Partenaire P0
3. Lot 2 — UI partenaire version actuelle
4. Lot 3 — Routing partenaire durable
5. Lot 4 — Data layer / hooks API
6. Lot 5 — Cocon UX après validation L3c
7. Lot 6 — Données futures / backend / sécurité

## Règles de livraison

- Une branche par lot.
- Pas de refonte globale en une seule passe.
- Pas de modification backend Xano sans test isolé.
- Pas de push production sans lint/build/test manuel.
- Ne pas mélanger refonte UI, routing et data layer dans un même lot.
- Ne pas modifier Cocon tant que L3c n’est pas validée.

## Lots de déploiement
- Lot 0 — Baseline & garde-fous
- Lot 1 — Quick wins Partenaire P0
- Lot 2 — UI partenaire version actuelle
- Lot 3 — Routing partenaire durable
- Lot 4 — Data layer / hooks API
- Lot 5 — Cocon UX après validation L3c
- Lot 6 — Données futures / backend / sécurité

## Règles
- Pas de refonte globale en une seule passe.
- Une branche par lot.
- Un build validé avant tout push.
- Tests fonctionnels manuels documentés.
- Pas de modification Xano sans test isolé et publication.

## Baseline environnement local

- Node : v24.14.1
- npm : 11.11.0
- Compatibilité : OK avec les contraintes du repo.
- npm run build : erreur ETIMEDOUT observée avant exécution réelle de Vite.
- Analyse : problème npm/local/cache/proxy/lecture dossier, pas encore une erreur applicative.

## Baseline — build

- npm run build : non validé à ce stade.
- Erreur observée : npm ETIMEDOUT sur lecture package.json.
- Analyse : erreur environnement/npm avant lancement réel de Vite, pas encore une erreur de code applicatif.
- Actions de diagnostic :
  - vérifier lecture package.json ;
  - vérifier Node/npm ;
  - tester ./node_modules/.bin/vite build ;
  - vérifier proxy/cache npm ;
  - tester hors Desktop si besoin.

## Baseline — ESLint

- `npm run lint` : KO initial.
- Cause : `eslint.config.js` invalide / incompatible avec ESLint 9 flat config.
- Action lot 0 :
  - remplacement par une flat config minimale stable ;
  - environnement browser pour `src` ;
  - environnement Node pour `scripts` et fichiers de config ;
  - conservation des règles React Hooks classiques ;
  - retrait temporaire de `react-refresh/only-export-components` pour stabiliser la baseline.
- Statut :
  - `node --check eslint.config.js` : OK 
  - import config Node : OK 
  - `npm run lint` :  OK

## Incident ESLint — Lot 0

- `npm run lint` a d'abord échoué sur une erreur de configuration ESLint.
- Une erreur `SyntaxError: Unexpected token '}'` a ensuite été observée dans `eslint.config.js`.
- Analyse : erreur de syntaxe dans la configuration ESLint, pas erreur applicative React/Vite.
- Action : remplacement par une flat config ESLint minimale et robuste :
  - environnement browser pour `src` ;
  - environnement Node pour `scripts` ;
  - règles React Hooks classiques ;
  - règle React Refresh en warning si le plugin est disponible ;
  - `no-unused-vars` conservé en erreur.