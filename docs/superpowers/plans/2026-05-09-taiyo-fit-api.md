# Taiyo Fit API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Node.js/Express REST API with PostgreSQL for Taiyo Fit — auth, courses, reservations, packs, admin.

**Architecture:** Layered Express app (routes → controllers → Prisma). JWT auth. One active pack per member. Admin = Malak only.

**Tech Stack:** Node.js, TypeScript, Express, Prisma, PostgreSQL, JWT, bcryptjs, Jest, Supertest.

---

### File Map

```
src/
  app.ts                  Express app factory
  index.ts                Server entry point
  lib/prisma.ts           Prisma singleton
  middleware/
    auth.ts               JWT verify → req.user
    adminOnly.ts          role === 'admin' guard
  routes/
    auth.ts               /auth/*
    cours.ts              /cours/*
    pack.ts               /mon-compte/pack
    admin.ts              /admin/*
  controllers/
    authController.ts
    coursController.ts
    packController.ts
    adminController.ts
prisma/
  schema.prisma
tests/
  auth.test.ts
  cours.test.ts
  pack.test.ts
  admin.test.ts
.env.example
```

---

### Task 1: Scaffold + Dependencies

**Files:** `package.json`, `tsconfig.json`, `.env.example`, `.gitignore`, `src/index.ts`, `src/app.ts`

- [ ] Init project
```bash
cd "D:/My Files/Taiyou-fit/taiyo-fit-api"
npm init -y
```

- [ ] Install deps
```bash
npm install express @prisma/client jsonwebtoken bcryptjs dotenv cors
npm install -D typescript ts-node @types/express @types/node @types/jsonwebtoken @types/bcryptjs @types/cors jest ts-jest supertest @types/supertest @types/jest prisma
```

- [ ] Create `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] Update `package.json` scripts
```json
{
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest --runInBand --forceExit"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "testMatch": ["**/tests/**/*.test.ts"]
  }
}
```

- [ ] Create `.env.example`
```
DATABASE_URL="postgresql://user:password@localhost:5432/taiyo_fit"
JWT_SECRET="change_me_in_production"
PORT=4000
```

- [ ] Create `.gitignore`
```
node_modules/
dist/
.env
```

- [ ] Create `src/app.ts`
```typescript
import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth'
import coursRoutes from './routes/cours'
import packRoutes from './routes/pack'
import adminRoutes from './routes/admin'

const app = express()
app.use(cors())
app.use(express.json())

app.use('/auth', authRoutes)
app.use('/cours', coursRoutes)
app.use('/mon-compte', packRoutes)
app.use('/admin', adminRoutes)

app.get('/health', (_, res) => res.json({ ok: true }))

export default app
```

- [ ] Create `src/index.ts`
```typescript
import dotenv from 'dotenv'
dotenv.config()
import app from './app'

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`Taiyo Fit API running on :${PORT}`))
```

- [ ] Commit
```bash
git add -A && git commit -m "feat: scaffold Node.js/TypeScript Express project"
```

---

### Task 2: Prisma Schema + Migration

**Files:** `prisma/schema.prisma`, `src/lib/prisma.ts`

- [ ] Init Prisma
```bash
npx prisma init
```

- [ ] Write `prisma/schema.prisma`
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Utilisateur {
  id           Int            @id @default(autoincrement())
  email        String         @unique
  password     String
  role         Role           @default(ADHERENT)
  nom          String
  prenom       String
  telephone    String?
  reservations Reservation[]
  comptePack   ComptePack?
  createdAt    DateTime       @default(now())
}

enum Role {
  ADMIN
  ADHERENT
}

model Coach {
  id     Int     @id @default(autoincrement())
  nom    String
  prenom String
  cours  Cours[]
}

model Cours {
  id           Int           @id @default(autoincrement())
  titre        String
  dateHeure    DateTime
  dureeMinutes Int
  placesMax    Int
  coach        Coach         @relation(fields: [coachId], references: [id])
  coachId      Int
  reservations Reservation[]
  createdAt    DateTime      @default(now())
}

model Reservation {
  id            Int               @id @default(autoincrement())
  utilisateur   Utilisateur       @relation(fields: [utilisateurId], references: [id])
  utilisateurId Int
  cours         Cours             @relation(fields: [coursId], references: [id])
  coursId       Int
  statut        StatutReservation @default(EN_ATTENTE)
  createdAt     DateTime          @default(now())

  @@unique([utilisateurId, coursId])
}

enum StatutReservation {
  EN_ATTENTE
  CONFIRME
  ANNULE
}

model Pack {
  id          Int          @id @default(autoincrement())
  nom         String
  nbSessions  Int
  description String?
  comptes     ComptePack[]
}

model ComptePack {
  id                Int         @id @default(autoincrement())
  utilisateur       Utilisateur @relation(fields: [utilisateurId], references: [id])
  utilisateurId     Int         @unique
  pack              Pack        @relation(fields: [packId], references: [id])
  packId            Int
  sessionsRestantes Int
  createdAt         DateTime    @default(now())
}
```

