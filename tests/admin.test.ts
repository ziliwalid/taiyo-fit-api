import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'
import jwt from 'jsonwebtoken'

let adminToken: string
let coursId: number
let resaId: number
let coachId: number

beforeAll(async () => {
  process.env.JWT_SECRET = 'test_secret'

  const admin = await prisma.utilisateur.create({
    data: { email: 'malak@test.com', password: 'x', nom: 'Joly', prenom: 'Malak', role: 'ADMIN' }
  })
  adminToken = jwt.sign({ id: admin.id, role: 'ADMIN' }, 'test_secret')

  const coach = await prisma.coach.create({ data: { nom: 'Joly', prenom: 'Malak' } })
  coachId = coach.id

  const cours = await prisma.cours.create({
    data: { titre: 'Yoga', dateHeure: new Date('2026-07-01T09:00:00Z'), dureeMinutes: 60, placesMax: 8, coachId }
  })
  coursId = cours.id

  const member = await prisma.utilisateur.create({
    data: { email: 'member@test.com', password: 'x', nom: 'Dupont', prenom: 'Jean', telephone: '0600000001', role: 'ADHERENT' }
  })
  const resa = await prisma.reservation.create({ data: { utilisateurId: member.id, coursId } })
  resaId = resa.id
})

afterAll(async () => {
  await prisma.reservation.deleteMany({})
  await prisma.cours.deleteMany({})
  await prisma.coach.deleteMany({})
  await prisma.comptePack.deleteMany({})
  await prisma.pack.deleteMany({})
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

  it('blocks non-admin', async () => {
    const reg = await request(app).post('/auth/register').send({
      email: 'regular@test.com', password: 'x', nom: 'R', prenom: 'R'
    })
    const res = await request(app)
      .get(`/admin/cours/${coursId}/participants`)
      .set('Authorization', `Bearer ${reg.body.token}`)
    expect(res.status).toBe(403)
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

  it('rejects invalid statut', async () => {
    const res = await request(app)
      .patch(`/admin/reservations/${resaId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ statut: 'INVALIDE' })
    expect(res.status).toBe(400)
  })
})

describe('POST /admin/cours', () => {
  it('creates a new cours', async () => {
    const res = await request(app)
      .post('/admin/cours')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ titre: 'Bootcamp', dateHeure: '2026-08-01T07:00:00Z', dureeMinutes: 50, placesMax: 12, coachId })
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

describe('POST /admin/packs/assigner', () => {
  it('assigns a pack to a member', async () => {
    const reg = await request(app).post('/auth/register').send({
      email: 'packassign@test.com', password: 'x', nom: 'A', prenom: 'B'
    })
    const u = await prisma.utilisateur.findUnique({ where: { email: 'packassign@test.com' } })
    const pack = await prisma.pack.create({ data: { nom: 'Pack Test', nbSessions: 3 } })

    const res = await request(app)
      .post('/admin/packs/assigner')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ utilisateurId: u!.id, packId: pack.id })
    expect(res.status).toBe(201)
    expect(res.body.sessionsRestantes).toBe(3)
  })
})
