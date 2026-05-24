import { Response } from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { parseId } from '../lib/validate'

export async function listEvenements(req: AuthRequest, res: Response) {
  // Optional auth: authenticated users see private posts too
  let isAuthenticated = false
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    try {
      jwt.verify(header.slice(7), process.env.JWT_SECRET!)
      isAuthenticated = true
    } catch {
      // invalid token — treat as unauthenticated
    }
  }

  const evenements = await prisma.evenement.findMany({
    where: isAuthenticated ? {} : { estPublic: true },
    orderBy: [{ epingle: 'desc' }, { createdAt: 'desc' }],
  })

  res.json({ success: true, message: 'OK', data: evenements })
}

export async function adminListEvenements(_req: AuthRequest, res: Response) {
  const evenements = await prisma.evenement.findMany({
    orderBy: [{ epingle: 'desc' }, { createdAt: 'desc' }],
  })
  res.json({ success: true, message: 'OK', data: evenements })
}

export async function createEvenement(req: AuthRequest, res: Response) {
  const { titre, contenu, imageUrl, dateEvenement, tag, estPublic, epingle } = req.body

  if (!titre?.trim() || !contenu?.trim()) {
    res.status(400).json({ success: false, message: 'Titre et contenu requis.' })
    return
  }

  const evenement = await prisma.evenement.create({
    data: {
      titre: titre.trim(),
      contenu: contenu.trim(),
      imageUrl: imageUrl?.trim() || null,
      dateEvenement: dateEvenement ? new Date(dateEvenement) : null,
      tag: tag || null,
      estPublic: estPublic !== undefined ? Boolean(estPublic) : true,
      epingle: epingle !== undefined ? Boolean(epingle) : false,
    },
  })

  res.status(201).json({ success: true, message: 'Événement créé.', data: evenement })
}

export async function updateEvenement(req: AuthRequest, res: Response) {
  const id = parseId(req.params.id, res)
  if (id === null) return
  const { titre, contenu, imageUrl, dateEvenement, tag, estPublic, epingle } = req.body

  const evenement = await prisma.evenement.update({
    where: { id },
    data: {
      ...(titre !== undefined && { titre: titre.trim() }),
      ...(contenu !== undefined && { contenu: contenu.trim() }),
      ...(imageUrl !== undefined && { imageUrl: imageUrl?.trim() || null }),
      ...(dateEvenement !== undefined && { dateEvenement: dateEvenement ? new Date(dateEvenement) : null }),
      ...(tag !== undefined && { tag: tag || null }),
      ...(estPublic !== undefined && { estPublic: Boolean(estPublic) }),
      ...(epingle !== undefined && { epingle: Boolean(epingle) }),
    },
  })

  res.json({ success: true, message: 'Événement mis à jour.', data: evenement })
}

export async function deleteEvenement(req: AuthRequest, res: Response) {
  const id = parseId(req.params.id, res)
  if (id === null) return
  await prisma.evenement.delete({ where: { id } })
  res.json({ success: true, message: 'Événement supprimé.', data: null })
}
