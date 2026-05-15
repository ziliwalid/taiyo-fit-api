import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { coachOnly } from '../middleware/coachOnly'
import { getMesCours, getCoursParticipants } from '../controllers/coachController'

const router = Router()
router.use(requireAuth, coachOnly)

/**
 * @openapi
 * /coach/mes-cours:
 *   get:
 *     tags: [Coach]
 *     summary: Liste des cours assignés au coach connecté
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Liste des cours du coach avec nb participants
 *       403:
 *         description: Accès réservé aux coachs
 */
router.get('/mes-cours', getMesCours)

/**
 * @openapi
 * /coach/cours/{id}/participants:
 *   get:
 *     tags: [Coach]
 *     summary: Participants inscrits à un cours du coach connecté
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Liste nom/prénom/téléphone des participants
 *       403:
 *         description: Accès réservé aux coachs
 */
router.get('/cours/:id/participants', getCoursParticipants)

export default router
