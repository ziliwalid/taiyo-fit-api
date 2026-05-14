import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { Role, StatutReservation, StatutSeance, StatutPaiement, StatutDemande } from '@prisma/client'
import prisma from '../lib/prisma'
import { sendSeanceAnnuleeToMembre } from '../services/mailer'

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
  if (new Date(dateHeure) <= new Date()) {
    res.status(400).json({ success: false, message: 'La date du cours doit être dans le futur.' })
    return
  }
  const cours = await prisma.cours.create({
    data: { titre, dateHeure: new Date(dateHeure), dureeMinutes, placesMax, coachId, ...(adresse ? { adresse } : {}), ...(imageUrl ? { imageUrl } : {}) },
    include: {
      coach: { select: { nom: true, prenom: true } },
      _count: { select: { reservations: { where: { statut: { not: StatutReservation.ANNULE } } } } },
    },
  })
  res.status(201).json({
    success: true,
    message: `Cours "${titre}" créé avec succès.`,
    data: cours
  })
}

export async function createPack(req: Request, res: Response) {
  const { nom, nbSessions, tarif, ancienTarif, description, tag } = req.body
  if (!nom || !nbSessions) {
    res.status(400).json({ success: false, message: 'Champs requis manquants : nom, nbSessions' })
    return
  }
  const pack = await prisma.pack.create({
    data: {
      nom, nbSessions, description,
      ...(tarif != null && { tarif: parseFloat(tarif) }),
      ...(ancienTarif != null && { ancienTarif: parseFloat(ancienTarif) }),
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
  const { tag, nom, nbSessions, tarif, ancienTarif, description } = req.body
  const pack = await prisma.pack.findUnique({ where: { id } })
  if (!pack) {
    res.status(404).json({ success: false, message: 'Pack introuvable' })
    return
  }
  const updated = await prisma.pack.update({
    where: { id },
    data: {
      ...(tag !== undefined && { tag: tag || null }),
      ...(nom && { nom }),
      ...(nbSessions != null && { nbSessions: parseInt(nbSessions) }),
      ...(tarif !== undefined && { tarif: tarif !== '' && tarif != null ? parseFloat(tarif) : null }),
      ...(ancienTarif !== undefined && { ancienTarif: ancienTarif !== '' && ancienTarif != null ? parseFloat(ancienTarif) : null }),
      ...(description !== undefined && { description: description || null }),
    }
  })
  res.json({ success: true, message: 'Pack mis à jour.', data: updated })
}

export async function deletePack(req: Request, res: Response) {
  const id = parseInt(req.params.id as string)
  const pack = await prisma.pack.findUnique({ where: { id } })
  if (!pack) {
    res.status(404).json({ success: false, message: 'Pack introuvable' })
    return
  }

  const nbPaiements = await prisma.paiement.count({ where: { packId: id } })
  if (nbPaiements > 0) {
    res.status(409).json({
      success: false,
      message: `Impossible de supprimer "${pack.nom}" — ${nbPaiements} paiement(s) Stripe sont liés à ce pack (y compris les sessions en attente).`,
    })
    return
  }

  try {
    await prisma.$transaction([
      prisma.demandePack.deleteMany({ where: { packId: id } }),
      prisma.comptePack.updateMany({ where: { packId: id }, data: { packId: null } }),
      prisma.pack.delete({ where: { id } }),
    ])
  } catch {
    res.status(409).json({
      success: false,
      message: `Impossible de supprimer "${pack.nom}" — des données liées existent encore en base.`,
    })
    return
  }

  res.json({ success: true, message: `Pack "${pack.nom}" supprimé.`, data: null })
}

export async function listPacks(req: Request, res: Response) {
  const packs = await prisma.pack.findMany({ where: { actif: true }, orderBy: { id: 'asc' } })
  res.json({ success: true, message: `${packs.length} pack(s)`, data: packs })
}

export async function adminListPacks(req: Request, res: Response) {
  const packs = await prisma.pack.findMany({ orderBy: { id: 'asc' } })
  res.json({ success: true, message: `${packs.length} pack(s)`, data: packs })
}

export async function togglePackActif(req: Request, res: Response) {
  const id = parseInt(req.params.id as string)
  const pack = await prisma.pack.findUnique({ where: { id } })
  if (!pack) {
    res.status(404).json({ success: false, message: 'Pack introuvable' })
    return
  }
  const updated = await prisma.pack.update({ where: { id }, data: { actif: !pack.actif } })
  res.json({
    success: true,
    message: `Pack "${pack.nom}" ${updated.actif ? 'réactivé' : 'désactivé'}.`,
    data: updated,
  })
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

  if (cours.statutSeance === StatutSeance.ANNULE) {
    res.status(409).json({ success: false, message: 'Ce cours est annulé et ne peut plus être modifié.' })
    return
  }
  if (cours.statutSeance === StatutSeance.EFFECTUE) {
    res.status(409).json({ success: false, message: 'Ce cours a déjà été effectué et ne peut plus être modifié.' })
    return
  }

  const { adresse, imageUrl } = req.body
  const isNewlyCancelled = statutSeance === StatutSeance.ANNULE

  // ── Cancellation: refund sessions + cancel reservations atomically ────────
  let notifyList: { prenom: string; email: string; sessionsRestantes: number }[] = []

  if (isNewlyCancelled) {
    const reservations = await prisma.reservation.findMany({
      where: { coursId: id, statut: { not: StatutReservation.ANNULE } },
      include: { utilisateur: { select: { prenom: true, email: true } } },
    })

    if (reservations.length > 0) {
      const utilisateurIds = reservations.map(r => r.utilisateurId)

      await prisma.$transaction([
        // Cancel all active reservations
        prisma.reservation.updateMany({
          where: { coursId: id, statut: { not: StatutReservation.ANNULE } },
          data: { statut: StatutReservation.ANNULE },
        }),
        // Refund 1 session to each member who had an active reservation
        ...utilisateurIds.map(uid =>
          prisma.comptePack.updateMany({
            where: { utilisateurId: uid, sessionsRestantes: { gte: 0 } },
            data: { sessionsRestantes: { increment: 1 } },
          })
        ),
      ])

      // Fetch updated session counts for email notifications
      const comptes = await prisma.comptePack.findMany({
        where: { utilisateurId: { in: utilisateurIds } },
        select: { utilisateurId: true, sessionsRestantes: true },
      })
      const comptesMap = new Map(comptes.map(c => [c.utilisateurId, c.sessionsRestantes]))

      notifyList = reservations
        .filter(r => comptesMap.has(r.utilisateurId))
        .map(r => ({
          prenom:            r.utilisateur.prenom,
          email:             r.utilisateur.email,
          sessionsRestantes: comptesMap.get(r.utilisateurId)!,
        }))
    }
  }

  const updated = await prisma.cours.update({
    where: { id },
    data: {
      ...(statutSeance && { statutSeance }),
      ...(messageCoach !== undefined && { messageCoach }),
      ...(adresse !== undefined && { adresse: adresse || null }),
      ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
    }
  })

  // Fire-and-forget emails
  if (isNewlyCancelled && notifyList.length > 0) {
    const dateStr = new Date(cours.dateHeure).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    })
    notifyList.forEach(({ prenom, email, sessionsRestantes }) => {
      sendSeanceAnnuleeToMembre({
        membrePrenom: prenom,
        membreEmail:  email,
        coursTitre:   cours.titre,
        coursDate:    dateStr,
        sessionsRendues: 1,
        sessionsRestantes,
      }).catch(() => {})
    })
  }

  const labels: Record<StatutSeance, string> = {
    [StatutSeance.PLANIFIE]:     'Séance planifiée normalement.',
    [StatutSeance.EN_RETARD]:    'Séance signalée en retard.',
    [StatutSeance.LIEU_MODIFIE]: 'Changement de lieu signalé.',
    [StatutSeance.ANNULE]:       `Séance annulée — ${notifyList.length} adhérent(s) remboursé(s) et notifié(s).`,
    [StatutSeance.EFFECTUE]:     'Séance marquée comme effectuée.',
  }

  res.json({
    success: true,
    message: statutSeance ? labels[statutSeance as StatutSeance] : 'Message mis à jour.',
    data: updated
  })
}

export async function listMembres(req: Request, res: Response) {
  const membres = await prisma.utilisateur.findMany({
    where: { role: Role.ADHERENT },
    select: {
      id: true, nom: true, prenom: true, email: true, telephone: true,
      actif: true, createdAt: true,
      comptePack: { select: { sessionsRestantes: true, pack: { select: { nom: true } } } }
    },
    orderBy: { createdAt: 'desc' }
  })
  res.json({ success: true, message: `${membres.length} adhérent(s)`, data: membres })
}

export async function listCoachesDetailed(req: Request, res: Response) {
  const coachs = await prisma.utilisateur.findMany({
    where: { role: Role.COACH },
    select: {
      id: true, nom: true, prenom: true, email: true, telephone: true,
      actif: true, createdAt: true,
      coach: { select: { id: true, cours: { select: { id: true } } } }
    },
    orderBy: { prenom: 'asc' }
  })
  res.json({ success: true, message: `${coachs.length} coach(s)`, data: coachs })
}

export async function toggleActif(req: Request, res: Response) {
  const id = parseInt(req.params.id as string)
  const user = await prisma.utilisateur.findUnique({ where: { id } })
  if (!user) {
    res.status(404).json({ success: false, message: 'Utilisateur introuvable' })
    return
  }
  if (user.role === Role.ADMIN) {
    res.status(403).json({ success: false, message: 'Impossible de bloquer un admin' })
    return
  }
  const updated = await prisma.utilisateur.update({
    where: { id },
    data: { actif: !user.actif }
  })
  res.json({
    success: true,
    message: updated.actif ? `${user.prenom} ${user.nom} débloqué(e).` : `${user.prenom} ${user.nom} bloqué(e).`,
    data: { id: updated.id, actif: updated.actif }
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

export async function listTransactions(req: Request, res: Response) {
  const { statut, from, to } = req.query

  const where: {
    statut?: StatutPaiement
    createdAt?: { gte?: Date; lte?: Date }
  } = {}

  if (statut && Object.values(StatutPaiement).includes(statut as StatutPaiement)) {
    where.statut = statut as StatutPaiement
  }
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from as string)
    if (to) {
      const toDate = new Date(to as string)
      toDate.setHours(23, 59, 59, 999)
      where.createdAt.lte = toDate
    }
  }

  const transactions = await prisma.paiement.findMany({
    where,
    include: {
      utilisateur: { select: { nom: true, prenom: true, email: true } },
      pack: { select: { nom: true, nbSessions: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  res.json({
    success: true,
    message: `${transactions.length} transaction(s)`,
    data: transactions,
  })
}

export async function getStats(req: Request, res: Response) {
  const { from, to } = req.query

  const revenueWhere: { statut: StatutPaiement; createdAt?: { gte?: Date; lte?: Date } } = {
    statut: StatutPaiement.REUSSI,
  }
  if (from || to) {
    revenueWhere.createdAt = {}
    if (from) revenueWhere.createdAt.gte = new Date(from as string)
    if (to) {
      const toDate = new Date(to as string)
      toDate.setHours(23, 59, 59, 999)
      revenueWhere.createdAt.lte = toDate
    }
  }

  const [
    paiementsReussis,
    totalAdherents,
    adherentsActifs,
    adherentsSansPack,
    demandesEnAttente,
    totalSeances,
    seancesEffectuees,
  ] = await Promise.all([
    prisma.paiement.findMany({
      where: revenueWhere,
      select: { montant: true },
    }),
    prisma.utilisateur.count({ where: { role: Role.ADHERENT } }),
    prisma.utilisateur.count({ where: { role: Role.ADHERENT, actif: true } }),
    prisma.utilisateur.count({
      where: {
        role: Role.ADHERENT,
        OR: [
          { comptePack: { is: null } },
          { comptePack: { sessionsRestantes: 0 } },
        ],
      },
    }),
    prisma.demandePack.count({ where: { statut: StatutDemande.EN_ATTENTE } }),
    prisma.cours.count(),
    prisma.cours.count({ where: { statutSeance: StatutSeance.EFFECTUE } }),
  ])

  const totalBrut = paiementsReussis.reduce((sum, p) => sum + p.montant, 0)
  const nbPaiements = paiementsReussis.length
  // Estimation frais Stripe : 1.5 % + 0.25 € / transaction (tarif EU standard)
  const stripeFees = Math.round((totalBrut * 0.015 + nbPaiements * 0.25) * 100) / 100
  const totalNet = Math.round((totalBrut - stripeFees) * 100) / 100

  res.json({
    success: true,
    message: 'Statistiques plateforme',
    data: {
      revenus: {
        brut: Math.round(totalBrut * 100) / 100,
        net: totalNet,
        stripeFees,
        nbPaiements,
      },
      adherents: {
        total: totalAdherents,
        actifs: adherentsActifs,
        bloques: totalAdherents - adherentsActifs,
        sansPack: adherentsSansPack,
      },
      seances: {
        total: totalSeances,
        aVenir: totalSeances - seancesEffectuees,
        effectuees: seancesEffectuees,
      },
      demandes: {
        enAttente: demandesEnAttente,
      },
    },
  })
}

export async function listNotifications(_req: Request, res: Response) {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  res.json({ success: true, message: 'OK', data: notifications })
}

export async function marquerNotificationsLues(_req: Request, res: Response) {
  await prisma.notification.updateMany({ where: { lu: false }, data: { lu: true } })
  res.json({ success: true, message: 'Notifications marquées comme lues.', data: null })
}
