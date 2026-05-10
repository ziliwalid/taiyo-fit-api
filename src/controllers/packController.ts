import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

export async function listPacks(_req: Request, res: Response) {
  const packs = await prisma.pack.findMany({ orderBy: { id: 'asc' } })
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
    message: `Pack "${compte.pack.nom}" actif — il vous reste ${compte.sessionsRestantes} session(s)`,
    data: compte
  })
}
