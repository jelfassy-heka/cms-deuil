import { useState } from 'react'

const FAQ_ITEMS = [
  {
    category: 'Codes',
    questions: [
      {
        q: 'Comment envoyer un code à un salarié ?',
        a: 'Rendez-vous dans "Mes codes", onglet Salariés. Cliquez sur "Envoyer" à côté du salarié concerné, sélectionnez un code disponible, puis confirmez. Le salarié recevra un email avec son code d\'accès.',
      },
      {
        q: 'Comment envoyer des codes à plusieurs salariés en même temps ?',
        a: 'Dans "Mes codes", cliquez sur "Envoi groupé". Cochez les salariés souhaités (ou "Tout sélectionner"), puis cliquez sur "Envoyer N codes". Vous pouvez ajouter un message personnalisé avant l\'envoi.',
      },
      {
        q: 'Que faire si un code ne fonctionne pas ?',
        a: 'Vérifiez d\'abord que le code n\'a pas déjà été utilisé (statut "Utilisé" dans l\'onglet Codes). Si le problème persiste, faites une demande d\'assistance via "Nouvelle demande" → "Assistance".',
      },
      {
        q: 'Comment obtenir plus de codes ?',
        a: 'Faites une "Nouvelle demande" → "Demande de codes" en précisant le nombre souhaité et le motif. L\'équipe Héka traitera votre demande dans les meilleurs délais.',
      },
    ],
  },
  {
    category: 'Salariés',
    questions: [
      {
        q: 'Comment ajouter des salariés ?',
        a: 'Dans "Mes codes", cliquez sur "+ Ajouter" pour ajouter un salarié manuellement, ou sur "CSV" pour importer une liste depuis un fichier CSV. Le fichier doit contenir au minimum les colonnes Prénom, Nom et Email.',
      },
      {
        q: 'Comment importer un fichier CSV ?',
        a: 'Cliquez sur "CSV" dans la page "Mes codes". Glissez votre fichier ou cliquez pour le sélectionner. L\'outil détecte automatiquement les colonnes (Prénom, Nom, Email, Service). Vérifiez le mapping puis lancez l\'import.',
      },
    ],
  },
  {
    category: 'Équipe',
    questions: [
      {
        q: 'Comment inviter un collaborateur ?',
        a: 'Rendez-vous dans "Mon équipe" et cliquez sur "+ Inviter un collaborateur". Renseignez l\'email et choisissez le rôle (Membre ou Administrateur). Le collaborateur devra se connecter avec cet email.',
      },
      {
        q: 'Quelle est la différence entre Administrateur et Membre ?',
        a: 'Les Administrateurs peuvent inviter et retirer des membres, modifier les informations de l\'espace partenaire et gérer les rôles. Les Membres peuvent envoyer des codes, ajouter des salariés et faire des demandes.',
      },
    ],
  },
  {
    category: 'Contrat',
    questions: [
      {
        q: 'Comment renouveler mon contrat ?',
        a: 'Rendez-vous dans "Mon contrat" et cliquez sur "Renouvellement", ou faites une "Nouvelle demande" → "Renouvellement contrat". L\'équipe Héka vous recontactera pour les modalités.',
      },
      {
        q: 'Où trouver mes documents contractuels ?',
        a: 'Vos documents sont disponibles dans la page "Mon contrat". Cliquez sur "Télécharger" pour accéder à votre contrat en PDF.',
      },
    ],
  },
]

const GUIDE_STEPS = [
  { icon: '👥', title: 'Ajoutez vos salariés', desc: 'Importez votre liste via CSV ou ajoutez-les un par un.' },
  { icon: '🔑', title: 'Envoyez les codes', desc: 'Sélectionnez les salariés et envoyez-leur un code d\'accès par email.' },
  { icon: '📊', title: 'Suivez l\'utilisation', desc: 'Consultez le tableau de bord pour suivre les activations.' },
  { icon: '📋', title: 'Faites vos demandes', desc: 'Besoin de codes supplémentaires ou d\'aide ? Créez une demande.' },
]

