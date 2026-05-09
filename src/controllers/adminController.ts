import { Request, Response } from 'express'
import prisma from '../lib/prisma'

export async function getParticipants(req: Request, res: Response) {
  const coursId = parseInt(req.params.id as string)
  const reservations = await prisma.reservation.findMany({
    where: { coursId, statut: { not: 'ANNULE' } },
    include: { utilisateur: { select: { nom: true, prenom: true, telephone: true } } }
  })
  res.json(reservations.map((r: { utilisateur: { nom: string; prenom: string; telephone: string | null } }) => r.utilisateur))
}

export async function updateReservation(req: Request, res: Response) {
  const id = parseInt(req.params.id as string)
  const { statut } = req.body
  if (!['EN_ATTENTE', 'CONFIRME', 'ANNULE'].includes(statut)) {
    res.status(400).json({ error: 'Statut invalide' }); return
  }
  const resa = await prisma.reservation.update({ where: { id }, data: { statut } })
  res.json(resa)
}

export async function createCours(req: Request, res: Response) {
  const { titre, dateHeure, dureeMinutes, placesMax, coachId } = req.body
  if (!titre || !dateHeure || !dureeMinutes || !placesMax || !coachId) {
    res.status(400).json({ error: 'Champs requis manquants' }); return
  }
  const cours = await prisma.cours.create({
    data: { titre, dateHeure: new Date(dateHeure), dureeMinutes, placesMax, coachId }
  })
  res.status(201).json(cours)
}

export async function createPack(req: Request, res: Response) {
  const { nom, nbSessions, description } = req.body
  if (!nom || !nbSessions) {
    res.status(400).json({ error: 'Champs requis manquants' }); return
  }
  const pack = await prisma.pack.create({ data: { nom, nbSessions, description } })
  res.status(201).json(pack)
}

export async function assignPack(req: Request, res: Response) {
  const { utilisateurId, packId } = req.body
  const pack = await prisma.pack.findUnique({ where: { id: packId } })
  if (!pack) { res.status(404).json({ error: 'Pack introuvable' }); return }

  const compte = await prisma.comptePack.upsert({
    where: { utilisateurId },
    update: { packId, sessionsRestantes: pack.nbSessions },
    create: { utilisateurId, packId, sessionsRestantes: pack.nbSessions }
  })
  res.status(201).json(compte)
}
