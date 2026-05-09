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
    expect(res.body.data.sessionsRestantes).toBe(7)
    expect(res.body.data.pack.nom).toBe('Pack 10')
  })

  it('returns 404 when no active pack', async () => {
    const reg = await request(app).post('/auth/register').send({
      email: 'nopack@test.com', password: 'secret', nom: 'No', prenom: 'Pack'
    })
    const res = await request(app).get('/mon-compte/pack').set('Authorization', `Bearer ${reg.body.token}`)
    expect(res.status).toBe(404)
  })
})
