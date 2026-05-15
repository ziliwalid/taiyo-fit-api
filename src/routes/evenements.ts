import { Router } from 'express'
import { listEvenements } from '../controllers/evenementController'

const router = Router()

/**
 * @openapi
 * /evenements:
 *   get:
 *     tags: [Événements]
 *     summary: Liste les événements publics (triés par épinglé puis date)
 *     responses:
 *       200:
 *         description: Liste des événements publiés
 */
router.get('/', listEvenements)

export default router
