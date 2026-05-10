import { Response } from 'express'
import { StatutReservation } from '@prisma/client'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

export async function listCours(req: AuthRequest, res: Response) {
  const cours = await prisma.cours.findMany({
    include: { coach: { select: { nom: true, prenom: true } } },
    orderBy: { dateHeure: 'asc' }
  })
  res.json({
    success: true,
    message: `${cours.length} cours disponible(s)`,
    data: cours
  })
}

export async function getCours(req: AuthRequest, res: Response) {
  const id = parseInt(req.params.id as string)
  const cours = await prisma.cours.findUnique({
    where: { id },
    include: {
      coach: { select: { nom: true, prenom: true } },
      reservations: {
        where: { statut: { not: StatutReservation.ANNULE } },
        include: { utilisateur: { select: { nom: true, prenom: true } } }
      }
    }
  })
  if (!cours) {
    res.status(404).json({ success: false, message: 'Ce cours est introuvable' })
    return
  }

  const participants = cours.reservations.map((r: { utilisateur: { nom: string; prenom: string } }) => r.utilisateur)
  const placesRestantes = cours.placesMax - participants.length

  res.json({
    success: true,
    message: placesRestantes > 0
      ? `${placesRestantes} place(s) restante(s) sur ${cours.placesMax}`
      : 'Ce cours est complet',
    data: { ...cours, participants, nbParticipants: participants.length, placesRestantes }
  })
}

export async function reserver(req: AuthRequest, res: Response) {
  const coursId = parseInt(req.params.id as string)
  const utilisateurId = req.user!.id

  const cours = await prisma.cours.findUnique({
    where: { id: coursId },
    include: { reservations: { where: { statut: { not: StatutReservation.ANNULE } } } }
  })
  if (!cours) {
    res.status(404).json({ success: false, message: 'Ce cours est introuvable' })
    return
  }
  if (cours.reservations.length >= cours.placesMax) {
    res.status(409).json({ success: false, message: 'Ce cours est complet, aucune place disponible' })
    return
  }

  // Vérifier que l'adhérent a un pack actif avec des sessions disponibles
  const comptePack = await prisma.comptePack.findUnique({ where: { utilisateurId } })
  if (!comptePack || comptePack.sessionsRestantes <= 0) {
    res.status(403).json({
      success: false,
      message: "Tu dois avoir un pack actif avec des sessions disponibles pour réserver un cours. Contacte Malak pour obtenir un pack."
    })
    return
  }

  try {
    // Créer la réservation ET décrémenter la session du pack en une seule transaction
    const [resa] = await prisma.$transaction([
      prisma.reservation.create({ data: { utilisateurId, coursId } }),
      prisma.comptePack.update({
        where: { utilisateurId },
        data: { sessionsRestantes: { decrement: 1 } }
      })
    ])
    res.status(201).json({
      success: true,
      message: `Réservation pour "${cours.titre}" confirmée ! Il te reste ${comptePack.sessionsRestantes - 1} session(s) dans ton pack.`,
      data: resa
    })
  } catch {
    res.status(409).json({ success: false, message: 'Vous êtes déjà inscrit à ce cours' })
  }
}
