import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'

afterAll(async () => {
  await prisma.demandePack.deleteMany({})
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

  it('rejects missing fields', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'x@test.com' })
    expect(res.status).toBe(400)
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

  it('rejects unknown email', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'ghost@test.com', password: 'x'
    })
    expect(res.status).toBe(401)
  })
})
