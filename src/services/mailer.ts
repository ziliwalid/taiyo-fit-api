import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.FROM_EMAIL ?? 'Taiyo Fit <onboarding@resend.dev>'

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
  await resend.emails.send({
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
  await resend.emails.send({
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

export async function sendValidationConfirmationToMembre(data: DemandePackEmailData) {
  await resend.emails.send({
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
