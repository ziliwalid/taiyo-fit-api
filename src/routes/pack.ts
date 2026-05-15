import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { getMonPack, getMonDashboard, getHistoriqueSessions, getProfil, updateProfil } from '../controllers/packController'
import { demanderPack } from '../controllers/demandePackController'

const router = Router()
router.use(requireAuth)

/**
 * @openapi
 * /mon-compte/dashboard:
 *   get:
 *     tags: [Mon compte]
 *     summary: Dashboard membre — pack, prochaines séances, stats
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Données dashboard (comptePack, prochaines réservations, stats)
 */
router.get('/dashboard',  getMonDashboard)

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
router.get('/pack',       getMonPack)

/**
 * @openapi
 * /mon-compte/historique:
 *   get:
 *     tags: [Mon compte]
 *     summary: Historique des mouvements de sessions (50 derniers)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Liste des mouvements avec variation, motif et date
 */
router.get('/historique', getHistoriqueSessions)

/**
 * @openapi
 * /mon-compte/profil:
 *   get:
 *     tags: [Mon compte]
 *     summary: Récupérer son profil (nom, prénom, email, téléphone)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Données du profil avec date de dernière modification
 */
router.get('/profil',     getProfil)

/**
 * @openapi
 * /mon-compte/profil:
 *   patch:
 *     tags: [Mon compte]
 *     summary: Modifier son profil (cooldown 48h entre chaque modification)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nom:             { type: string, example: Dupont }
 *               prenom:          { type: string, example: Sarah }
 *               email:           { type: string, example: sarah@example.com }
 *               telephone:       { type: string, example: "0612345678" }
 *               currentPassword: { type: string, example: monancienmdp }
 *               newPassword:     { type: string, example: monouveaumdp }
 *     responses:
 *       200:
 *         description: Profil mis à jour
 *       429:
 *         description: Cooldown 48h non écoulé — inclut prochainDispo dans data
 *       400:
 *         description: Validation échouée (email invalide, mot de passe incorrect…)
 *       409:
 *         description: Email déjà utilisé
 */
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
