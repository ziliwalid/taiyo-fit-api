import { Request, Response } from 'express'
import prisma from '../lib/prisma'

export async function listAvisAdmin(_req: Request, res: Response) {
  const [avis, settings] = await Promise.all([
    prisma.noteCours.findMany({
      select: {
        id: true,
        note: true,
        commentaire: true,
        createdAt: true,
        utilisateur: { select: { id: true, prenom: true, nom: true, email: true } },
        cours: { select: { id: true, titre: true, genre: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.siteSettings.upsert({ where: { id: 1 }, create: {}, update: {} }),
  ])
  res.json({ success: true, data: { afficherAvis: settings.afficherAvis, avis } })
}

export async function deleteAvis(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) { res.status(400).json({ success: false, message: 'ID invalide.' }); return }
  const avis = await prisma.noteCours.findUnique({ where: { id } })
  if (!avis) { res.status(404).json({ success: false, message: 'Avis introuvable.' }); return }
  await prisma.noteCours.delete({ where: { id } })
  res.json({ success: true, message: 'Avis supprimé.' })
}

export async function listAvisPublic(_req: Request, res: Response) {
  const [avis, settings] = await Promise.all([
    prisma.noteCours.findMany({
      where: {
        commentaire: { not: null },
        cours: { statutSeance: 'EFFECTUE' },
      },
      select: {
        id: true,
        note: true,
        commentaire: true,
        createdAt: true,
        utilisateur: { select: { prenom: true } },
        cours: { select: { titre: true, genre: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.siteSettings.upsert({ where: { id: 1 }, create: {}, update: {} }),
  ])
  res.json({ success: true, data: { afficherAvis: settings.afficherAvis, avis } })
}

export async function updateAvisSettings(req: Request, res: Response) {
  const { afficherAvis } = req.body
  if (typeof afficherAvis !== 'boolean') {
    res.status(400).json({ success: false, message: 'afficherAvis doit être un booléen.' })
    return
  }
  const settings = await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: { afficherAvis },
    update: { afficherAvis },
  })
  res.json({ success: true, message: afficherAvis ? 'Section avis visible.' : 'Section avis masquée.', data: settings })
}
