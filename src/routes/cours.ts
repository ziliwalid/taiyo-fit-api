import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { adminOrCoach } from '../middleware/adminOrCoach'
import { listCours, getCours, reserver, annulerReservation, noterCours, getMessages, sendMessage } from '../controllers/coursController'
import { updateStatutSeance } from '../controllers/adminController'

const router = Router()

/**
 * @openapi
 * /cours:
 *   get:
 *     tags: [Cours]
 *     summary: Liste tous les cours à venir (public)
 *     responses:
 *       200:
 *         description: Liste des cours avec coach, places restantes et statut
 */
router.get('/', listCours)

/**
 * @openapi
 * /cours/{id}:
 *   get:
 *     tags: [Cours]
 *     summary: Détail d'un cours avec liste des participants (public)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Cours avec participants
 *       404:
 *         description: Cours introuvable
 */
router.get('/:id', getCours)

/**
 * @openapi
 * /cours/{id}/reserver:
 *   delete:
 *     tags: [Cours]
 *     summary: Annuler sa réservation (remboursement session si > 48h avant le cours)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Réservation annulée, session remboursée si délai respecté
 *       400:
 *         description: Délai de 48h dépassé
 *       404:
 *         description: Réservation introuvable
 */
router.post('/:id/reserver',   requireAuth, reserver)
router.delete('/:id/reserver', requireAuth, annulerReservation)

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

/**
 * @openapi
 * /cours/{id}/message:
 *   patch:
 *     tags: [Cours]
 *     summary: Poster un statut ou message sur une séance (coach ou admin)
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
 *             properties:
 *               statutSeance:
 *                 type: string
 *                 enum: [PLANIFIE, EN_RETARD, LIEU_MODIFIE, ANNULE]
 *               messageCoach:
 *                 type: string
 *                 example: "Je suis en retard de 10 min, on commence à 10h15 !"
 *     responses:
 *       200:
 *         description: Statut et/ou message mis à jour
 *       403:
 *         description: Réservé aux coachs et à l'admin
 */
router.patch('/:id/message', adminOrCoach, updateStatutSeance)
router.post('/:id/noter',    requireAuth, noterCours)
router.get('/:id/messages',  requireAuth, getMessages)
router.post('/:id/messages', requireAuth, sendMessage)

export default router
