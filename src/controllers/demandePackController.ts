import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'
import { sendDemandePackToAdmin, sendDemandeConfirmationToMembre, sendValidationConfirmationToMembre } from '../services/mailer'

export async function demanderPack(req: AuthRequest, res: Response) {
  const { packId } = req.body
  if (!packId) {
    res.status(400).json({ success: false, message: 'packId est requis' })
    return
  }

  const pack = await prisma.pack.findUnique({ where: { id: packId } })
  if (!pack) {
    res.status(404).json({ success: false, message: 'Pack introuvable' })
    return
  }

  const user = await prisma.utilisateur.findUnique({ where: { id: req.user!.id } })
  if (!user) {
    res.status(404).json({ success: false, message: 'Utilisateur introuvable' })
    return
  }

  const demande = await prisma.demandePack.create({
    data: { utilisateurId: user.id, packId: pack.id }
  })

  const emailData = {
    membrePrenom: user.prenom,
    membreNom: user.nom,
    membreEmail: user.email,
    membreTelephone: user.telephone,
    packNom: pack.nom,
    packNbSessions: pack.nbSessions,
    packDescription: pack.description
  }

  await Promise.all([
    sendDemandePackToAdmin(emailData),
    sendDemandeConfirmationToMembre(emailData)
  ])

  res.status(201).json({
    success: true,
    message: `Ta demande pour le "${pack.nom}" a été envoyée à Malak. Tu recevras un email de confirmation dès validation.`,
    data: demande
  })
}

export async function validerDemande(req: AuthRequest, res: Response) {
  const id = parseInt(req.params.id as string)

  const demande = await prisma.demandePack.findUnique({
    where: { id },
    include: {
      utilisateur: true,
      pack: true
    }
  })
  if (!demande) {
    res.status(404).json({ success: false, message: 'Demande introuvable' })
    return
  }
  if (demande.statut !== 'EN_ATTENTE') {
    res.status(409).json({ success: false, message: `Cette demande est déjà ${demande.statut.toLowerCase()}` })
    return
  }

  const [updatedDemande, compte] = await prisma.$transaction([
    prisma.demandePack.update({ where: { id }, data: { statut: 'VALIDE' } }),
    prisma.comptePack.upsert({
      where: { utilisateurId: demande.utilisateurId },
      update: { packId: demande.packId, sessionsRestantes: demande.pack.nbSessions },
      create: { utilisateurId: demande.utilisateurId, packId: demande.packId, sessionsRestantes: demande.pack.nbSessions }
    })
  ])

  await sendValidationConfirmationToMembre({
    membrePrenom: demande.utilisateur.prenom,
    membreNom: demande.utilisateur.nom,
    membreEmail: demande.utilisateur.email,
    membreTelephone: demande.utilisateur.telephone,
    packNom: demande.pack.nom,
    packNbSessions: demande.pack.nbSessions,
    packDescription: demande.pack.description
  })

  res.json({
    success: true,
    message: `Demande validée — pack "${demande.pack.nom}" activé pour ${demande.utilisateur.prenom} ${demande.utilisateur.nom}.`,
    data: { demande: updatedDemande, compte }
  })
}

export async function refuserDemande(req: AuthRequest, res: Response) {
  const id = parseInt(req.params.id as string)

  const demande = await prisma.demandePack.findUnique({
    where: { id },
    include: { utilisateur: true, pack: true }
  })
  if (!demande) {
    res.status(404).json({ success: false, message: 'Demande introuvable' })
    return
  }
  if (demande.statut !== 'EN_ATTENTE') {
    res.status(409).json({ success: false, message: `Cette demande est déjà ${demande.statut.toLowerCase()}` })
    return
  }

  const updated = await prisma.demandePack.update({ where: { id }, data: { statut: 'REFUSE' } })

  res.json({
    success: true,
    message: `Demande refusée pour ${demande.utilisateur.prenom} ${demande.utilisateur.nom}.`,
    data: updated
  })
}

export async function listDemandes(req: AuthRequest, res: Response) {
  const demandes = await prisma.demandePack.findMany({
    include: {
      utilisateur: { select: { nom: true, prenom: true, email: true, telephone: true } },
      pack: true
    },
    orderBy: { createdAt: 'desc' }
  })
  res.json({
    success: true,
    message: `${demandes.length} demande(s) de pack`,
    data: demandes
  })
}