- [ ] Create `src/lib/prisma.ts`
```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
export default prisma
```

- [ ] Run migration (requires PostgreSQL running)
```bash
npx prisma migrate dev --name init
```

- [ ] Commit
```bash
git add -A && git commit -m "feat: prisma schema — utilisateur, coach, cours, reservation, pack"
```

---

### Task 3: Auth Middleware + JWT Helpers

**Files:** `src/middleware/auth.ts`, `src/middleware/adminOnly.ts`

- [ ] Write `src/middleware/auth.ts`
```typescript
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  user?: { id: number; role: string }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Non authentifié' })
    return
  }
  try {
    const token = header.slice(7)
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: number; role: string }
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Token invalide' })
  }
}
```

- [ ] Write `src/middleware/adminOnly.ts`
```typescript
import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'

export function adminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ error: 'Accès réservé à l\'admin' })
    return
  }
  next()
}
```

- [ ] Commit
```bash
git add -A && git commit -m "feat: JWT auth middleware + admin guard"
```

---

### Task 4: Auth Routes (Register + Login)

**Files:** `src/controllers/authController.ts`, `src/routes/auth.ts`, `tests/auth.test.ts`

- [ ] Write failing test `tests/auth.test.ts`
```typescript
import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'

afterAll(async () => {
  await prisma.utilisateur.deleteMany({ where: { email: { contains: '@test.com' } } })
  await prisma.$disconnect()
})

describe('POST /auth/register', () => {
  it('creates user and returns token', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'marie@test.com', password: 'secret123',
      nom: 'Martin', prenom: 'Marie', telephone: '0601020304'
    })
    expect(res.status).toBe(201)
    expect(res.body.token).toBeDefined()
  })

  it('rejects duplicate email', async () => {
    await request(app).post('/auth/register').send({
      email: 'dup@test.com', password: 'secret123', nom: 'A', prenom: 'B'
    })
    const res = await request(app).post('/auth/register').send({
      email: 'dup@test.com', password: 'secret123', nom: 'A', prenom: 'B'
    })
    expect(res.status).toBe(409)
  })
})

describe('POST /auth/login', () => {
  it('returns token with valid credentials', async () => {
    await request(app).post('/auth/register').send({
      email: 'login@test.com', password: 'secret123', nom: 'X', prenom: 'Y'
    })
    const res = await request(app).post('/auth/login').send({
      email: 'login@test.com', password: 'secret123'
    })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
  })

  it('rejects wrong password', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'login@test.com', password: 'wrong'
    })
    expect(res.status).toBe(401)
  })
})
```

- [ ] Run test — verify FAIL
```bash
npm test tests/auth.test.ts
```
Expected: FAIL (routes not defined)

- [ ] Write `src/controllers/authController.ts`
```typescript
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
```

- [ ] Write `src/routes/auth.ts`
```typescript
import { Router } from 'express'
import { register, login } from '../controllers/authController'

const router = Router()
router.post('/register', register)
router.post('/login', login)
export default router
```

- [ ] Run test — verify PASS
```bash
npm test tests/auth.test.ts
```

- [ ] Commit
```bash
git add -A && git commit -m "feat: auth register + login with JWT"
```

---

### Task 5: Cours Routes (Member)

**Files:** `src/controllers/coursController.ts`, `src/routes/cours.ts`, `tests/cours.test.ts`

