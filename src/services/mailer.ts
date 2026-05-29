import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

const FROM = `Taiyo Fit <${process.env.GMAIL_USER}>`

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
  await transporter.sendMail({
    from: FROM,
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
      <p>Connecte-toi à l'interface admin pour valider la demande une fois le virement reçu.</p>
    `
  })
}

export async function sendDemandeConfirmationToMembre(data: DemandePackEmailData) {
  await transporter.sendMail({
    from: FROM,
    to: data.membreEmail,
    subject: `Demande de pack reçue — ${data.packNom}`,
    html: `
      <h2>Bonjour ${data.membrePrenom} !</h2>
      <p>Ta demande pour le <strong>${data.packNom} (${data.packNbSessions} sessions)</strong> a bien été enregistrée.</p>
      <p>Malak va la valider dès réception de ton virement. Tu recevras un email de confirmation.</p>
      <p>À très bientôt au studio !</p>
      <p><em>L'équipe Taiyo Fit</em></p>
    `
  })
}

export async function sendPaiementExpireToMembre(data: { membrePrenom: string; membreEmail: string; packNom: string }) {
  await transporter.sendMail({
    from: FROM,
    to: data.membreEmail,
    subject: `Paiement expiré — ${data.packNom}`,
    html: `
      <h2>Bonjour ${data.membrePrenom},</h2>
      <p>Ta session de paiement pour le pack <strong>${data.packNom}</strong> a expiré (délai de 10 minutes dépassé).</p>
      <p>Aucun montant n'a été débité. Tu peux relancer une commande à tout moment depuis l'application.</p>
      <p><em>L'équipe Taiyo Fit</em></p>
    `
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
  await transporter.sendMail({
    from: FROM,
    to: data.membreEmail,
    subject: `Séance annulée — ${data.coursTitre}`,
    html: `
      <h2>Bonjour ${data.membrePrenom},</h2>
      <p>La séance <strong>${data.coursTitre}</strong> prévue le <strong>${data.coursDate}</strong> a été annulée.</p>
      <p>Ta session a été <strong>remboursée automatiquement</strong> sur ton pack.<br>
         Il te reste désormais <strong>${data.sessionsRestantes} session${data.sessionsRestantes > 1 ? 's' : ''}</strong> disponible${data.sessionsRestantes > 1 ? 's' : ''}.</p>
      <p>Toutes nos excuses pour la gêne occasionnée. N'hésite pas à réserver une autre séance dès que possible.</p>
      <p><em>L'équipe Taiyo Fit</em></p>
    `
  })
}

export async function sendAnnulationReservationToAdmin(data: {
  membrePrenom: string
  membreNom: string
  membreEmail: string
  coursTitre: string
  coursDate: string
}) {
  await transporter.sendMail({
    from: FROM,
    to: process.env.MALAK_EMAIL!,
    subject: `Annulation réservation — ${data.membrePrenom} ${data.membreNom} · ${data.coursTitre}`,
    html: `
      <h2>Un adhérent a annulé sa réservation</h2>
      <p><strong>Adhérent :</strong> ${data.membrePrenom} ${data.membreNom} (${data.membreEmail})</p>
      <p><strong>Cours :</strong> ${data.coursTitre}</p>
      <p><strong>Date :</strong> ${data.coursDate}</p>
      <hr>
      <p>Sa session a été automatiquement remboursée sur son pack.<br>
         Une place s'est libérée dans ce cours.</p>
    `,
  })
}

export async function sendValidationConfirmationToMembre(data: DemandePackEmailData) {
  await transporter.sendMail({
    from: FROM,
    to: data.membreEmail,
    subject: `Pack activé — ${data.packNom}`,
    html: `
      <h2>Bonne nouvelle ${data.membrePrenom} !</h2>
      <p>Ton pack <strong>${data.packNom}</strong> est maintenant actif — tu disposes de <strong>${data.packNbSessions} sessions</strong>.</p>
      <p>Tu peux dès maintenant réserver tes cours dans l'application.</p>
      <p>On t'attend !</p>
      <p><em>L'équipe Taiyo Fit</em></p>
    `
  })
}
