import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

export async function listCours(req: AuthRequest, res: Response) {
  const cours = await prisma.cours.findMany({
    include: { coach: { select: { nom: true, prenom: true } } },
    orderBy: { dateHeure: 'asc' }
  })
  res.json(cours)
}

export async function getCours(req: AuthRequest, res: Response) {
  const id = parseInt(req.params.id as string)
  const cours = await prisma.cours.findUnique({
    where: { id },
    include: {
      coach: { select: { nom: true, prenom: true } },
      reservations: {
        where: { statut: { not: 'ANNULE' } },
        include: { utilisateur: { select: { nom: true, prenom: true } } }
      }
    }
  })
  if (!cours) { res.status(404).json({ error: 'Cours introuvable' }); return }

  res.json({
    ...cours,
    participants: cours.reservations.map((r: { utilisateur: { nom: string; prenom: string } }) => r.utilisateur),
    nbParticipants: cours.reservations.length
  })
}

export async function reserver(req: AuthRequest, res: Response) {
  const coursId = parseInt(req.params.id as string)
  const utilisateurId = req.user!.id

  const cours = await prisma.cours.findUnique({
    where: { id: coursId },
    include: { reservations: { where: { statut: { not: 'ANNULE' } } } }
  })
  if (!cours) { res.status(404).json({ error: 'Cours introuvable' }); return }
  if (cours.reservations.length >= cours.placesMax) {
    res.status(409).json({ error: 'Cours complet' }); return
  }

  try {
    const resa = await prisma.reservation.create({ data: { utilisateurId, coursId } })
    res.status(201).json(resa)
  } catch {
    res.status(409).json({ error: 'Réservation déjà existante' })
  }
}
