import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

export async function getMonPack(req: AuthRequest, res: Response) {
  const compte = await prisma.comptePack.findUnique({
    where: { utilisateurId: req.user!.id },
    include: { pack: true }
  })
  if (!compte) { res.status(404).json({ error: 'Aucun pack actif' }); return }
  res.json(compte)
}
