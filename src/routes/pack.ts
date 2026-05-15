import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { getMonPack, getMonDashboard, getHistoriqueSessions, getProfil, updateProfil } from '../controllers/packController'
import { demanderPack } from '../controllers/demandePackController'

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
router.get('/dashboard',  getMonDashboard)
router.get('/pack',       getMonPack)
router.get('/historique', getHistoriqueSessions)
router.get('/profil',     getProfil)
router.patch('/profil',   updateProfil)

/**
 * @openapi
 * /mon-compte/pack/demander:
 *   post:
 *     tags: [Mon compte]
 *     summary: Demander un pack (envoie un email à Malak + confirmation au membre)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [packId]
 *             properties:
 *               packId: { type: integer, example: 1 }
 *     responses:
 *       201:
 *         description: Demande enregistrée et emails envoyés
 *       404:
 *         description: Pack introuvable
 */
router.post('/pack/demander', demanderPack)

export default router
