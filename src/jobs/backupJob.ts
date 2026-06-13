import cron from 'node-cron'
import { Resend } from 'resend'
import prisma from '../lib/prisma'

// Runs every Sunday at 3:00 AM — full DB export sent to Malak's email
export function startBackupJob() {
  cron.schedule('0 3 * * 0', async () => {
    console.log('[backup] Starting weekly backup...')

    try {
      const [
        utilisateurs,
        coachs,
        cours,
        reservations,
        packs,
        comptesPack,
        paiements,
        demandesPack,
        evenements,
        historique,
        notes,
        lieux,
      ] = await Promise.all([
        prisma.utilisateur.findMany({
          select: {
            id: true, email: true, nom: true, prenom: true,
            telephone: true, role: true, actif: true,
            emailVerifie: true, createdAt: true,
            // password excluded intentionally
          },
        }),
        prisma.coach.findMany(),
        prisma.cours.findMany(),
        prisma.reservation.findMany(),
        prisma.pack.findMany(),
        prisma.comptePack.findMany(),
        prisma.paiement.findMany(),
        prisma.demandePack.findMany(),
        prisma.evenement.findMany(),
        prisma.historiqueSession.findMany(),
        prisma.noteCours.findMany(),
        prisma.lieu.findMany(),
      ])

      const backup = {
        exportedAt: new Date().toISOString(),
        counts: {
          utilisateurs: utilisateurs.length,
          coachs: coachs.length,
          cours: cours.length,
          reservations: reservations.length,
          packs: packs.length,
          comptesPack: comptesPack.length,
          paiements: paiements.length,
          demandesPack: demandesPack.length,
        },
        data: {
          utilisateurs,
          coachs,
          cours,
          reservations,
          packs,
          comptesPack,
          paiements,
          demandesPack,
          evenements,
          historique,
          notes,
          lieux,
        },
      }

      const json    = JSON.stringify(backup, null, 2)
      const buffer  = Buffer.from(json, 'utf-8')
      const dateStr = new Date().toISOString().split('T')[0]
      const filename = `taiyo-fit-backup-${dateStr}.json`

      const resend = new Resend(process.env.RESEND_API_KEY)
      const from   = process.env.FROM_EMAIL ?? 'Taiyo Fit <onboarding@resend.dev>'
      const to     = process.env.MALAK_EMAIL!

      await resend.emails.send({
        from,
        to,
        subject: `📦 Backup Taiyo Fit — ${dateStr}`,
        html: `
          <div style="background:#0a0a0a;padding:40px 32px;font-family:system-ui,sans-serif;color:#fff;max-width:520px">
            <img src="https://taiyo-fit-lyart.vercel.app/logo.png" alt="Taiyo Fit" width="120" style="display:block;margin-bottom:32px" />
            <p style="font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:0.2em;text-transform:uppercase;margin:0 0 16px">Backup hebdomadaire</p>
            <h1 style="font-size:22px;font-weight:900;margin:0 0 24px;color:#fff">Sauvegarde du ${dateStr}</h1>
            <table style="width:100%;border-collapse:collapse;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);margin-bottom:24px">
              <tbody>
                ${Object.entries(backup.counts).map(([key, count]) => `
                  <tr>
                    <td style="padding:10px 16px;color:rgba(255,255,255,0.3);font-size:12px;text-transform:capitalize">${key}</td>
                    <td style="padding:10px 16px;color:#FFD700;font-size:13px;font-weight:700">${count}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <p style="color:rgba(255,255,255,0.35);font-size:13px;line-height:1.6;margin:0">
              Le fichier <strong style="color:#fff">${filename}</strong> est en pièce jointe.<br>
              Conserve-le dans un endroit sûr (Google Drive, iCloud...).
            </p>
            <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:28px 0" />
            <p style="color:rgba(255,255,255,0.15);font-size:11px;margin:0">Taiyo Fit · Backup automatique · Chaque dimanche à 3h</p>
          </div>
        `,
        attachments: [
          {
            filename,
            content: buffer,
          },
        ],
      })

      console.log(`[backup] ✅ Backup sent to ${to} — ${utilisateurs.length} users, ${cours.length} cours, ${paiements.length} paiements`)
    } catch (err) {
      console.error('[backup] ❌ Failed:', err)
    }
  })

  console.log('[backup] Weekly backup job scheduled — every Sunday at 3:00 AM')
}
