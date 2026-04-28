# Roadmap données futures CMS Héka

Document généré au lot 6. Liste les champs et signaux **non disponibles
aujourd'hui** côté backend qui débloqueraient des fonctionnalités utiles côté
admin et partenaire. **Aucun de ces champs n'est codé côté frontend dans ce lot.**

Cette roadmap distingue ce qui est faisable purement en Xano de ce qui dépend de
services externes (Brevo, RevenueCat, Bridge App). Elle ne couvre pas les
développements UI : ceux-ci seront repris dans les lots suivants une fois les
champs disponibles.

## Légende

- **Priorité** : `P0` = bloquant pour des features déjà esquissées dans l'UI ; `P1` = améliore l'expérience existante ; `P2` = nice to have.
- **Dépendance** : où la donnée doit être produite (Xano only / Brevo / RevenueCat / Bridge App / app mobile / etc.).
- **Blocage actuel** : pourquoi ce n'est pas exploitable aujourd'hui.

## A. Codes / activation

Aujourd'hui, `plan-activation-code` n'expose qu'un booléen `used`, et `beneficiaries` un `status` libre + `code` + `sent_at`. Les états plus fins du funnel sont impossibles à reconstituer.

| # | Donnée fonctionnelle | Nom technique suggéré | Type | Table probable | Usage UI cible | Priorité | Dépendance | Blocage actuel |
|---|---|---|---|---|---|---|---|---|
| A.1 | Date d'envoi de l'email de code | `code_email_sent_at` | datetime | `beneficiaries` | KPI partenaire « Codes envoyés », funnel filtre « Envoyé » fiable. | P0 | Xano `send-code-email` (à enregistrer après l'envoi réussi). | `beneficiaries.sent_at` existe mais est posé côté frontend, sans garantie de l'envoi réel ; utiliser une horodatation backend post-Brevo. |
| A.2 | Date d'ouverture de l'email | `code_email_opened_at` | datetime | `beneficiaries` ou table dédiée | Statut « Ouvert » du funnel, taux d'ouverture. | P1 | Brevo (webhook tracking). | Pas de pipeline Brevo → Xano aujourd'hui. |
| A.3 | Date de clic dans l'email | `code_email_clicked_at` | datetime | idem | Distinction ouvert vs intéressé. | P1 | Brevo (webhook). | Idem A.2. |
| A.4 | Date d'activation effective du code | `code_activated_at` | datetime | `plan-activation-code` ou `beneficiaries` | KPI « Codes activés » avec dimension temps, cohortes d'activation. | P0 | App mobile + Bridge App / Xano. | Aujourd'hui seul `used` (boolean) existe sur le code, pas la date. |
| A.5 | Statut de délivrabilité (delivered / bounced / hard_bounce / soft_bounce / error) | `code_email_delivery_status` | enum | `beneficiaries` ou table `email_logs` | Filtres « Bounce », alerte UI sur emails invalides. | P1 | Brevo (webhook). | Non disponible. |
| A.6 | Date de la dernière relance | `last_reminder_at` | datetime | `beneficiaries` | Filtre « À relancer », CTA partenaire. | P1 | Xano (backend doit stocker à chaque renvoi). | Frontend a explicitement omis l'affichage « À relancer » faute de cette donnée (cf. lots 1/2). |
| A.7 | Nombre de relances cumulées | `reminder_count` | integer | `beneficiaries` | Évite la surrelance, cap configurable. | P2 | Xano. | — |
| A.8 | Identifiant de message Brevo | `brevo_message_id` | string | idem | Traçabilité, support technique. | P2 | Brevo. | — |

## B. Partenaires / salariés

| # | Donnée fonctionnelle | Nom technique suggéré | Type | Table probable | Usage UI cible | Priorité | Dépendance | Blocage actuel |
|---|---|---|---|---|---|---|---|---|
| B.1 | Département / service du salarié | `department` (existe partiellement) | string | `beneficiaries` | Adoption par département dans le Dashboard partenaire. | P1 | Xano + champ saisi à l'import CSV. | Le champ `department` existe déjà côté `beneficiaries` mais pas exploité comme dimension d'agrégation côté frontend (pas de KPI par département). |
| B.2 | Cohorte d'envoi (campagne, vague) | `cohort_label` ou FK `cohort_id` | string / int | `beneficiaries` ou table `cohorts` | Suivi des vagues de déploiement. | P1 | Xano. | Aucune donnée de campagne aujourd'hui. |
| B.3 | Site / établissement | `site_label` | string | `beneficiaries` | Filtre site (groupes multi-sites). | P2 | Xano + import CSV. | — |
| B.4 | Population cible | `target_population` | string / enum | `beneficiaries` | Segmentation. | P2 | Xano. | — |
| B.5 | Référent RH / responsable opérationnel | `hr_contact_id` (FK contacts) | int | `beneficiaries` | Routage des demandes/notifications. | P2 | Xano. | — |
| B.6 | Date de dernière connexion app | `last_app_login_at` | datetime | `beneficiaries` ou `app-users` | KPI « Adoption », alertes inactivité. | P1 | App mobile + Bridge App. | Pas de donnée d'auth app retournée vers le CMS. |

## C. Support / demandes

`code_request` couvre déjà `request_type`, `request_status` (`pending` / `in_progress` / `approved` / `rejected`), `reason`, `quantity`, `preferred_date`, `created_at`, `processed_at`. Manquent les signaux SLA et internes.

| # | Donnée fonctionnelle | Nom technique suggéré | Type | Table probable | Usage UI cible | Priorité | Dépendance | Blocage actuel |
|---|---|---|---|---|---|---|---|---|
| C.1 | Priorité métier de la demande | `priority` | enum (`low`/`normal`/`high`/`urgent`) | `code_request` | Tri admin + alertes Dashboard. | P1 | Xano. | — |
| C.2 | SLA cible (date limite de réponse) | `sla_due_at` | datetime | `code_request` | Compteur « En retard » côté admin. | P1 | Xano (calculé sur création). | — |
| C.3 | Date de première réponse | `first_response_at` | datetime | `code_request` | Mesure des délais. | P1 | Xano (posé sur premier `update`). | — |
| C.4 | Date de résolution | `resolved_at` | datetime | `code_request` | KPI temps moyen de résolution. | P1 | Xano. | `processed_at` existe mais ne distingue pas résolution effective vs simple traitement. |
| C.5 | Responsable interne assigné | `assigned_admin_id` | FK cms_users | `code_request` | File « Mes demandes » côté admin. | P1 | Xano. | — |
| C.6 | Statut support enrichi | `support_status` | enum (`new`/`triaged`/`in_progress`/`waiting_partner`/`resolved`/`closed`) | `code_request` | Workflow plus fin que pending/in_progress/approved/rejected. | P1 | Xano. | — |
| C.7 | Canal d'origine de la demande | `source_channel` | enum (`partner_dashboard`/`email`/`phone`/`other`) | `code_request` | Reporting. | P2 | Xano. | — |

## D. Audit / sécurité

Il n'existe **aucune table d'audit dédiée** aujourd'hui. La page admin
`ActivityLog.jsx` reconstruit un journal en agrégeant des `created_at` /
`processed_at` côté client — non fiable pour la conformité.

| # | Donnée fonctionnelle | Nom technique suggéré | Type | Table probable | Usage UI cible | Priorité | Dépendance | Blocage actuel |
|---|---|---|---|---|---|---|---|---|
| D.1 | Acteur de l'action | `actor_user_id` (FK cms_users) | int | `audit_logs` (à créer) | Page Activity admin, traçabilité. | P0 | Xano. | Pas de table `audit_logs`. |
| D.2 | Email de l'acteur (snapshot) | `actor_email` | string | `audit_logs` | Cas où l'utilisateur est supprimé. | P0 | Xano. | — |
| D.3 | Date de l'action | `acted_at` | datetime | `audit_logs` | Tri chronologique. | P0 | Xano. | — |
| D.4 | Rôle au moment de l'action | `actor_role` | enum (`admin`/`partner_admin`/`partner_member`/`system`) | `audit_logs` | Diagnostiquer les escalations. | P0 | Xano. | — |
| D.5 | Type d'objet modifié | `object_type` | enum (`partner`/`partner_member`/`code_request`/`beneficiary`/`activation_code`/`subject`/`session`/`cut`) | `audit_logs` | Filtres. | P0 | Xano. | — |
| D.6 | Identifiant de l'objet | `object_id` | int | `audit_logs` | Lien direct vers la fiche. | P0 | Xano. | — |
| D.7 | Action | `action_type` | enum (`create`/`update`/`delete`/`send`/`login`/`signup`/`role_change`) | `audit_logs` | Reporting. | P0 | Xano. | — |
| D.8 | Anciennes valeurs (snapshot diff) | `previous_values` | json | `audit_logs` | Diagnostic d'une régression métier. | P1 | Xano. | — |
| D.9 | Nouvelles valeurs (snapshot diff) | `new_values` | json | `audit_logs` | idem. | P1 | Xano. | — |
| D.10 | Endpoint appelé | `endpoint` | string | `audit_logs` | Forensic. | P1 | Xano. | — |
| D.11 | IP source / user-agent | `ip_address`, `user_agent` | string | `audit_logs` | Détection d'anomalies. | P2 | Xano. | — |

### Actions à journaliser en priorité

- Login / logout / `auth/signup` (D, par admin).
- Création / suppression d'admin ou de partner_member.
- Génération de codes (`plan-activation-code` create).
- Envoi de codes (unitaire, batch).
- Suppression Cocon (subject / session / cut).
- Imports CSV (partenaires, salariés).
- Modification de `request_status` (approval / rejet).
- Modification de `partners.crm_status` ou `contract`.

## E. Hors scope frontend pur

Pour mémoire, ces données existent ou seront produites en dehors de Xano :

| Donnée | Producteur | Bridge nécessaire |
|---|---|---|
| Adoption app détaillée (sessions, durée d'écoute, complétion) | App mobile | Bridge App → Xano (push périodique ou webhook). |
| Souscriptions / paiements | RevenueCat | Webhook RevenueCat → Xano `subscriptions`. |
| Bounce / open / click email | Brevo | Webhook Brevo → table `email_events`. |

## Notes méthodologiques

- Tous les noms techniques sont **suggestifs** ; le backend reste libre de choisir une convention cohérente avec l'existant (ex. `snake_case` pour les nouvelles tables — la divergence `partnerId` vs `partner_id` actuelle dans `plan-activation-code` est un legacy à ne pas reproduire, voir `docs/api-endpoint-inventory.md`).
- Aucun de ces champs n'est codé côté frontend dans ce lot. L'affichage suivra dans des lots dédiés une fois la donnée disponible et stable côté Xano.
- Les dépendances Brevo / RevenueCat / Bridge App restent à arbitrer projet par projet ; ce document ne propose **pas** d'implémentation.
