import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { parseId } from '../lib/validate'

// ─── Public ──────────────────────────────────────────────────────────────────

export async function listLieux(req: Request, res: Response) {
  const [lieux, settings] = await Promise.all([
    prisma.lieu.findMany({ where: { actif: true }, orderBy: { createdAt: 'asc' } }),
    prisma.siteSettings.upsert({ where: { id: 1 }, create: {}, update: {} }),
  ])
  res.json({ success: true, data: { lieux, afficherMap: settings.afficherMap } })
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function adminListLieux(req: Request, res: Response) {
  const [lieux, settings] = await Promise.all([
    prisma.lieu.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.siteSettings.upsert({ where: { id: 1 }, create: {}, update: {} }),
  ])
  res.json({ success: true, data: { lieux, afficherMap: settings.afficherMap } })
}

export async function createLieu(req: Request, res: Response) {
  const { nom, lat, lng } = req.body
  if (!nom || lat === undefined || lng === undefined) {
    res.status(400).json({ success: false, message: 'nom, lat et lng sont requis.' })
    return
  }
  const lieu = await prisma.lieu.create({ data: { nom, lat: Number(lat), lng: Number(lng) } })
  res.status(201).json({ success: true, message: `Lieu "${nom}" ajouté.`, data: lieu })
}

export async function toggleLieu(req: Request, res: Response) {
  const id = parseId(req.params.id, res)
  if (id === null) return
  const lieu = await prisma.lieu.findUnique({ where: { id } })
  if (!lieu) { res.status(404).json({ success: false, message: 'Lieu introuvable.' }); return }
  const updated = await prisma.lieu.update({ where: { id }, data: { actif: !lieu.actif } })
  res.json({ success: true, data: updated })
}

export async function deleteLieu(req: Request, res: Response) {
  const id = parseId(req.params.id, res)
  if (id === null) return
  await prisma.lieu.delete({ where: { id } })
  res.json({ success: true, message: 'Lieu supprimé.' })
}

export async function updateMapSettings(req: Request, res: Response) {
  const { afficherMap } = req.body
  if (typeof afficherMap !== 'boolean') {
    res.status(400).json({ success: false, message: 'afficherMap doit être un booléen.' })
    return
  }
  const settings = await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: { afficherMap },
    update: { afficherMap },
  })
  res.json({ success: true, message: afficherMap ? 'Carte visible.' : 'Carte masquée.', data: settings })
}
