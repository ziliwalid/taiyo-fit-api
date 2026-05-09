import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { getMonPack } from '../controllers/packController'

const router = Router()
router.use(requireAuth)
router.get('/pack', getMonPack)
export default router
