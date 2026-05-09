import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { listCours, getCours, reserver } from '../controllers/coursController'

const router = Router()
router.use(requireAuth)
router.get('/', listCours)
router.get('/:id', getCours)
router.post('/:id/reserver', reserver)
export default router
