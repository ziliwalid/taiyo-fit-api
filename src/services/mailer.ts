import { Resend } from 'resend'

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const FROM = process.env.FROM_EMAIL ?? 'Taiyo Fit <onboarding@resend.dev>'
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'https://taiyo-fit-lyart.vercel.app'

export function verifyMailer() {
  if (!process.env.RESEND_API_KEY) {
    console.error('[mailer] RESEND_API_KEY is not set — emails will fail')
  } else {
    console.log('[mailer] Resend ready ✓')
  }
}

// ─── Shared layout ────────────────────────────────────────────────────────────

function layout(content: string): string {
  return `
    <div style="background:#0a0a0a;padding:0;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#ffffff">
      <div style="max-width:520px;margin:0 auto;padding:48px 32px">

        <!-- Logo -->
        <div style="margin-bottom:40px;padding-bottom:24px;border-bottom:1px solid rgba(255,255,255,0.06)">
          <a href="${FRONTEND_URL}" style="text-decoration:none">
            <span style="font-size:22px;font-weight:900;color:#FFD700;letter-spacing:-0.03em;text-transform:uppercase">TAIYO</span>
            <span style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.03em;text-transform:uppercase"> FIT</span>
          </a>
          <span style="display:block;font-size:10px;color:rgba(255,255,255,0.2);letter-spacing:0.25em;text-transform:uppercase;margin-top:4px">Shine Together · Rise Together</span>
        </div>

        <!-- Content -->
        ${content}

        <!-- Footer -->
        <div style="margin-top:48px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.06)">
          <p style="color:rgba(255,255,255,0.18);font-size:11px;margin:0 0 4px;letter-spacing:0.05em">
            Taiyo Fit · Paris 5ème
          </p>
          <p style="color:rgba(255,255,255,0.12);font-size:11px;margin:0">
            Tu reçois cet email car tu es membre de la communauté Taiyo Fit.
          </p>
        </div>

      </div>
    </div>
  `
}

function btn(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:#FFD700;color:#000000;font-weight:800;font-size:12px;text-decoration:none;padding:16px 36px;letter-spacing:0.15em;text-transform:uppercase;margin:24px 0">${label}</a>`
}

function tag(text: string): string {
  return `<span style="display:inline-block;background:rgba(255,215,0,0.1);color:#FFD700;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;padding:4px 12px;margin-bottom:20px">${text}</span>`
}

function h1(text: string): string {
  return `<h1 style="font-size:26px;font-weight:900;margin:0 0 16px;letter-spacing:-0.02em;line-height:1.2;color:#ffffff">${text}</h1>`
}

function p(text: string): string {
  return `<p style="color:rgba(255,255,255,0.5);font-size:15px;line-height:1.7;margin:0 0 16px">${text}</p>`
}

function infoRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:10px 16px;color:rgba(255,255,255,0.3);font-size:12px;letter-spacing:0.05em;white-space:nowrap">${label}</td>
      <td style="padding:10px 16px;color:#ffffff;font-size:13px;font-weight:600">${value}</td>
    </tr>
  `
}

function infoTable(rows: string): string {
  return `
    <table style="width:100%;border-collapse:collapse;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);margin:24px 0">
      <tbody>${rows}</tbody>
    </table>
  `
}

// ─── Core send ────────────────────────────────────────────────────────────────

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

// Admin — nouvelle demande de pack
export async function sendDemandePackToAdmin(data: DemandePackEmailData) {
  await send({
    template: 'demande-pack-admin',
    to: process.env.MALAK_EMAIL!,
    subject: `Nouvelle demande — ${data.membrePrenom} ${data.membreNom} · ${data.packNom}`,
    html: layout(`
      ${tag('Nouvelle demande de pack')}
      ${h1(`${data.membrePrenom} ${data.membreNom} demande un pack`)}
      ${p('Un adhérent vient de soumettre une demande de pack. Connecte-toi à l\'interface admin pour la valider ou la refuser.')}
      ${infoTable(`
        ${infoRow('Adhérent', `${data.membrePrenom} ${data.membreNom}`)}
        ${infoRow('Email', data.membreEmail)}
        ${data.membreTelephone ? infoRow('Téléphone', data.membreTelephone) : ''}
        ${infoRow('Pack demandé', data.packNom)}
        ${infoRow('Nb sessions', `${data.packNbSessions} sessions`)}
        ${data.packDescription ? infoRow('Description', data.packDescription) : ''}
      `)}
      ${btn('Voir les demandes', `${FRONTEND_URL}/admin/demandes`)}
    `),
  })
}

// Membre — confirmation de demande de pack
export async function sendDemandeConfirmationToMembre(data: DemandePackEmailData) {
  await send({
    template: 'demande-pack-confirmation',
    to: data.membreEmail,
    subject: `Demande reçue — ${data.packNom}`,
    html: layout(`
      ${tag('Demande en cours')}
      ${h1(`Ta demande a bien été reçue, ${data.membrePrenom} !`)}
      ${p(`Nous avons bien enregistré ta demande pour le <strong style="color:#ffffff">${data.packNom} · ${data.packNbSessions} sessions</strong>.`)}
      ${p('Notre équipe va l\'examiner et tu recevras un email de confirmation dès validation. Ça ne prend généralement pas longtemps !')}
      ${btn('Voir mon espace', `${FRONTEND_URL}/dashboard`)}
      ${p('<span style="font-size:13px">Une question ? Réponds directement à cet email.</span>')}
    `),
  })
}

// Membre — séance annulée par le coach
export async function sendSeanceAnnuleeToMembre(data: {
  membrePrenom: string
  membreEmail: string
  coursTitre: string
  coursDate: string
  sessionsRendues: number
  sessionsRestantes: number
}) {
  await send({
    template: 'seance-annulee',
    to: data.membreEmail,
    subject: `Séance annulée — ${data.coursTitre}`,
    html: layout(`
      ${tag('Séance annulée')}
      ${h1(`La séance a été annulée, ${data.membrePrenom}`)}
      ${infoTable(`
        ${infoRow('Séance', data.coursTitre)}
        ${infoRow('Date', data.coursDate)}
        ${infoRow('Session remboursée', `+${data.sessionsRendues} session${data.sessionsRendues > 1 ? 's' : ''} sur ton pack`)}
        ${infoRow('Solde restant', `${data.sessionsRestantes} session${data.sessionsRestantes > 1 ? 's' : ''} disponible${data.sessionsRestantes > 1 ? 's' : ''}`)}
      `)}
      ${p('Ta session a été <strong style="color:#FFD700">remboursée automatiquement</strong> sur ton pack. Toutes nos excuses pour la gêne occasionnée.')}
      ${btn('Réserver une autre séance', `${FRONTEND_URL}/catalog`)}
    `),
  })
}

// Admin — annulation de réservation par un membre
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
    subject: `Annulation — ${data.membrePrenom} ${data.membreNom} · ${data.coursTitre}`,
    html: layout(`
      ${tag('Annulation de réservation')}
      ${h1('Un membre a annulé sa réservation')}
      ${infoTable(`
        ${infoRow('Membre', `${data.membrePrenom} ${data.membreNom}`)}
        ${infoRow('Email', data.membreEmail)}
        ${infoRow('Cours', data.coursTitre)}
        ${infoRow('Date', data.coursDate)}
      `)}
      ${p('Sa session a été automatiquement remboursée sur son pack. Une place s\'est libérée sur cette séance.')}
      ${btn('Voir les séances', `${FRONTEND_URL}/admin/cours`)}
    `),
  })
}

// Membre — paiement Stripe confirmé
export async function sendValidationConfirmationToMembre(data: DemandePackEmailData) {
  await send({
    template: 'paiement-confirme',
    to: data.membreEmail,
    subject: `Pack activé — ${data.packNom} ✓`,
    html: layout(`
      ${tag('Paiement confirmé')}
      ${h1(`Ton pack est actif, ${data.membrePrenom} !`)}
      ${p(`Ton paiement a bien été reçu. Ton <strong style="color:#ffffff">${data.packNom}</strong> est maintenant actif sur ton compte.`)}
      ${infoTable(`
        ${infoRow('Pack', data.packNom)}
        ${infoRow('Sessions disponibles', `${data.packNbSessions} sessions`)}
        ${data.packDescription ? infoRow('Description', data.packDescription) : ''}
      `)}
      ${p('Tes sessions sont disponibles dès maintenant, sans date d\'expiration. Reserve ton premier cours quand tu veux !')}
      ${btn('Réserver une séance', `${FRONTEND_URL}/catalog`)}
      ${p('<span style="font-size:13px;color:rgba(255,255,255,0.3)">On t\'attend avec impatience. Shine Together. 🌟</span>')}
    `),
  })
}

// Membre — vérification email à l'inscription
export async function sendVerificationEmail(data: { prenom: string; email: string; token: string; frontendUrl: string }) {
  const link = `${data.frontendUrl}/verify-email?token=${data.token}`
  await send({
    template: 'verification-email',
    to: data.email,
    subject: 'Active ton compte Taiyo Fit ☀️',
    html: layout(`
      ${tag('Activation du compte')}
      ${h1(`Salut ${data.prenom}, une dernière étape !`)}
      ${p('Ton compte Taiyo Fit a bien été créé. Il ne reste plus qu\'à vérifier ton adresse email pour accéder à ta communauté et réserver tes premières séances.')}
      ${btn('Vérifier mon adresse email', link)}
      ${p('<span style="font-size:12px;color:rgba(255,255,255,0.2)">Ce lien est valable 72h. Si tu n\'as pas créé de compte, tu peux ignorer cet email en toute sécurité.</span>')}
      <p style="color:rgba(255,255,255,0.12);font-size:11px;margin:8px 0 0;word-break:break-all">${link}</p>
    `),
  })
}

// Membre — email de bienvenue (envoyé à l'inscription en parallèle de la vérif)
export async function sendBienvenueToMembre(data: { prenom: string; email: string }) {
  await send({
    template: 'bienvenue',
    to: data.email,
    subject: 'Bienvenue chez Taiyo Fit ☀️',
    html: layout(`
      ${tag('Bienvenue')}
      ${h1(`Bienvenue dans la famille, ${data.prenom} !`)}
      ${p('On est vraiment ravis de t\'avoir parmi nous. Taiyo Fit, c\'est une communauté portée par l\'énergie collective, le dépassement de soi et la bonne humeur.')}
      ${p('Voici comment ça se passe :')}
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px">
        ${[
          ['01', 'Vérifie ton email', 'Clique sur le lien de confirmation qu\'on vient de t\'envoyer.'],
          ['02', 'Choisis ton pack', 'Sélectionne le nombre de séances qui correspond à ton rythme.'],
          ['03', 'Réserve & viens', 'Choisis ton cours, bloque ta place et débarque au studio !'],
        ].map(([num, title, desc]) => `
          <tr>
            <td style="padding:12px 0;vertical-align:top;width:36px">
              <span style="font-size:18px;font-weight:900;color:rgba(255,215,0,0.25)">${num}</span>
            </td>
            <td style="padding:12px 0 12px 12px;vertical-align:top">
              <strong style="color:#ffffff;font-size:13px;display:block;margin-bottom:2px">${title}</strong>
              <span style="color:rgba(255,255,255,0.4);font-size:13px">${desc}</span>
            </td>
          </tr>
        `).join('')}
      </table>
      ${btn('Découvrir les packs', `${FRONTEND_URL}/packs`)}
      ${p('<span style="font-size:13px;color:rgba(255,255,255,0.3)">Shine Together. Rise Together. 🌟</span>')}
    `),
  })
}
