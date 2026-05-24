import { Response } from 'express'
import { StatutReservation } from '@prisma/client'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'
import { parseId } from '../lib/validate'

export async function getMesCours(req: AuthRequest, res: Response) {
  const coach = await prisma.coach.findUnique({ where: { utilisateurId: req.user!.id } })
  if (!coach) {
    res.status(404).json({ success: false, message: 'Profil coach introuvable pour cet utilisateur' })
    return
  }

  const cours = await prisma.cours.findMany({
    where: { coachId: coach.id },
    include: {
      reservations: { where: { statut: { not: StatutReservation.ANNULE } } }
    },
    orderBy: { dateHeure: 'asc' }
  })

  const data = cours.map((c) => ({
    ...c,
    nbParticipants: c.reservations.length,
    placesRestantes: c.placesMax - c.reservations.length,
    reservations: undefined,
  }))

  res.json({ success: true, message: `${cours.length} cours`, data })
}

export async function getCoursParticipants(req: AuthRequest, res: Response) {
  const coursId = parseId(req.params.id, res)
  if (coursId === null) return

  const coach = await prisma.coach.findUnique({ where: { utilisateurId: req.user!.id } })
  if (!coach) {
    res.status(404).json({ success: false, message: 'Profil coach introuvable' })
    return
  }

  const cours = await prisma.cours.findUnique({ where: { id: coursId } })
  if (!cours) {
    res.status(404).json({ success: false, message: 'Cours introuvable' })
    return
  }
  if (cours.coachId !== coach.id) {
    res.status(403).json({ success: false, message: "Vous n'êtes pas le coach de ce cours" })
    return
  }

  const reservations = await prisma.reservation.findMany({
    where: { coursId, statut: { not: StatutReservation.ANNULE } },
    include: { utilisateur: { select: { nom: true, prenom: true, telephone: true } } }
  })

  const participants = reservations.map((r) => r.utilisateur)
  res.json({ success: true, message: `${participants.length} participant(s)`, data: participants })
}
