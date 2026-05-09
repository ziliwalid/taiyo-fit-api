import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma'

function signToken(id: number, role: string) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET!, { expiresIn: '7d' })
}

export async function register(req: Request, res: Response) {
  const { email, password, nom, prenom, telephone } = req.body
  if (!email || !password || !nom || !prenom) {
    res.status(400).json({ error: 'Champs requis manquants' })
    return
  }
  const exists = await prisma.utilisateur.findUnique({ where: { email } })
  if (exists) {
    res.status(409).json({ error: 'Email déjà utilisé' })
    return
  }
  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.utilisateur.create({
    data: { email, password: hash, nom, prenom, telephone }
  })
  res.status(201).json({ token: signToken(user.id, user.role) })
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body
  const user = await prisma.utilisateur.findUnique({ where: { email } })
  if (!user) {
    res.status(401).json({ error: 'Identifiants incorrects' })
    return
  }
  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    res.status(401).json({ error: 'Identifiants incorrects' })
    return
  }
  res.json({ token: signToken(user.id, user.role) })
}