- [ ] Write failing test `tests/cours.test.ts`
```typescript
import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'

let token: string
let coachId: number
let coursId: number

beforeAll(async () => {
  const reg = await request(app).post('/auth/register').send({
    email: 'user_cours@test.com', password: 'secret', nom: 'Test', prenom: 'User'
  })
  token = reg.body.token

  const coach = await prisma.coach.create({ data: { nom: 'Joly', prenom: 'Malak' } })
  coachId = coach.id

  const cours = await prisma.cours.create({
    data: { titre: 'HIIT', dateHeure: new Date('2026-06-01T10:00:00Z'), dureeMinutes: 45, placesMax: 10, coachId }
  })
  coursId = cours.id
})

afterAll(async () => {
  await prisma.reservation.deleteMany({})
  await prisma.cours.deleteMany({})
  await prisma.coach.deleteMany({})
  await prisma.utilisateur.deleteMany({ where: { email: { contains: '@test.com' } } })
  await prisma.$disconnect()
})

describe('GET /cours', () => {
  it('returns list with coach name', async () => {
    const res = await request(app).get('/cours').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body[0].coach).toMatchObject({ nom: 'Joly', prenom: 'Malak' })
  })
})

describe('GET /cours/:id', () => {
  it('returns course with participants list', async () => {
    const res = await request(app).get(`/cours/${coursId}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.participants).toBeDefined()
    expect(res.body.coach).toMatchObject({ nom: 'Joly', prenom: 'Malak' })
  })
})

