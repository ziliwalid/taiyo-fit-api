import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { adminOnly } from '../middleware/adminOnly'
import { getParticipants, updateReservation, createCours, createPack, assignPack } from '../controllers/adminController'

const router = Router()
router.use(requireAuth, adminOnly)

/**
 * @openapi
 * /admin/cours/{id}/participants:
 *   get:
 *     tags: [Admin]
 *     summary: Liste des participants inscrits à un cours
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
 *         description: Accès refusé (admin seulement)
 */
router.get('/cours/:id/participants', getParticipants)

/**
 * @openapi
 * /admin/reservations/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Confirmer ou annuler une réservation
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [statut]
 *             properties:
 *               statut:
 *                 type: string
 *                 enum: [EN_ATTENTE, CONFIRME, ANNULE]
 *     responses:
 *       200:
 *         description: Réservation mise à jour
 *       400:
 *         description: Statut invalide
 */
router.patch('/reservations/:id', updateReservation)

/**
 * @openapi
 * /admin/cours:
 *   post:
 *     tags: [Admin]
 *     summary: Créer un nouveau cours
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [titre, dateHeure, dureeMinutes, placesMax, coachId]
 *             properties:
 *               titre:        { type: string, example: HIIT Cardio }
 *               dateHeure:    { type: string, format: date-time, example: "2026-06-01T10:00:00Z" }
 *               dureeMinutes: { type: integer, example: 45 }
 *               placesMax:    { type: integer, example: 12 }
 *               coachId:      { type: integer, example: 1 }
 *     responses:
 *       201:
 *         description: Cours créé
 *       400:
 *         description: Champs requis manquants
 */
router.post('/cours', createCours)

/**
 * @openapi
 * /admin/packs:
 *   post:
 *     tags: [Admin]
 *     summary: Créer un pack de sessions
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nom, nbSessions]
 *             properties:
 *               nom:         { type: string, example: Pack 10 }
 *               nbSessions:  { type: integer, example: 10 }
 *               description: { type: string, example: Pack découverte }
 *     responses:
 *       201:
 *         description: Pack créé
 *       400:
 *         description: Champs requis manquants
 */
router.post('/packs', createPack)

/**
 * @openapi
 * /admin/packs/assigner:
 *   post:
 *     tags: [Admin]
 *     summary: Assigner un pack à un adhérent
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [utilisateurId, packId]
 *             properties:
 *               utilisateurId: { type: integer, example: 3 }
 *               packId:        { type: integer, example: 1 }
 *     responses:
 *       201:
 *         description: Pack assigné avec sessions initialisées
 *       404:
 *         description: Pack ou adhérent introuvable
 */
router.post('/packs/assigner', assignPack)

export default router
