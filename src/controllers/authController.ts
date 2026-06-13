import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { zodFail } from '../lib/validate'
import { sendBienvenueToMembre, sendVerificationEmail, sendResetPassword } from '../services/mailer'

const LoginSchema = z.object({
  email: z.string().min(1, 'Email requis.'),
  password: z.string().min(1, 'Mot de passe requis.'),
})

function signToken(id: number, role: string) {
  // Admins: 8h absolute max + 30min inactivity on frontend
  const expiresIn = role === 'ADMIN' ? '8h' : '7d'
  return jwt.sign({ id, role }, process.env.JWT_SECRET!, { expiresIn })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://taiyo-fit-lyart.vercel.app'

export async function register(req: Request, res: Response) {
  const { email, password, nom, prenom, telephone } = req.body
  if (!email || !password || !nom || !prenom || !telephone) {
    res.status(400).json({ success: false, message: 'Champs requis manquants : email, password, nom, prenom, telephone' })
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

  const hash  = await bcrypt.hash(password, 10)
  const token = randomBytes(32).toString('hex')
  const tokenExpires = new Date(Date.now() + 72 * 60 * 60 * 1000) // 72h

  await prisma.utilisateur.create({
    data: { email, password: hash, nom, prenom, telephone, emailVerifie: false, tokenVerification: token, tokenExpires },
  })

  // Fire-and-forget emails
  sendVerificationEmail({ prenom, email, token, frontendUrl: FRONTEND_URL }).catch(() => {})
  sendBienvenueToMembre({ prenom, email }).catch(() => {})

  res.status(201).json({
    success: true,
    message: `Compte créé ! Vérifie ta boîte mail ${email} pour activer ton compte.`,
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
  if (!user.emailVerifie) {
    res.status(403).json({
      success: false,
      message: 'Adresse email non vérifiée. Vérifie ta boîte mail ou demande un nouveau lien.',
      code: 'EMAIL_NOT_VERIFIED',
    })
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

export async function verifyEmail(req: Request, res: Response) {
  const { token } = req.body
  if (!token) {
    res.status(400).json({ success: false, message: 'Token manquant.' })
    return
  }

  const user = await prisma.utilisateur.findFirst({ where: { tokenVerification: token } })
  if (!user) {
    res.status(400).json({ success: false, message: 'Lien invalide ou déjà utilisé.' })
    return
  }
  if (user.tokenExpires && new Date() > user.tokenExpires) {
    res.status(400).json({ success: false, message: 'Lien expiré. Demande un nouveau lien.', code: 'TOKEN_EXPIRED' })
    return
  }

  await prisma.utilisateur.update({
    where: { id: user.id },
    data: { emailVerifie: true, tokenVerification: null, tokenExpires: null },
  })

  res.json({ success: true, message: 'Email vérifié ! Tu peux maintenant te connecter.' })
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body
  const user = email ? await prisma.utilisateur.findUnique({ where: { email } }) : null

  if (user) {
    const token = randomBytes(32).toString('hex')
    const tokenResetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1h
    await prisma.utilisateur.update({ where: { id: user.id }, data: { tokenReset: token, tokenResetExpires } })
    sendResetPassword({ prenom: user.prenom, email: user.email, token, frontendUrl: FRONTEND_URL }).catch(() => {})
  }

  // Always 200 to prevent email enumeration
  res.json({ success: true, message: 'Si ce compte existe, un email de réinitialisation a été envoyé.' })
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = req.body
  if (!token || !password) {
    res.status(400).json({ success: false, message: 'Token et mot de passe requis.' })
    return
  }
  if (typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ success: false, message: 'Le mot de passe doit contenir au moins 6 caractères.' })
    return
  }

  const user = await prisma.utilisateur.findFirst({ where: { tokenReset: token } })
  if (!user || !user.tokenResetExpires) {
    res.status(400).json({ success: false, message: 'Lien invalide ou déjà utilisé.' })
    return
  }
  if (new Date() > user.tokenResetExpires) {
    res.status(400).json({ success: false, message: 'Lien expiré. Fais une nouvelle demande.', code: 'TOKEN_EXPIRED' })
    return
  }

  const hash = await bcrypt.hash(password, 10)
  await prisma.utilisateur.update({
    where: { id: user.id },
    data: { password: hash, tokenReset: null, tokenResetExpires: null },
  })

  res.json({ success: true, message: 'Mot de passe mis à jour. Tu peux te connecter.' })
}

export async function resendVerification(req: Request, res: Response) {
  const { email } = req.body
  // Always return 200 to prevent email enumeration
  const user = email ? await prisma.utilisateur.findUnique({ where: { email } }) : null

  if (user && !user.emailVerifie) {
    const token = randomBytes(32).toString('hex')
    const tokenExpires = new Date(Date.now() + 72 * 60 * 60 * 1000)
    await prisma.utilisateur.update({ where: { id: user.id }, data: { tokenVerification: token, tokenExpires } })
    sendVerificationEmail({ prenom: user.prenom, email: user.email, token, frontendUrl: FRONTEND_URL }).catch(() => {})
  }

  res.json({ success: true, message: 'Si ce compte existe et n\'est pas vérifié, un email a été envoyé.' })
}
