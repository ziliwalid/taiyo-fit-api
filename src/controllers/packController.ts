import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { StatutReservation, StatutSeance } from '@prisma/client'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

const COOLDOWN_MS = 48 * 60 * 60 * 1000

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function getProfil(req: AuthRequest, res: Response) {
  const user = await prisma.utilisateur.findUnique({
    where: { id: req.user!.id },
    select: { nom: true, prenom: true, email: true, telephone: true, derniereMiseAJourProfil: true },
  })
  res.json({ success: true, message: 'Profil', data: user })
}

export async function updateProfil(req: AuthRequest, res: Response) {
  const { nom, prenom, email, telephone, currentPassword, newPassword } = req.body

  const user = await prisma.utilisateur.findUnique({ where: { id: req.user!.id } })
  if (!user) {
    res.status(404).json({ success: false, message: 'Utilisateur introuvable.' })
    return
  }

  if (user.derniereMiseAJourProfil) {
    const elapsed = Date.now() - user.derniereMiseAJourProfil.getTime()
    if (elapsed < COOLDOWN_MS) {
      const prochainDispo = new Date(user.derniereMiseAJourProfil.getTime() + COOLDOWN_MS)
      res.status(429).json({
        success: false,
        message: 'Modification non autorisée.',
        data: { prochainDispo: prochainDispo.toISOString() },
      })
      return
    }
  }

  const data: {
    nom?: string; prenom?: string; email?: string; telephone?: string | null;
    password?: string; derniereMiseAJourProfil: Date
  } = { derniereMiseAJourProfil: new Date() }

  if (nom !== undefined) {
    if (!nom.trim()) { res.status(400).json({ success: false, message: 'Le prénom ne peut pas être vide.' }); return }
    data.nom = nom.trim()
  }
  if (prenom !== undefined) {
    if (!prenom.trim()) { res.status(400).json({ success: false, message: 'Le prénom ne peut pas être vide.' }); return }
    data.prenom = prenom.trim()
  }
  if (email !== undefined) {
    if (!EMAIL_RE.test(email)) { res.status(400).json({ success: false, message: 'Adresse email invalide.' }); return }
    const existing = await prisma.utilisateur.findUnique({ where: { email } })
    if (existing && existing.id !== user.id) {
      res.status(409).json({ success: false, message: 'Cette adresse email est déjà utilisée.' })
      return
    }
    data.email = email
  }
  if (telephone !== undefined) {
    data.telephone = telephone || null
  }

  if (newPassword !== undefined) {
    if (!currentPassword) {
      res.status(400).json({ success: false, message: 'Le mot de passe actuel est requis.' })
      return
    }
    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) {
      res.status(400).json({ success: false, message: 'Mot de passe actuel incorrect.' })
      return
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' })
      return
    }
    data.password = await bcrypt.hash(newPassword, 10)
  }

  await prisma.utilisateur.update({ where: { id: req.user!.id }, data })
  res.json({ success: true, message: 'Profil mis à jour.', data: null })
}

export async function listPacks(_req: Request, res: Response) {
  const packs = await prisma.pack.findMany({ where: { actif: true }, orderBy: { id: 'asc' } })
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
    message: `Pack actif — il vous reste ${compte.sessionsRestantes} session(s)`,
    data: compte
  })
}

export async function getMonDashboard(req: AuthRequest, res: Response) {
  const userId = req.user!.id

  const [comptePack, reservations, seancesEffectuees, recentes, notes] = await Promise.all([
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

    // Last 5 EFFECTUE sessions for rating
    prisma.reservation.findMany({
      where: {
        utilisateurId: userId,
        statut: { not: StatutReservation.ANNULE },
        cours: { statutSeance: StatutSeance.EFFECTUE },
      },
      include: {
        cours: {
          select: {
            id: true, titre: true, dateHeure: true, dureeMinutes: true, genre: true,
            coach: { select: { nom: true, prenom: true } },
          },
        },
      },
      orderBy: { cours: { dateHeure: 'desc' } },
      take: 5,
    }),

    // User's existing notes
    prisma.noteCours.findMany({
      where: { utilisateurId: userId },
      select: { coursId: true, note: true },
    }),
  ])

  const notesMap = new Map(notes.map((n) => [n.coursId, n.note]))

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
      recentes: recentes.map((r) => ({
        reservationId: r.id,
        cours: r.cours,
        maNote: notesMap.get(r.coursId) ?? null,
      })),
      stats: {
        seancesEffectuees,
        reservationsAVenir: reservations.length,
      },
    },
  })
}

export async function getHistoriqueSessions(req: AuthRequest, res: Response) {
  const userId = req.user!.id
  const historique = await prisma.historiqueSession.findMany({
    where: { utilisateurId: userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, variation: true, motif: true, createdAt: true },
  })
  res.json({ success: true, message: 'OK', data: historique })
}
