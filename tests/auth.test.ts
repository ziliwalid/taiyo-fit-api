import request from 'supertest'
import app from '../src/app'
import prisma from '../src/lib/prisma'

// Helper: register + verify email + login → returns JWT token
async function createVerifiedUser(email: string, password = 'secret123') {
  await request(app).post('/auth/register').send({
    email, password, nom: 'Test', prenom: 'User', telephone: '0600000000',
  })
  await prisma.utilisateur.update({ where: { email }, data: { emailVerifie: true } })
  const login = await request(app).post('/auth/login').send({ email, password })
  return login.body.token as string
}

afterAll(async () => {
  await prisma.messageCours.deleteMany({})
  await prisma.noteCours.deleteMany({})
  await prisma.historiqueSession.deleteMany({})
  await prisma.reservation.deleteMany({})
  await prisma.paiement.deleteMany({})
  await prisma.demandePack.deleteMany({})
  await prisma.comptePack.deleteMany({})
  await prisma.utilisateur.deleteMany({ where: { email: { contains: '@test.com' } } })
  await prisma.$disconnect()
})

// ─── Register ─────────────────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  it('creates account and returns 201', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'register@test.com', password: 'secret123',
      nom: 'Martin', prenom: 'Marie', telephone: '0601020304',
    })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
  })

  it('rejects duplicate email with 409', async () => {
    await request(app).post('/auth/register').send({
      email: 'dup@test.com', password: 'secret123', nom: 'A', prenom: 'B', telephone: '0600000000',
    })
    const res = await request(app).post('/auth/register').send({
      email: 'dup@test.com', password: 'secret123', nom: 'A', prenom: 'B', telephone: '0600000000',
    })
    expect(res.status).toBe(409)
  })

  it('rejects missing fields with 400', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'x@test.com' })
    expect(res.status).toBe(400)
  })

  it('rejects password shorter than 6 chars with 400', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'short@test.com', password: '123', nom: 'A', prenom: 'B', telephone: '0600000000',
    })
    expect(res.status).toBe(400)
  })
})

// ─── Login ────────────────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  beforeAll(async () => {
    await request(app).post('/auth/register').send({
      email: 'login@test.com', password: 'secret123', nom: 'X', prenom: 'Y', telephone: '0600000000',
    })
    await prisma.utilisateur.update({ where: { email: 'login@test.com' }, data: { emailVerifie: true } })
  })

  it('returns JWT token with valid credentials', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'login@test.com', password: 'secret123',
    })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
  })

  it('rejects unverified email with 403 and code EMAIL_NOT_VERIFIED', async () => {
    await request(app).post('/auth/register').send({
      email: 'unverified@test.com', password: 'secret123', nom: 'A', prenom: 'B', telephone: '0600000000',
    })
    const res = await request(app).post('/auth/login').send({
      email: 'unverified@test.com', password: 'secret123',
    })
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED')
  })

  it('rejects wrong password with 401', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'login@test.com', password: 'wrong',
    })
    expect(res.status).toBe(401)
  })

  it('rejects unknown email with 401', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'ghost@test.com', password: 'x',
    })
    expect(res.status).toBe(401)
  })
})

// ─── Forgot password ──────────────────────────────────────────────────────────

