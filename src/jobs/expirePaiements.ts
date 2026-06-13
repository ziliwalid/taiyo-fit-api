import cron from 'node-cron'
import { StatutPaiement } from '@prisma/client'
import prisma from '../lib/prisma'
import { sendPaiementExpireToMembre } from '../services/mailer'

// Runs every 4 minutes — keeps Neon DB warm + expires stale payments
export function startExpirePaiementsJob() {
  cron.schedule('*/4 * * * *', async () => {
    // Keep-alive ping to prevent Neon cold starts
    await prisma.$queryRaw`SELECT 1`
    // 35 min cutoff — safety net only. Stripe sessions last 30 min and fire
    // checkout.session.expired webhook which handles expiry. This cron only
    // catches edge cases where the webhook failed to deliver.
    const cutoff = new Date(Date.now() - 35 * 60 * 1000)

    const expiredPaiements = await prisma.paiement.findMany({
      where: {
        statut:    StatutPaiement.EN_ATTENTE,
        createdAt: { lt: cutoff },
      },
      include: {
        utilisateur: { select: { prenom: true, email: true } },
        pack:        { select: { nom: true } },
      },
    })

    if (expiredPaiements.length === 0) return

    await prisma.paiement.updateMany({
      where: { id: { in: expiredPaiements.map(p => p.id) } },
      data:  { statut: StatutPaiement.ECHOUE },
    })

    console.log(`[cron] ${expiredPaiements.length} paiement(s) EN_ATTENTE expirés → ECHOUE`)

    for (const p of expiredPaiements) {
      sendPaiementExpireToMembre({
        membrePrenom: p.utilisateur.prenom,
        membreEmail:  p.utilisateur.email,
        packNom:      p.pack.nom,
      }).catch((err) => {
        console.error(`[cron] email expiration failed for ${p.utilisateur.email}:`, err.message)
      })
    }
  })
}
