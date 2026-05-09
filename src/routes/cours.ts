import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { listCours, getCours, reserver } from '../controllers/coursController'

const router = Router()
router.use(requireAuth)

/**
 * @openapi
 * /cours:
 *   get:
 *     tags: [Cours]
 *     summary: Lister tous les cours
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Liste des cours avec le nom du coach
 *       401:
 *         description: Non authentifié
 */
router.get('/', listCours)

/**
 * @openapi
 * /cours/{id}:
 *   get:
 *     tags: [Cours]
 *     summary: Détail d'un cours (participants, places restantes)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Cours avec liste des participants et places restantes
 *       404:
 *         description: Cours introuvable
 */
router.get('/:id', getCours)

/**
 * @openapi
 * /cours/{id}/reserver:
 *   post:
 *     tags: [Cours]
 *     summary: Réserver une place dans un cours
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       201:
 *         description: Réservation créée (EN_ATTENTE de confirmation par Malak)
 *       409:
 *         description: Cours complet ou déjà inscrit
 */
router.post('/:id/reserver', reserver)

export default router