describe('POST /auth/forgot-password', () => {
  beforeAll(async () => {
    await request(app).post('/auth/register').send({
      email: 'forgot@test.com', password: 'secret123', nom: 'A', prenom: 'B', telephone: '0600000000',
    })
    await prisma.utilisateur.update({ where: { email: 'forgot@test.com' }, data: { emailVerifie: true } })
  })

  it('always returns 200 for existing email (anti-enumeration)', async () => {
    const res = await request(app).post('/auth/forgot-password').send({ email: 'forgot@test.com' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('always returns 200 for unknown email (anti-enumeration)', async () => {
    const res = await request(app).post('/auth/forgot-password').send({ email: 'nobody@test.com' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('sets tokenReset in DB for existing user', async () => {
    await request(app).post('/auth/forgot-password').send({ email: 'forgot@test.com' })
    const user = await prisma.utilisateur.findUnique({ where: { email: 'forgot@test.com' } })
    expect(user?.tokenReset).toBeTruthy()
    expect(user?.tokenResetExpires).toBeTruthy()
  })
})

// ─── Reset password ───────────────────────────────────────────────────────────

describe('POST /auth/reset-password', () => {
  const email = 'reset@test.com'
  const oldPassword = 'secret123'
  const newPassword = 'newpass456'

  beforeAll(async () => {
    await request(app).post('/auth/register').send({
      email, password: oldPassword, nom: 'R', prenom: 'S', telephone: '0600000000',
    })
    await prisma.utilisateur.update({ where: { email }, data: { emailVerifie: true } })
  })

  it('rejects invalid token with 400', async () => {
    const res = await request(app).post('/auth/reset-password').send({
      token: 'invalid-token', password: newPassword,
    })
    expect(res.status).toBe(400)
  })

  it('rejects expired token with 400 and code TOKEN_EXPIRED', async () => {
    const expiredToken = 'expiredtoken123'
    await prisma.utilisateur.update({
      where: { email },
      data: { tokenReset: expiredToken, tokenResetExpires: new Date(Date.now() - 1000) },
    })
    const res = await request(app).post('/auth/reset-password').send({
      token: expiredToken, password: newPassword,
    })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('TOKEN_EXPIRED')
  })

  it('rejects password shorter than 6 chars with 400', async () => {
    const shortPassToken = 'shortpasstoken456'
    await prisma.utilisateur.update({
      where: { email },
      data: { tokenReset: shortPassToken, tokenResetExpires: new Date(Date.now() + 60_000) },
    })
    const res = await request(app).post('/auth/reset-password').send({
      token: shortPassToken, password: '123',
    })
    expect(res.status).toBe(400)
  })

  it('rejects missing fields with 400', async () => {
    const res = await request(app).post('/auth/reset-password').send({ token: 'sometoken' })
    expect(res.status).toBe(400)
  })

  it('full flow: forgot → reset → login with new password', async () => {
    // 1. Request reset
    await request(app).post('/auth/forgot-password').send({ email })

    // 2. Get token from DB
    const user = await prisma.utilisateur.findUnique({ where: { email } })
    expect(user?.tokenReset).toBeTruthy()

    // 3. Reset password
    const resetRes = await request(app).post('/auth/reset-password').send({
      token: user!.tokenReset, password: newPassword,
    })
    expect(resetRes.status).toBe(200)
    expect(resetRes.body.success).toBe(true)

    // 4. Token must be cleared in DB
    const updatedUser = await prisma.utilisateur.findUnique({ where: { email } })
    expect(updatedUser?.tokenReset).toBeNull()
    expect(updatedUser?.tokenResetExpires).toBeNull()

    // 5. Login with new password succeeds
    const loginNew = await request(app).post('/auth/login').send({ email, password: newPassword })
    expect(loginNew.status).toBe(200)
    expect(loginNew.body.token).toBeDefined()

    // 6. Old password no longer works
    const loginOld = await request(app).post('/auth/login').send({ email, password: oldPassword })
    expect(loginOld.status).toBe(401)
  })

  it('token cannot be reused after reset', async () => {
    // Get a fresh token
    await request(app).post('/auth/forgot-password').send({ email })
    const user = await prisma.utilisateur.findUnique({ where: { email } })
    const token = user!.tokenReset!

    // Use it once
    await request(app).post('/auth/reset-password').send({ token, password: 'anotherpass' })

    // Try to reuse it
    const res = await request(app).post('/auth/reset-password').send({ token, password: 'yetanotherpass' })
    expect(res.status).toBe(400)
  })
})
