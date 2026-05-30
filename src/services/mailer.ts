import { Resend } from 'resend'

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const FROM = process.env.FROM_EMAIL ?? 'Taiyo Fit <onboarding@resend.dev>'

// Called on startup — confirms the API key is present
export function verifyMailer() {
  if (!process.env.RESEND_API_KEY) {
    console.error('[mailer] RESEND_API_KEY is not set — emails will fail')
  } else {
    console.log('[mailer] Resend ready ✓')
  }
}

// ─── Core send with full logging ──────────────────────────────────────────────

interface SendParams {
  template: string
  to: string
  subject: string
  html: string
}

async function send({ template, to, subject, html }: SendParams): Promise<void> {
  console.log(`[mailer] sending "${template}" → ${to}`)
  const { data, error } = await getResend().emails.send({ from: FROM, to, subject, html })

  if (error) {
    console.error(`[mailer] FAILED "${template}" → ${to} | ${JSON.stringify(error)}`)
    throw new Error(error.message)
  }

  console.log(`[mailer] sent "${template}" → ${to} | id=${data?.id}`)
}

// ─── Templates ────────────────────────────────────────────────────────────────

interface DemandePackEmailData {
  membrePrenom: string
  membreNom: string
  membreEmail: string
  membreTelephone?: string | null
  packNom: string
  packNbSessions: number
  packDescription?: string | null
}

export async function sendDemandePackToAdmin(data: DemandePackEmailData) {
  await send({
    template: 'demande-pack-admin',
    to: process.env.MALAK_EMAIL!,
    subject: `Nouvelle demande de pack — ${data.membrePrenom} ${data.membreNom}`,
    html: `
      <h2>Nouvelle demande de pack</h2>
      <p><strong>Adhérent :</strong> ${data.membrePrenom} ${data.membreNom}</p>
      <p><strong>Email :</strong> ${data.membreEmail}</p>
      ${data.membreTelephone ? `<p><strong>Téléphone :</strong> ${data.membreTelephone}</p>` : ''}
      <hr>
      <p><strong>Pack demandé :</strong> ${data.packNom} (${data.packNbSessions} sessions)</p>
      ${data.packDescription ? `<p><strong>Description :</strong> ${data.packDescription}</p>` : ''}
      <hr>
      <p>Connecte-toi à l'interface admin pour valider la demande.</p>
    `,
  })
}

export async function sendDemandeConfirmationToMembre(data: DemandePackEmailData) {
  await send({
    template: 'demande-pack-confirmation',
    to: data.membreEmail,
    subject: `Demande de pack reçue — ${data.packNom}`,
    html: `
      <h2>Bonjour ${data.membrePrenom} !</h2>
      <p>Ta demande pour le <strong>${data.packNom} (${data.packNbSessions} sessions)</strong> a bien été enregistrée.</p>
      <p>Tu recevras un email de confirmation dès validation.</p>
      <p>À très bientôt au studio !</p>
      <p><em>L'équipe Taiyo Fit</em></p>
    `,
  })
}

export async function sendPaiementExpireToMembre(data: { membrePrenom: string; membreEmail: string; packNom: string }) {
  await send({
    template: 'paiement-expire',
    to: data.membreEmail,
    subject: `Paiement expiré — ${data.packNom}`,
    html: `
      <h2>Bonjour ${data.membrePrenom},</h2>
      <p>Ta session de paiement pour le pack <strong>${data.packNom}</strong> a expiré (délai de 10 minutes dépassé).</p>
      <p>Aucun montant n'a été débité. Tu peux relancer une commande à tout moment depuis l'application.</p>
      <p><em>L'équipe Taiyo Fit</em></p>
    `,
  })
}

interface SeanceAnnuleeEmailData {
  membrePrenom: string
  membreEmail: string
  coursTitre: string
  coursDate: string
  sessionsRendues: number
  sessionsRestantes: number
}

export async function sendSeanceAnnuleeToMembre(data: SeanceAnnuleeEmailData) {
  await send({
    template: 'seance-annulee',
    to: data.membreEmail,
    subject: `Séance annulée — ${data.coursTitre}`,
    html: `
      <h2>Bonjour ${data.membrePrenom},</h2>
      <p>La séance <strong>${data.coursTitre}</strong> prévue le <strong>${data.coursDate}</strong> a été annulée.</p>
      <p>Ta session a été <strong>remboursée automatiquement</strong> sur ton pack.<br>
         Il te reste désormais <strong>${data.sessionsRestantes} session${data.sessionsRestantes > 1 ? 's' : ''}</strong> disponible${data.sessionsRestantes > 1 ? 's' : ''}.</p>
      <p>Toutes nos excuses pour la gêne occasionnée.</p>
      <p><em>L'équipe Taiyo Fit</em></p>
    `,
  })
}

export async function sendAnnulationReservationToAdmin(data: {
  membrePrenom: string
  membreNom: string
  membreEmail: string
  coursTitre: string
  coursDate: string
}) {
  await send({
    template: 'annulation-reservation-admin',
    to: process.env.MALAK_EMAIL!,
    subject: `Annulation réservation — ${data.membrePrenom} ${data.membreNom} · ${data.coursTitre}`,
    html: `
      <h2>Un adhérent a annulé sa réservation</h2>
      <p><strong>Adhérent :</strong> ${data.membrePrenom} ${data.membreNom} (${data.membreEmail})</p>
      <p><strong>Cours :</strong> ${data.coursTitre}</p>
      <p><strong>Date :</strong> ${data.coursDate}</p>
      <hr>
      <p>Sa session a été automatiquement remboursée sur son pack. Une place s'est libérée.</p>
    `,
  })
}

export async function sendValidationConfirmationToMembre(data: DemandePackEmailData) {
  await send({
    template: 'paiement-confirme',
    to: data.membreEmail,
    subject: `Paiement confirmé — ${data.packNom}`,
    html: `
      <h2>Merci ${data.membrePrenom} !</h2>
      <p>Ton paiement a bien été reçu. Ton pack <strong>${data.packNom}</strong> est maintenant actif.</p>
      <p>Tu disposes de <strong>${data.packNbSessions} sessions</strong> à utiliser quand tu veux.</p>
      <p>Réserve ton premier cours dès maintenant depuis l'application.</p>
      <p>On t'attend au studio !</p>
      <p><em>L'équipe Taiyo Fit</em></p>
    `,
  })
}

export async function sendBienvenueToMembre(data: { prenom: string; email: string }) {
  await send({
    template: 'bienvenue',
    to: data.email,
    subject: `Bienvenue chez Taiyo Fit !`,
    html: `
      <h2>Bienvenue ${data.prenom} !</h2>
      <p>Ton compte Taiyo Fit a bien été créé. On est ravis de t'avoir parmi nous !</p>
      <p>Voici les prochaines étapes :</p>
      <ul>
        <li>Choisis ton pack de sessions et paie en ligne en toute sécurité</li>
        <li>Ton pack est activé instantanément après le paiement</li>
        <li>Réserve tes cours et débarque au studio !</li>
      </ul>
      <p>À très bientôt,</p>
      <p><em>L'équipe Taiyo Fit</em></p>
    `,
  })
}
