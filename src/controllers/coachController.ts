import { Response } from 'express'
import { StatutReservation } from '@prisma/client'
import { z } from 'zod'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'
import { parseId, zodFail } from '../lib/validate'

const UpdateCoursSchema = z.object({
  dateHeure: z.string().datetime({ offset: true }).optional(),
  visible:   z.boolean().optional(),
})

export async function updateCours(req: AuthRequest, res: Response) {
  const coursId = parseId(req.params.id, res)
  if (coursId === null) return

  const parsed = UpdateCoursSchema.safeParse(req.body)
  if (!parsed.success) return zodFail(res, parsed.error)

  const coach = await prisma.coach.findUnique({ where: { utilisateurId: req.user!.id } })
  if (!coach) return res.status(404).json({ success: false, message: 'Profil coach introuvable.' })

  const cours = await prisma.cours.findUnique({ where: { id: coursId } })
  if (!cours) return res.status(404).json({ success: false, message: 'Cours introuvable.' })
  if (cours.coachId !== coach.id) return res.status(403).json({ success: false, message: 'Ce cours ne vous appartient pas.' })

  const data: { dateHeure?: Date; visible?: boolean } = {}
  if (parsed.data.dateHeure !== undefined) data.dateHeure = new Date(parsed.data.dateHeure)
  if (parsed.data.visible !== undefined) data.visible = parsed.data.visible

  const updated = await prisma.cours.update({ where: { id: coursId }, data })
  res.json({ success: true, message: 'Cours mis à jour.', data: updated })
}

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

export async function getMonScore(req: AuthRequest, res: Response) {
  const coach = await prisma.coach.findUnique({ where: { utilisateurId: req.user!.id } })
  if (!coach) { res.status(404).json({ success: false, message: 'Profil coach introuvable.' }); return }

  const agg = await prisma.noteCours.aggregate({
    where: { cours: { coachId: coach.id } },
    _avg: { note: true },
    _count: { note: true },
  })
  res.json({
    success: true,
    message: 'Score coach',
    data: { noteMoyenne: agg._avg.note, nbNotes: agg._count.note },
  })
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
