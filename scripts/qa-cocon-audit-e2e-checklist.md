# QA-COCON-AUDIT-E2E — Checklist navigateur

**Sentinelle commune** : `QA_COCON_AUDIT_RAW_SHOULD_NOT_APPEAR`

**Préfixe TEST** : `QA_COCON_AUDIT`

## Préconditions

- [ ] `npm run dev` lancé
- [ ] Login admin CMS effectué (jelfassy@heka-app.fr)
- [ ] Page Cocon charge sans erreur DevTools Console
- [ ] Page Journal d'activité charge sans erreur DevTools Console
- [ ] DevTools Network ouvert pour capturer les appels

---

## A. Subject create

UI : Cocon → bouton « Nouveau sujet » (ou équivalent)
- title : `QA_COCON_AUDIT subject`
- description : `DESC QA_COCON_AUDIT_RAW_SHOULD_NOT_APPEAR`
- type : therapy
- status : draft
- position : 999 (ou défaut)
- backgroundColor / titleColor / borderColor : couleurs au choix

**Capture** :
- [ ] subject id créé : __________
- [ ] Network : POST `/api:I-Ku3DV8/admin-subject-create` → 200
- [ ] Pas d'appel `/api:I-Ku3DV8/app-users` ni autre endpoint legacy

**Vérif Journal** : filtre `object_type=cocon_subject`, `action_type=create`, `object_id=<subject_id>`
- [ ] audit visible
- [ ] previous_values = {}
- [ ] new_values keys = 11 whitelistées (id, title, theme, type, exerciseType, status, position, backgroundColor, titleColor, borderColor, has_thumbnail)
- [ ] Aucune `description` brute (clé absente)
- [ ] **Sentinelle ABSENTE** dans tout le payload

---

## B. Subject update scalaires

UI : éditer le subject test → modifier title/theme/status/couleurs/description
- title : `QA_COCON_AUDIT subject v2`
- description : `DESC v2 QA_COCON_AUDIT_RAW_SHOULD_NOT_APPEAR`

**Vérif Journal** : filtre `object_type=cocon_subject`, `action_type=update`, `object_id=<subject_id>`
- [ ] audit visible
- [ ] metadata.changed_fields contient les champs modifiés (title, description, theme, status, ...)
- [ ] Sentinelle ABSENTE
- [ ] Aucune `description` brute

---

## C. Subject thumbnail réel ⚠ Test critique (T6 inline a échoué avec PNG 1x1)

UI : éditer subject → uploader une **vraie image** (JPG/PNG 100KB+, format réel)

**Si l'upload réussit** :
- [ ] subject mis à jour 200
- [ ] audit cocon_subject/update visible
- [ ] metadata.changed_fields contient `thumbnail`
- [ ] metadata.has_thumbnail_modified = **true**
- [ ] previous_values.has_thumbnail = false (si C est avant tout autre upload)
- [ ] new_values.has_thumbnail = **true**
- [ ] Aucune URL/path/name/meta/size/mime du thumbnail dans audit

**Si l'upload échoue** : capturer Console + Network (status code, message, payload Xano) et signaler.

---

## D. Session create

UI : Cocon → ouvrir le subject test → « Nouvelle séance »
- title : `QA_COCON_AUDIT session`
- description : `DESC QA_COCON_AUDIT_RAW_SHOULD_NOT_APPEAR`
- aiContext : `CTX QA_COCON_AUDIT_RAW_SHOULD_NOT_APPEAR`
- aiQuestion : `Q QA_COCON_AUDIT_RAW_SHOULD_NOT_APPEAR` (si champ visible)

**Capture** :
- [ ] session id créée : __________

**Vérif Journal** : `cocon_session/create` object_id=<session_id>
- [ ] audit visible
- [ ] new_values keys = 17 whitelistées (id, title, sessionSubjectId, type, exerciseType, status, position, avlForFree, color, colorTypo, author, has_thumbNail, has_cover, has_playerImage, has_exerciseSoundtrack, has_introductionVideo, has_exerciseVideo)
- [ ] metadata.has_description=true, has_aiContext=true, has_aiQuestion=true (si fournis)
- [ ] Aucune description/aiContext/aiQuestion brute
- [ ] Sentinelle ABSENTE

---

## E. Session update

UI : éditer la session test → modifier title/status/position/description/aiContext

**Vérif Journal** : `cocon_session/update`
- [ ] audit visible
- [ ] metadata.changed_fields correct
- [ ] previous_values reflète l'état avant
- [ ] new_values reflète l'état après
- [ ] Sentinelle ABSENTE

---

## F. Cut create

UI : sous la session test → « Nouveau cut » + uploader vidéo + remplir aiQuestion/videoScript/aiContext

Inclure sentinelle dans aiQuestion/videoScript/aiContext.

**Capture** :
- [ ] cut id créé : __________

