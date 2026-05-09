import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'

export function adminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ error: "Accès réservé à l'admin" })
    return
  }
  next()
}
