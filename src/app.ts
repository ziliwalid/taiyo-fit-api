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

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

app.use('/auth',       authRoutes)
app.use('/cours',      coursRoutes)
app.use('/mon-compte', packRoutes)
app.use('/admin',      adminRoutes)
app.use('/coach',      coachRoutes)
app.use('/paiement',   paiementRoutes)
app.get('/packs',      listPacks)

app.get('/health', (_, res) => res.json({ ok: true }))

export default app
