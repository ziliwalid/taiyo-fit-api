import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { getMonPack } from '../controllers/packController'

const router = Router()
router.use(requireAuth)

/**
 * @openapi
 * /mon-compte/pack:
 *   get:
 *     tags: [Mon compte]
 *     summary: Voir son pack actif et le nombre de sessions restantes
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Pack actif avec sessions restantes
 *       404:
 *         description: Aucun pack actif
 */
router.get('/pack', getMonPack)

export default router
