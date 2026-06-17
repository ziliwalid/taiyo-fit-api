import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { Role } from '@prisma/client'
import prisma from '../lib/prisma'

export interface AuthRequest extends Request {
  user?: { id: number; role: Role }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as { id: number; role: Role }
      req.user = payload
    } catch {}
  }
  next()
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Non authentifié' })
    return
  }
  try {
    const token = header.slice(7)
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: number; role: Role }

    const user = await prisma.utilisateur.findUnique({
      where: { id: payload.id },
      select: { actif: true }
    })
    if (!user || !user.actif) {
      res.status(403).json({ success: false, message: 'Votre compte a été suspendu. Contactez Malak.' })
      return
    }

    req.user = payload
    next()
  } catch {
    res.status(401).json({ success: false, message: 'Token invalide' })
  }
}