**Vérif Journal** : `cocon_cut/create` object_id=<cut_id>
- [ ] audit visible
- [ ] new_values keys = 8 whitelistées (id, sessionId, position, durationMin, has_video, has_aiQuestion, has_videoScript, has_aiContext)
- [ ] metadata.parent_session_id = <session_id>
- [ ] metadata.has_video = true (vidéo uploadée)
- [ ] Aucun videoScript/aiQuestion/aiContext brut
- [ ] Aucun video.url/path/name dans audit
- [ ] Sentinelle ABSENTE

---

## G. Cut update + sessionId immutable

UI : éditer le cut → modifier position/durationMin/textes

⚠ **Test sessionId immutable** : si l'UI permet de modifier sessionId, vérifier qu'après save :
- DB sessionId reste identique
- audit metadata.sessionId_immutable = true
- changed_fields ne contient pas `sessionId`

**Vérif Journal** : `cocon_cut/update`
- [ ] audit visible
- [ ] metadata.changed_fields correct (sans sessionId)
- [ ] metadata.sessionId_immutable = true
- [ ] previous_values.sessionId == new_values.sessionId
- [ ] Sentinelle ABSENTE

---

## H. Cut delete

UI : supprimer le cut test

**Vérif Journal** : `cocon_cut/delete` object_id=<cut_id>
- [ ] audit visible
- [ ] previous_values keys = 8 whitelistées
- [ ] new_values = {}
- [ ] metadata.parent_session_id = <session_id>
- [ ] metadata.position_freed = <position>

---

## I. Session delete (sans historique utilisateur)

UI : supprimer la session test (qui n'a plus de cuts ni d'historique).

Si la session a encore des cuts en cascade (au moins 1 cut), c'est OK : le cascade compte sera reflété.

**Vérif Journal** : `cocon_session/delete` object_id=<session_id>
- [ ] audit visible
- [ ] previous_values keys = 17 whitelistées
- [ ] new_values = {}
- [ ] metadata.cascade_deleted_cuts_count = <nombre de cuts cascadés>
- [ ] metadata.had_user_history = false
- [ ] **Aucun audit individuel `cocon_cut/delete` créé pour les cuts cascadés**

---

## J. Subject cleanup

⚠ Pas d'endpoint admin-subject-delete → cleanup via MCP par l'agent.

Reporter à l'agent :
- subject_id : __________
- audit_ids créés (Journal d'activité): __________

L'agent supprime via MCP après collecte.

---

## K. Filtres Journal

Tester chaque filtre :
- [ ] object_type=cocon_subject → liste audits subjects
- [ ] object_type=cocon_session → liste audits sessions
- [ ] object_type=cocon_cut → liste audits cuts
- [ ] action_type=create → liste creates
- [ ] action_type=update → liste updates
- [ ] action_type=delete → liste deletes
- [ ] actor_email = jelfassy@heka-app.fr → liste mes actions
- [ ] Pagination si > 25 audits

---

## L. Drawer "Avant / Après"

Ouvrir le drawer pour au moins :
- [ ] cocon_subject/update
- [ ] cocon_session/update
- [ ] cocon_cut/update
- [ ] cocon_session/delete

**Vérif** :
- [ ] Avant/Après lisibles
- [ ] Métadonnées lisibles (changed_fields, has_*, source, source_workspace)
- [ ] **Aucun champ interdit visible** : description raw, aiContext raw, aiQuestion raw, videoScript raw, video.url/path/name, thumbnail.url/path/name, bearer, authToken, token, secret, api_key, BREVO_API_KEY, fcmTokens, google_oauth, facebook_oauth, firebaseId

---

## M. Console / Network

- [ ] Console DevTools : aucune erreur rouge liée à Cocon ou audit
- [ ] Endpoints Cocon répondent 200/401/403/404 selon scénario
- [ ] Aucun POST/PATCH/DELETE inattendu hors actions test
- [ ] Aucun appel `/api:I-Ku3DV8/app-users` (legacy)
- [ ] Aucun endpoint Cocon public appelé sans bearer

---

## N. Build (auto par agent ✅)

- [x] `npm run lint` → OK (aucun warning)
- [x] `npm run build` → OK (built in 245ms)

---

## Rapport à transmettre à l'agent

Format suggéré :
```
A. subject_id=<X> ✅/anomalie
B. ✅/anomalie
C. thumbnail upload ✅/échec (détails)
D. session_id=<Y> ✅
E. ✅
F. cut_id=<Z> ✅
G. sessionId immutable ✅
H. ✅
I. cascade_deleted_cuts_count=<N> ✅
K. filtres ✅
L. drawer ✅ ou champs interdits détectés : <liste>
M. console/network ✅ ou anomalies : <liste>

audit_ids créés (Journal) : 1XX, 1XX, 1XX, ...
subject_id à cleanup : <X>
```
