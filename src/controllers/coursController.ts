import { Response } from 'express'
import { StatutReservation, StatutSeance } from '@prisma/client'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'
import { logSession } from '../lib/logSession'
import { parseId } from '../lib/validate'

export async function noterCours(req: AuthRequest, res: Response) {
  const coursId = parseId(req.params.id, res)
  if (coursId === null) return
  const utilisateurId = req.user!.id
  const note = Number(req.body.note)

  if (!note || ![1, 2, 3].includes(note)) {
    res.status(400).json({ success: false, message: 'La note doit être 1, 2 ou 3 soleils.' })
    return
  }

  // Une seule requête : cours + réservation de l'utilisateur
  const cours = await prisma.cours.findUnique({
    where: { id: coursId },
    include: {
      reservations: {
        where: { utilisateurId, statut: { not: StatutReservation.ANNULE } },
        select: { id: true },
        take: 1,
      },
    },
  })

  if (!cours) { res.status(404).json({ success: false, message: 'Cours introuvable.' }); return }
  if (cours.statutSeance !== StatutSeance.EFFECTUE) {
    res.status(409).json({ success: false, message: 'Ce cours n\'est pas encore effectué.' })
    return
  }
  if (cours.reservations.length === 0) {
    res.status(403).json({ success: false, message: 'Tu dois avoir participé à ce cours pour le noter.' })
    return
  }

  const result = await prisma.noteCours.upsert({
    where: { utilisateurId_coursId: { utilisateurId, coursId } },
    create: { utilisateurId, coursId, note },
    update: { note },
  })

  res.json({ success: true, message: 'Merci pour ton avis ☀️', data: { note: result.note } })
}

const CANCELLATION_HOURS = 48

async function marquerSeancesEffectuees() {
  await prisma.cours.updateMany({
    where: {
      dateHeure: { lt: new Date() },
      statutSeance: { notIn: [StatutSeance.ANNULE, StatutSeance.EFFECTUE] }
    },
    data: { statutSeance: StatutSeance.EFFECTUE }
  })
}

export async function listCours(req: AuthRequest, res: Response) {
  await marquerSeancesEffectuees()
  const cours = await prisma.cours.findMany({
    include: {
      coach: { select: { nom: true, prenom: true } },
      _count: { select: { reservations: { where: { statut: { not: StatutReservation.ANNULE } } } } },
    },
    orderBy: { dateHeure: 'asc' }
  })
  const data = cours.map(({ _count, ...c }) => ({
    ...c,
    nbParticipants: _count.reservations,
    placesRestantes: c.placesMax - _count.reservations,
  }))
  res.json({
    success: true,
    message: `${data.length} cours disponible(s)`,
    data,
  })
}

export async function getCours(req: AuthRequest, res: Response) {
  const id = parseId(req.params.id, res)
  if (id === null) return
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
  const coursId = parseId(req.params.id, res)
  if (coursId === null) return
  const utilisateurId = req.user!.id

  const cours = await prisma.cours.findUnique({
    where: { id: coursId },
    include: { reservations: { where: { statut: { not: StatutReservation.ANNULE } } } }
  })
  if (!cours) {
    res.status(404).json({ success: false, message: 'Ce cours est introuvable' })
    return
  }
  if (cours.statutSeance === StatutSeance.EFFECTUE || new Date(cours.dateHeure) < new Date()) {
    res.status(409).json({ success: false, message: 'Cette séance est déjà effectuée, elle n\'est plus réservable' })
    return
  }
  if (cours.statutSeance === StatutSeance.ANNULE) {
    res.status(409).json({ success: false, message: 'Cette séance est annulée, elle n\'est plus réservable' })
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
    logSession(utilisateurId, -1, `Réservation · ${cours.titre}`, coursId)
    res.status(201).json({
      success: true,
      message: `Réservation pour "${cours.titre}" confirmée ! Il te reste ${comptePack.sessionsRestantes - 1} session(s) dans ton pack.`,
      data: resa
    })
  } catch {
    res.status(409).json({ success: false, message: 'Vous êtes déjà inscrit à ce cours' })
  }
}

export async function annulerReservation(req: AuthRequest, res: Response) {
  const coursId = parseId(req.params.id, res)
  if (coursId === null) return
  const utilisateurId = req.user!.id

  const reservation = await prisma.reservation.findUnique({
    where: { utilisateurId_coursId: { utilisateurId, coursId } },
    include: { cours: true },
  })

  if (!reservation || reservation.statut === StatutReservation.ANNULE) {
    res.status(404).json({ success: false, message: 'Réservation introuvable.' })
    return
  }

  const heuresAvant = (new Date(reservation.cours.dateHeure).getTime() - Date.now()) / 3_600_000
  if (heuresAvant < CANCELLATION_HOURS) {
    res.status(409).json({
      success: false,
      message: `L'annulation n'est plus possible : la séance a lieu dans moins de ${CANCELLATION_HOURS}h.`,
    })
    return
  }

  if (reservation.cours.statutSeance === StatutSeance.ANNULE || reservation.cours.statutSeance === StatutSeance.EFFECTUE) {
    res.status(409).json({ success: false, message: 'Cette séance ne peut plus être annulée.' })
    return
  }

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: utilisateurId },
    select: { prenom: true, nom: true, email: true },
  })

  await prisma.$transaction([
    prisma.reservation.update({
      where: { utilisateurId_coursId: { utilisateurId, coursId } },
      data: { statut: StatutReservation.ANNULE },
    }),
    prisma.comptePack.updateMany({
      where: { utilisateurId, sessionsRestantes: { gte: 0 } },
      data: { sessionsRestantes: { increment: 1 } },
    }),
  ])

  logSession(utilisateurId, +1, `Annulation (adhérent) · ${reservation.cours.titre}`, coursId)

  if (utilisateur) {
    const dateStr = new Date(reservation.cours.dateHeure).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    })
    prisma.notification.create({
      data: {
        message: `${utilisateur.prenom} ${utilisateur.nom} a annulé sa réservation pour "${reservation.cours.titre}" du ${dateStr}.`,
      },
    }).catch(() => {})
  }

  res.json({ success: true, message: 'Réservation annulée et session remboursée sur ton pack.', data: null })
}
