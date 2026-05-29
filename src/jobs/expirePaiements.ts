import cron from 'node-cron'
import { StatutPaiement } from '@prisma/client'
import prisma from '../lib/prisma'
import { sendPaiementExpireToMembre } from '../services/mailer'

// Runs every 2 minutes — marks EN_ATTENTE payments older than 10 min as ECHOUE and notifies members
export function startExpirePaiementsJob() {
  cron.schedule('*/2 * * * *', async () => {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000)

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
