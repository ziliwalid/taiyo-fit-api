import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { adminOnly } from '../middleware/adminOnly'
import { getParticipants, updateReservation, createCours, createPack, assignPack } from '../controllers/adminController'

const router = Router()
router.use(requireAuth, adminOnly)
router.get('/cours/:id/participants', getParticipants)
router.patch('/reservations/:id', updateReservation)
router.post('/cours', createCours)
router.post('/packs', createPack)
router.post('/packs/assigner', assignPack)
export default router
