import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { createCheckoutSession, getSession } from '../controllers/paiementController'

// NOTE: /paiement/webhook is NOT here — it needs express.raw() and is
// registered directly in app.ts BEFORE express.json().

const router = Router()
router.use(requireAuth)

router.post('/checkout', createCheckoutSession)
router.get('/session/:sessionId', getSession)

export default router
