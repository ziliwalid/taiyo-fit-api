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
  await prisma.demandePack.deleteMany({})
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
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data[0].coach).toMatchObject({ nom: 'Joly', prenom: 'Malak' })
  })

  it('rejects unauthenticated', async () => {
    const res = await request(app).get('/cours')
    expect(res.status).toBe(401)
  })
})

describe('GET /cours/:id', () => {
  it('returns course with participants list and coach', async () => {
    const res = await request(app).get(`/cours/${coursId}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.participants).toBeDefined()
    expect(res.body.data.nbParticipants).toBe(0)
    expect(res.body.data.coach).toMatchObject({ nom: 'Joly', prenom: 'Malak' })
  })

  it('returns 404 for unknown cours', async () => {
    const res = await request(app).get('/cours/99999').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })
})

describe('POST /cours/:id/reserver', () => {
  it('creates reservation', async () => {
    const res = await request(app)
      .post(`/cours/${coursId}/reserver`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(201)
    expect(res.body.data.statut).toBe('EN_ATTENTE')
  })

  it('rejects duplicate reservation', async () => {
    const res = await request(app)
      .post(`/cours/${coursId}/reserver`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(409)
  })
})
