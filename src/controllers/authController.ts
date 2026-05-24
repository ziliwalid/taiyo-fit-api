import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { zodFail } from '../lib/validate'

const LoginSchema = z.object({
  email: z.string().min(1, 'Email requis.'),
  password: z.string().min(1, 'Mot de passe requis.'),
})

function signToken(id: number, role: string) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET!, { expiresIn: '7d' })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function register(req: Request, res: Response) {
  const { email, password, nom, prenom, telephone } = req.body
  if (!email || !password || !nom || !prenom) {
    res.status(400).json({ success: false, message: 'Champs requis manquants : email, password, nom, prenom' })
    return
  }
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ success: false, message: 'Adresse email invalide.' })
    return
  }
  if (typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 6 caractères.' })
    return
  }
  const exists = await prisma.utilisateur.findUnique({ where: { email } })
  if (exists) {
    res.status(409).json({ success: false, message: 'Cette adresse email est déjà utilisée' })
    return
  }
  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.utilisateur.create({
    data: { email, password: hash, nom, prenom, telephone }
  })
  res.status(201).json({
    success: true,
    message: `Bienvenue ${prenom} ! Votre compte a été créé avec succès.`,
    token: signToken(user.id, user.role)
  })
}

export async function login(req: Request, res: Response) {
  const parsed = LoginSchema.safeParse(req.body)
  if (!parsed.success) { zodFail(res, parsed.error); return }
  const { email, password } = parsed.data
  const user = await prisma.utilisateur.findUnique({ where: { email } })
  if (!user) {
    res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' })
    return
  }
  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' })
    return
  }
  if (!user.actif) {
    res.status(403).json({ success: false, message: 'Votre compte a été suspendu. Contactez Malak.' })
    return
  }
  res.json({
    success: true,
    message: `Bon retour ${user.prenom} !`,
    token: signToken(user.id, user.role),
    prenom: user.prenom,
    actif: user.actif,
  })
}