function AccordionItem({ question, answer }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b" style={{ borderColor: '#f4f5f7' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left"
        style={{ color: '#1a2b4a' }}>
        <span className="text-sm font-medium pr-4">{question}</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
          className="flex-shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>
          <path d="M4 6l4 4 4-4" stroke="#8a93a2" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="pb-4 animate-fade-in">
          <p className="text-sm leading-relaxed" style={{ color: '#8a93a2' }}>{answer}</p>
        </div>
      )}
    </div>
  )
}

const SHORTCUTS = [
  { path: 'codes', label: 'Mes codes', desc: 'Envoyer et suivre les codes', icon: '🔑', color: '#2BBFB3' },
  { path: 'requests', label: 'Mes demandes', desc: 'Codes, RDV, assistance', icon: '📋', color: '#d97706' },
  { path: 'team', label: 'Mon équipe', desc: 'Membres et invitations', icon: '👥', color: '#1a2b4a' },
  { path: 'contract', label: 'Mon contrat', desc: 'Détails et documents', icon: '📄', color: '#8b5cf6' },
]

export default function PartnerHelp({ onNavigate }) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#1a2b4a' }}>Centre d'aide</h1>
        <p className="text-sm mt-1" style={{ color: '#8a93a2' }}>Tout ce que vous devez savoir pour utiliser votre espace</p>
      </div>

      {/* Raccourcis */}
      {onNavigate && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {SHORTCUTS.map(s => (
            <button key={s.path}
              onClick={() => onNavigate(s.path)}
              className="bg-white rounded-2xl p-4 text-left transition-all hover:shadow-md group"
              style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ backgroundColor: s.color + '15' }}>
                  <span className="text-lg">{s.icon}</span>
                </div>
              </div>
              <p className="text-sm font-semibold" style={{ color: '#1a2b4a' }}>{s.label}</p>
              <p className="text-xs mt-0.5" style={{ color: '#8a93a2' }}>{s.desc}</p>
            </button>
          ))}
        </div>
      )}

      {/* Guide de prise en main */}
      <div className="bg-white rounded-2xl p-5 md:p-6 mb-6" style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
        <h2 className="font-bold text-base mb-4" style={{ color: '#1a2b4a' }}>Guide de prise en main</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {GUIDE_STEPS.map((step, i) => (
            <div key={i} className="rounded-xl p-4" style={{ backgroundColor: '#f4f5f7' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: '#2BBFB3' }}>
                  {i + 1}
                </div>
                <span className="text-lg">{step.icon}</span>
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: '#1a2b4a' }}>{step.title}</p>
              <p className="text-xs" style={{ color: '#8a93a2' }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      {FAQ_ITEMS.map(section => (
        <div key={section.category}
          className="bg-white rounded-2xl p-5 md:p-6 mb-4"
          style={{ boxShadow: '0 4px 24px rgba(43,191,179,0.06)' }}>
          <h2 className="font-bold text-base mb-2" style={{ color: '#1a2b4a' }}>{section.category}</h2>
          {section.questions.map((item, i) => (
            <AccordionItem key={i} question={item.q} answer={item.a} />
          ))}
        </div>
      ))}

      {/* Contact */}
      <div className="rounded-2xl p-5 md:p-6 text-center"
        style={{ backgroundColor: '#e8f8f7', border: '1px solid #a7f3d0' }}>
        <p className="text-base font-bold mb-1" style={{ color: '#065f46' }}>Besoin d'aide supplémentaire ?</p>
        <p className="text-sm mb-4" style={{ color: '#065f46' }}>Notre équipe est disponible pour vous accompagner.</p>
        <button
          onClick={() => onNavigate && onNavigate('requests')}
          className="px-5 py-3 rounded-2xl text-white text-sm font-semibold"
          style={{ backgroundColor: '#2BBFB3' }}>
          Contacter l'assistance →
        </button>
      </div>
    </div>
  )
}