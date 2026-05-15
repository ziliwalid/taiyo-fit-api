import express from 'express'
import cors from 'cors'
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

const app = express()
app.use(cors())

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

app.use('/api-docs', (req, res, next) => {
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

app.use('/auth',        authRoutes)
app.use('/cours',       coursRoutes)
app.use('/mon-compte',  packRoutes)
app.use('/admin',       adminRoutes)
app.use('/coach',       coachRoutes)
app.use('/paiement',    paiementRoutes)
app.use('/evenements',  evenementsRoutes)
app.get('/packs',       listPacks)

app.get('/health', (_, res) => res.json({ ok: true }))

export default app
