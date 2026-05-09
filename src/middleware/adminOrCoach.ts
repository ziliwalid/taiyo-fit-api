import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'

export function adminOrCoach(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'COACH') {
    res.status(403).json({ success: false, message: 'Accès réservé aux coachs et à l\'admin' })
    return
  }
  next()
}
