// Centralisation des appels backend de l'espace Partenaire.
// Cette couche enveloppe `xano` et les endpoints custom (send-email, send-code-email,
// change-password) sans modifier ni les URLs ni la forme des payloads.
//
// IMPORTANT : les noms de paramètres backend sont préservés tels quels.
// `plan-activation-code` attend `partnerId` (camelCase) tandis que les autres
// tables attendent `partner_id` (snake_case). Toute uniformisation côté client
// briserait les filtres serveur — voir les sites d'appel d'origine.

import xano from '../lib/xano'

const XANO_BASE = 'https://x8xu-lmx9-ghko.p7.xano.io/api:M9mahf09'
const XANO_AUTH_URL = 'https://x8xu-lmx9-ghko.p7.xano.io/api:IS_IPWIL'

// ─── Reads ──────────────────────────────────────────
export const getPartner = (partnerId) => xano.getOne('partners', partnerId)

export const getCodes = (partnerId) =>
  xano.getAll('plan-activation-code', { partnerId })

export const getBeneficiaries = (partnerId) =>
  xano.getAll('beneficiaries', { partner_id: partnerId })

export const getContracts = (partnerId) =>
  xano.getAll('contracts', { partner_id: partnerId })

export const getRequests = (partnerId) =>
  xano.getAll('code_request', { partner_id: partnerId })

export const getMembers = (partnerId) =>
  xano.getAll('partner_members', { partner_id: partnerId })

// ─── Writes — beneficiaries ────────────────────────
export const createBeneficiary = (data) =>
  xano.create('beneficiaries', data)

export const updateBeneficiary = (id, data) =>
  xano.update('beneficiaries', id, data)

// ─── Writes — partner_members ──────────────────────
export const createMember = (data) =>
  xano.create('partner_members', data)

export const updateMember = (id, data) =>
  xano.update('partner_members', id, data)

export const removeMember = (id) =>
  xano.remove('partner_members', id)

// ─── Writes — partner ──────────────────────────────
export const updatePartner = (id, data) =>
  xano.update('partners', id, data)

// ─── Writes — code requests ────────────────────────
export const createRequest = (data) =>
  xano.create('code_request', data)

// ─── Custom endpoints (non-CRUD) ───────────────────
// Email transactionnel via template_id (T#9, T#11, T#12, T#13, T#15, …).
// `params` est sérialisé en JSON côté backend, on conserve cet usage.
export const sendNotificationEmail = (to_email, to_name, template_id, params) =>
  fetch(`${XANO_BASE}/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to_email, to_name, template_id, params: JSON.stringify(params) }),
  })

// Envoi du code par email (template T#9). Le payload est passé tel quel pour
// préserver le support du `custom_message` côté envoi groupé.
export const sendCodeEmail = (payload) =>
  fetch(`${XANO_BASE}/send-code-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

// Changement de mot de passe — base auth distincte, requiert le bearer token.
export const changePassword = (authToken, oldPassword, newPassword) =>
  fetch(`${XANO_AUTH_URL}/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  })
