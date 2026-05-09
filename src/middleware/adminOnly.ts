import { Response, NextFunction } from 'express'
import { Role } from '@prisma/client'
import { AuthRequest } from './auth'

export function adminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== Role.ADMIN) {
    res.status(403).json({ success: false, message: "Accès réservé à l'admin" })
    return
  }
  next()
}