describe('POST /cours/:id/reserver', () => {
  it('creates reservation', async () => {
    const res = await request(app)
      .post(`/cours/${coursId}/reserver`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(201)
    expect(res.body.statut).toBe('EN_ATTENTE')
  })

  it('rejects duplicate reservation', async () => {
    const res = await request(app)
      .post(`/cours/${coursId}/reserver`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(409)
  })
})
```

- [ ] Run test — verify FAIL

- [ ] Write `src/controllers/coursController.ts`
```typescript
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

export async function listCours(req: AuthRequest, res: Response) {
  const cours = await prisma.cours.findMany({
    include: { coach: { select: { nom: true, prenom: true } } },
    orderBy: { dateHeure: 'asc' }
  })
  res.json(cours)
}

export async function getCours(req: AuthRequest, res: Response) {
  const id = parseInt(req.params.id)
  const cours = await prisma.cours.findUnique({
    where: { id },
    include: {
      coach: { select: { nom: true, prenom: true } },
      reservations: {
        where: { statut: { not: 'ANNULE' } },
        include: { utilisateur: { select: { nom: true, prenom: true } } }
      }
    }
  })
  if (!cours) { res.status(404).json({ error: 'Cours introuvable' }); return }

  res.json({
    ...cours,
    participants: cours.reservations.map(r => r.utilisateur),
    nbParticipants: cours.reservations.length
  })
}

export async function reserver(req: AuthRequest, res: Response) {
  const coursId = parseInt(req.params.id)
  const utilisateurId = req.user!.id

  const cours = await prisma.cours.findUnique({
    where: { id: coursId },
    include: { reservations: { where: { statut: { not: 'ANNULE' } } } }
  })
  if (!cours) { res.status(404).json({ error: 'Cours introuvable' }); return }
  if (cours.reservations.length >= cours.placesMax) {
    res.status(409).json({ error: 'Cours complet' }); return
  }

  try {
    const resa = await prisma.reservation.create({ data: { utilisateurId, coursId } })
    res.status(201).json(resa)
  } catch {
    res.status(409).json({ error: 'Réservation déjà existante' })
  }
}
```

- [ ] Write `src/routes/cours.ts`
```typescript
import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { listCours, getCours, reserver } from '../controllers/coursController'

const router = Router()
router.use(requireAuth)
router.get('/', listCours)
router.get('/:id', getCours)
router.post('/:id/reserver', reserver)
export default router
```

- [ ] Run test — verify PASS

- [ ] Commit
```bash
git add -A && git commit -m "feat: cours list, detail with participants, reservation"
```

---

### Task 6: Pack Route (Member)

**Files:** `src/controllers/packController.ts`, `src/routes/pack.ts`, `tests/pack.test.ts`

- [ ] Write failing test `tests/pack.test.ts`
```typescript
import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'

let token: string
let userId: number

beforeAll(async () => {
  const reg = await request(app).post('/auth/register').send({
    email: 'pack_user@test.com', password: 'secret', nom: 'Pack', prenom: 'User'
  })
  token = reg.body.token
  const u = await prisma.utilisateur.findUnique({ where: { email: 'pack_user@test.com' } })
  userId = u!.id

  const pack = await prisma.pack.create({ data: { nom: 'Pack 10', nbSessions: 10 } })
  await prisma.comptePack.create({ data: { utilisateurId: userId, packId: pack.id, sessionsRestantes: 7 } })
})

afterAll(async () => {
  await prisma.comptePack.deleteMany({})
  await prisma.pack.deleteMany({})
  await prisma.utilisateur.deleteMany({ where: { email: { contains: '@test.com' } } })
  await prisma.$disconnect()
})

describe('GET /mon-compte/pack', () => {
  it('returns active pack with sessions remaining', async () => {
    const res = await request(app).get('/mon-compte/pack').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.sessionsRestantes).toBe(7)
    expect(res.body.pack.nom).toBe('Pack 10')
  })

  it('returns 404 when no active pack', async () => {
    const reg = await request(app).post('/auth/register').send({
      email: 'nopack@test.com', password: 'secret', nom: 'No', prenom: 'Pack'
    })
    const res = await request(app).get('/mon-compte/pack').set('Authorization', `Bearer ${reg.body.token}`)
    expect(res.status).toBe(404)
  })
})
```

- [ ] Run test — verify FAIL

- [ ] Write `src/controllers/packController.ts`
```typescript
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

export async function getMonPack(req: AuthRequest, res: Response) {
  const compte = await prisma.comptePack.findUnique({
    where: { utilisateurId: req.user!.id },
    include: { pack: true }
  })
  if (!compte) { res.status(404).json({ error: 'Aucun pack actif' }); return }
  res.json(compte)
}
```

- [ ] Write `src/routes/pack.ts`
```typescript
import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { getMonPack } from '../controllers/packController'

const router = Router()
router.use(requireAuth)
router.get('/pack', getMonPack)
export default router
```

- [ ] Run test — verify PASS

- [ ] Commit
```bash
git add -A && git commit -m "feat: member pack route — active pack + sessions restantes"
```

---

### Task 7: Admin Routes

**Files:** `src/controllers/adminController.ts`, `src/routes/admin.ts`, `tests/admin.test.ts`

- [ ] Write failing test `tests/admin.test.ts`
```typescript
import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'

let adminToken: string
let coursId: number
let resaId: number

beforeAll(async () => {
  const admin = await prisma.utilisateur.create({
    data: { email: 'malak@test.com', password: 'x', nom: 'Joly', prenom: 'Malak', role: 'ADMIN' }
  })
  const jwt = require('jsonwebtoken')
  adminToken = jwt.sign({ id: admin.id, role: 'ADMIN' }, process.env.JWT_SECRET || 'test_secret')

  const coach = await prisma.coach.create({ data: { nom: 'Joly', prenom: 'Malak' } })
  const cours = await prisma.cours.create({
    data: { titre: 'Yoga', dateHeure: new Date('2026-07-01T09:00:00Z'), dureeMinutes: 60, placesMax: 8, coachId: coach.id }
  })
  coursId = cours.id

  const user = await prisma.utilisateur.create({
    data: { email: 'member@test.com', password: 'x', nom: 'Dupont', prenom: 'Jean', telephone: '0600000001', role: 'ADHERENT' }
  })
  const resa = await prisma.reservation.create({ data: { utilisateurId: user.id, coursId } })
  resaId = resa.id
})

afterAll(async () => {
  await prisma.reservation.deleteMany({})
  await prisma.cours.deleteMany({})
  await prisma.coach.deleteMany({})
  await prisma.utilisateur.deleteMany({ where: { email: { contains: '@test.com' } } })
  await prisma.$disconnect()
})

describe('GET /admin/cours/:id/participants', () => {
  it('returns participant list with phone', async () => {
    const res = await request(app)
      .get(`/admin/cours/${coursId}/participants`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body[0]).toMatchObject({ nom: 'Dupont', prenom: 'Jean', telephone: '0600000001' })
  })
})

describe('PATCH /admin/reservations/:id', () => {
  it('validates a reservation', async () => {
    const res = await request(app)
      .patch(`/admin/reservations/${resaId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ statut: 'CONFIRME' })
    expect(res.status).toBe(200)
    expect(res.body.statut).toBe('CONFIRME')
  })
})

describe('POST /admin/cours', () => {
  it('creates a new cours', async () => {
    const coach = await prisma.coach.findFirst()
    const res = await request(app)
      .post('/admin/cours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ titre: 'Bootcamp', dateHeure: '2026-08-01T07:00:00Z', dureeMinutes: 50, placesMax: 12, coachId: coach!.id })
    expect(res.status).toBe(201)
    expect(res.body.titre).toBe('Bootcamp')
  })
})

describe('POST /admin/packs', () => {
  it('creates a new pack', async () => {
    const res = await request(app)
      .post('/admin/packs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: 'Pack 5', nbSessions: 5, description: 'Découverte' })
    expect(res.status).toBe(201)
    expect(res.body.nom).toBe('Pack 5')
  })
})
```

- [ ] Run test — verify FAIL

- [ ] Write `src/controllers/adminController.ts`
```typescript
import { Request, Response } from 'express'
import prisma from '../lib/prisma'

export async function getParticipants(req: Request, res: Response) {
  const coursId = parseInt(req.params.id)
  const reservations = await prisma.reservation.findMany({
    where: { coursId, statut: { not: 'ANNULE' } },
    include: { utilisateur: { select: { nom: true, prenom: true, telephone: true } } }
  })
  res.json(reservations.map(r => r.utilisateur))
}

export async function updateReservation(req: Request, res: Response) {
  const id = parseInt(req.params.id)
  const { statut } = req.body
  if (!['EN_ATTENTE', 'CONFIRME', 'ANNULE'].includes(statut)) {
    res.status(400).json({ error: 'Statut invalide' }); return
  }
  const resa = await prisma.reservation.update({ where: { id }, data: { statut } })
  res.json(resa)
}

export async function createCours(req: Request, res: Response) {
  const { titre, dateHeure, dureeMinutes, placesMax, coachId } = req.body
  if (!titre || !dateHeure || !dureeMinutes || !placesMax || !coachId) {
    res.status(400).json({ error: 'Champs requis manquants' }); return
  }
  const cours = await prisma.cours.create({
    data: { titre, dateHeure: new Date(dateHeure), dureeMinutes, placesMax, coachId }
  })
  res.status(201).json(cours)
}

export async function createPack(req: Request, res: Response) {
  const { nom, nbSessions, description } = req.body
  if (!nom || !nbSessions) {
    res.status(400).json({ error: 'Champs requis manquants' }); return
  }
  const pack = await prisma.pack.create({ data: { nom, nbSessions, description } })
  res.status(201).json(pack)
}

export async function assignPack(req: Request, res: Response) {
  const { utilisateurId, packId } = req.body
  const pack = await prisma.pack.findUnique({ where: { id: packId } })
  if (!pack) { res.status(404).json({ error: 'Pack introuvable' }); return }

  const compte = await prisma.comptePack.upsert({
    where: { utilisateurId },
    update: { packId, sessionsRestantes: pack.nbSessions },
    create: { utilisateurId, packId, sessionsRestantes: pack.nbSessions }
  })
  res.status(201).json(compte)
}
```

- [ ] Write `src/routes/admin.ts`
```typescript
import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { adminOnly } from '../middleware/adminOnly'
import { getParticipants, updateReservation, createCours, createPack, assignPack } from '../controllers/adminController'

const router = Router()
router.use(requireAuth, adminOnly)
router.get('/cours/:id/participants', getParticipants)
router.patch('/reservations/:id', updateReservation)
router.post('/cours', createCours)
router.post('/packs', createPack)
router.post('/packs/assigner', assignPack)
export default router
```

- [ ] Run test — verify PASS

- [ ] Run ALL tests
```bash
npm test
```
Expected: all PASS

- [ ] Commit
```bash
git add -A && git commit -m "feat: admin routes — participants, validate resa, create cours/pack, assign pack"
```

---

### Task 8: Git init + README

- [ ] Init git
```bash
cd "D:/My Files/Taiyou-fit/taiyo-fit-api"
git init
git add -A
git commit -m "feat: complete Taiyo Fit API — auth, cours, packs, admin"
```

- [ ] Create `.env` from example + verify server starts
```bash
cp .env.example .env
# Edit DATABASE_URL with real PostgreSQL credentials
npm run dev
```

Expected: `Taiyo Fit API running on :4000`
