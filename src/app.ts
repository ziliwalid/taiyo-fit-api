import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import swaggerUi from 'swagger-ui-express'
import swaggerSpec from './swagger'
import authRoutes from './routes/auth'
import coursRoutes from './routes/cours'
import packRoutes from './routes/pack'
import adminRoutes from './routes/admin'
import coachRoutes from './routes/coach'
import paiementRoutes from './routes/paiement'
import evenementsRoutes from './routes/evenements'
import { stripeWebhook } from './controllers/paiementController'
import { listPacks } from './controllers/packController'
import { listLieux } from './controllers/lieuController'

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
}))

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de tentatives. Réessaie dans 15 minutes.' },
})

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de tentatives de paiement. Réessaie dans 15 minutes.' },
})

// ─── Stripe webhook — MUST be before express.json() ──────────────────────────
// Stripe requires the raw request body to verify the webhook signature.
// Registering this route first with express.raw() ensures it never gets
// JSON-parsed, regardless of the order of other middleware.
app.post(
  '/paiement/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhook,
)

// All other routes receive JSON-parsed bodies
app.use(express.json())

app.use('/api-docs', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const auth = req.headers.authorization
  if (auth?.startsWith('Basic ')) {
    const [user, pass] = Buffer.from(auth.slice(6), 'base64').toString().split(':')
    if (user === process.env.SWAGGER_USER && pass === process.env.SWAGGER_PASS) {
      return next()
    }
  }
  res.setHeader('WWW-Authenticate', 'Basic realm="Taiyo Fit API Docs"')
  res.status(401).send('Accès refusé.')
}, swaggerUi.serve, swaggerUi.setup(swaggerSpec))

app.use('/auth/login',  authLimiter)
app.use('/auth/register', authLimiter)
app.use('/paiement/checkout', checkoutLimiter)
app.use('/auth',        authRoutes)
app.use('/cours',       coursRoutes)
app.use('/mon-compte',  packRoutes)
app.use('/admin',       adminRoutes)
app.use('/coach',       coachRoutes)
app.use('/paiement',    paiementRoutes)
app.use('/evenements',  evenementsRoutes)
app.get('/packs',  listPacks)
app.get('/lieux',  listLieux)

app.get('/health', (_, res) => res.json({ ok: true }))

export default app
