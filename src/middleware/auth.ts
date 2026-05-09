import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { Role } from '@prisma/client'

export interface AuthRequest extends Request {
  user?: { id: number; role: Role }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Non authentifié' })
    return
  }
  try {
    const token = header.slice(7)
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: number; role: Role }
    req.user = payload
    next()
  } catch {
    res.status(401).json({ success: false, message: 'Token invalide' })
  }
}
