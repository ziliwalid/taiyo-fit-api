import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { Role, StatutReservation, StatutSeance } from '@prisma/client'
import prisma from '../lib/prisma'

export async function createCoach(req: Request, res: Response) {
  const { nom, prenom, email, password, telephone } = req.body
  if (!nom || !prenom || !email || !password) {
    res.status(400).json({ success: false, message: 'Champs requis manquants : nom, prenom, email, password' })
    return
  }

  const exists = await prisma.utilisateur.findUnique({ where: { email } })
  if (exists) {
    res.status(409).json({ success: false, message: 'Cette adresse email est déjà utilisée' })
    return
  }

  const hash = await bcrypt.hash(password, 10)

  const [user, coach] = await prisma.$transaction([
    prisma.utilisateur.create({
      data: { email, password: hash, nom, prenom, telephone, role: Role.COACH }
    }),
    prisma.coach.create({
      data: { nom, prenom }
    })
  ])

  await prisma.coach.update({
    where: { id: coach.id },
    data: { utilisateurId: user.id }
  })

  res.status(201).json({
    success: true,
    message: `Compte coach créé pour ${prenom} ${nom}. ID coach : ${coach.id}`,
    data: { userId: user.id, coachId: coach.id, email, nom, prenom }
  })
}

export async function getParticipants(req: Request, res: Response) {
  const coursId = parseInt(req.params.id as string)
  const reservations = await prisma.reservation.findMany({
    where: { coursId, statut: { not: StatutReservation.ANNULE } },
    include: { utilisateur: { select: { nom: true, prenom: true, telephone: true } } }
  })
  const participants = reservations.map((r: { utilisateur: { nom: string; prenom: string; telephone: string | null } }) => r.utilisateur)
  res.json({
    success: true,
    message: `${participants.length} participant(s) inscrit(s) à ce cours`,
    data: participants
  })
}

export async function updateReservation(req: Request, res: Response) {
  const id = parseInt(req.params.id as string)
  const { statut } = req.body

  if (!Object.values(StatutReservation).includes(statut)) {
    res.status(400).json({
      success: false,
      message: `Statut invalide. Valeurs acceptées : ${Object.values(StatutReservation).join(', ')}`
    })
    return
  }

  const resa = await prisma.reservation.update({ where: { id }, data: { statut } })

  const messages: Record<StatutReservation, string> = {
    [StatutReservation.CONFIRME]: 'Réservation confirmée — le paiement a bien été reçu.',
    [StatutReservation.ANNULE]: 'Réservation annulée.',
    [StatutReservation.EN_ATTENTE]: 'Réservation remise en attente.'
  }

  res.json({ success: true, message: messages[statut as StatutReservation], data: resa })
}

export async function createCours(req: Request, res: Response) {
  const { titre, dateHeure, dureeMinutes, placesMax, coachId, adresse, imageUrl } = req.body
  if (!titre || !dateHeure || !dureeMinutes || !placesMax || !coachId) {
    res.status(400).json({ success: false, message: 'Champs requis manquants : titre, dateHeure, dureeMinutes, placesMax, coachId' })
    return
  }
  const cours = await prisma.cours.create({
    data: { titre, dateHeure: new Date(dateHeure), dureeMinutes, placesMax, coachId, ...(adresse ? { adresse } : {}), ...(imageUrl ? { imageUrl } : {}) }
  })
  res.status(201).json({
    success: true,
    message: `Cours "${titre}" créé avec succès.`,
    data: cours
  })
}

export async function createPack(req: Request, res: Response) {
  const { nom, nbSessions, tarif, description, tag } = req.body
  if (!nom || !nbSessions) {
    res.status(400).json({ success: false, message: 'Champs requis manquants : nom, nbSessions' })
    return
  }
  const pack = await prisma.pack.create({
    data: {
      nom, nbSessions, description,
      ...(tarif != null && { tarif: parseFloat(tarif) }),
      ...(tag ? { tag } : {})
    }
  })
  res.status(201).json({
    success: true,
    message: `Pack "${nom}" créé avec succès.`,
    data: pack
  })
}

export async function updatePack(req: Request, res: Response) {
  const id = parseInt(req.params.id as string)
  const { tag } = req.body
  const pack = await prisma.pack.findUnique({ where: { id } })
  if (!pack) {
    res.status(404).json({ success: false, message: 'Pack introuvable' })
    return
  }
  const updated = await prisma.pack.update({
    where: { id },
    data: { tag: tag ?? null }
  })
  res.json({ success: true, message: 'Tag mis à jour.', data: updated })
}

export async function listPacks(req: Request, res: Response) {
  const packs = await prisma.pack.findMany({ orderBy: { id: 'asc' } })
  res.json({ success: true, message: `${packs.length} pack(s)`, data: packs })
}

export async function listCoaches(req: Request, res: Response) {
  const coaches = await prisma.coach.findMany({
    select: { id: true, nom: true, prenom: true },
    orderBy: { prenom: 'asc' }
  })
  res.json({ success: true, message: `${coaches.length} coach(s)`, data: coaches })
}

export async function updateStatutSeance(req: Request, res: Response) {
  const id = parseInt(req.params.id as string)
  const { statutSeance, messageCoach } = req.body

  if (statutSeance && !Object.values(StatutSeance).includes(statutSeance)) {
    res.status(400).json({
      success: false,
      message: `Statut invalide. Valeurs acceptées : ${Object.values(StatutSeance).join(', ')}`
    })
    return
  }

  const cours = await prisma.cours.findUnique({ where: { id } })
  if (!cours) {
    res.status(404).json({ success: false, message: 'Cours introuvable' })
    return
  }

  const { adresse, imageUrl } = req.body
  const updated = await prisma.cours.update({
    where: { id },
    data: {
      ...(statutSeance && { statutSeance }),
      ...(messageCoach !== undefined && { messageCoach }),
      ...(adresse !== undefined && { adresse: adresse || null }),
      ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
    }
  })

  const labels: Record<StatutSeance, string> = {
    [StatutSeance.PLANIFIE]: 'Séance planifiée normalement.',
    [StatutSeance.EN_RETARD]: 'Séance signalée en retard.',
    [StatutSeance.LIEU_MODIFIE]: 'Changement de lieu signalé.',
    [StatutSeance.ANNULE]: 'Séance annulée.'
  }

  res.json({
    success: true,
    message: statutSeance ? labels[statutSeance as StatutSeance] : 'Message mis à jour.',
    data: updated
  })
}

export async function assignPack(req: Request, res: Response) {
  const { utilisateurId, packId } = req.body
  const pack = await prisma.pack.findUnique({ where: { id: packId } })
  if (!pack) {
    res.status(404).json({ success: false, message: 'Pack introuvable' })
    return
  }
  const user = await prisma.utilisateur.findUnique({ where: { id: utilisateurId } })
  if (!user) {
    res.status(404).json({ success: false, message: 'Adhérent introuvable' })
    return
  }

  const compte = await prisma.comptePack.upsert({
    where: { utilisateurId },
    update: { packId, sessionsRestantes: pack.nbSessions },
    create: { utilisateurId, packId, sessionsRestantes: pack.nbSessions }
  })
  res.status(201).json({
    success: true,
    message: `Pack "${pack.nom}" assigné à ${user.prenom} ${user.nom} — ${pack.nbSessions} sessions disponibles.`,
    data: compte
  })
}
