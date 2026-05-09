import { Response, NextFunction } from 'express'
import { Role } from '@prisma/client'
import { AuthRequest } from './auth'

export function adminOrCoach(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== Role.ADMIN && req.user?.role !== Role.COACH) {
    res.status(403).json({ success: false, message: "Accès réservé aux coachs et à l'admin" })
    return
  }
  next()
}
