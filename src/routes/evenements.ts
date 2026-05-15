import { Router } from 'express'
import { listEvenements } from '../controllers/evenementController'

const router = Router()

router.get('/', listEvenements)

export default router
