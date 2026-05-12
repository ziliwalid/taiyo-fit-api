import { Request, Response } from 'express'
import { StatutReservation, StatutSeance } from '@prisma/client'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

export async function listPacks(_req: Request, res: Response) {
  const packs = await prisma.pack.findMany({ orderBy: { id: 'asc' } })
  res.json({ success: true, message: `${packs.length} pack(s) disponibles`, data: packs })
}

export async function getMonPack(req: AuthRequest, res: Response) {
  const compte = await prisma.comptePack.findUnique({
    where: { utilisateurId: req.user!.id },
    include: { pack: true }
  })
  if (!compte) {
    res.status(404).json({ success: false, message: "Vous n'avez pas de pack actif. Contactez Malak pour en obtenir un." })
    return
  }
  res.json({
    success: true,
    message: `Pack "${compte.pack.nom}" actif — il vous reste ${compte.sessionsRestantes} session(s)`,
    data: compte
  })
}

export async function getMonDashboard(req: AuthRequest, res: Response) {
  const userId = req.user!.id

  const [comptePack, reservations, seancesEffectuees] = await Promise.all([
    prisma.comptePack.findUnique({
      where: { utilisateurId: userId },
      select: {
        sessionsRestantes: true,
        pack: { select: { nom: true, nbSessions: true } },
      },
    }),

    // Upcoming reserved sessions — not cancelled, course not done/cancelled
    prisma.reservation.findMany({
      where: {
        utilisateurId: userId,
        statut: { not: StatutReservation.ANNULE },
        cours: {
          statutSeance: { notIn: [StatutSeance.EFFECTUE, StatutSeance.ANNULE] },
          dateHeure: { gte: new Date() },
        },
      },
      include: {
        cours: {
          select: {
            id: true, titre: true, dateHeure: true, dureeMinutes: true,
            placesMax: true, statutSeance: true, adresse: true,
            imageUrl: true, messageCoach: true,
            coach: { select: { nom: true, prenom: true } },
          },
        },
      },
      orderBy: { cours: { dateHeure: 'asc' } },
    }),

    // Count attended sessions (course marked EFFECTUE + reservation not cancelled)
    prisma.reservation.count({
      where: {
        utilisateurId: userId,
        statut: { not: StatutReservation.ANNULE },
        cours: { statutSeance: StatutSeance.EFFECTUE },
      },
    }),
  ])

  res.json({
    success: true,
    message: 'Dashboard membre',
    data: {
      comptePack,
      prochaines: reservations.map((r) => ({
        reservationId: r.id,
        statut: r.statut,
        cours: r.cours,
      })),
      stats: {
        seancesEffectuees,
        reservationsAVenir: reservations.length,
      },
    },
  })
}
