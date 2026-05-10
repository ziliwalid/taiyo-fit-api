import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { coachOnly } from '../middleware/coachOnly'
import { getMesCours, getCoursParticipants } from '../controllers/coachController'

const router = Router()
router.use(requireAuth, coachOnly)

router.get('/mes-cours', getMesCours)
router.get('/cours/:id/participants', getCoursParticipants)

export default router
