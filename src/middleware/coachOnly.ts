import { Response, NextFunction } from 'express'
import { Role } from '@prisma/client'
import { AuthRequest } from './auth'

export function coachOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== Role.COACH && req.user?.role !== Role.ADMIN) {
    res.status(403).json({ success: false, message: 'Accès réservé aux coachs' })
    return
  }
  next()
}
