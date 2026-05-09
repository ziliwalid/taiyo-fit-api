import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { adminOnly } from '../middleware/adminOnly'
import { getParticipants, updateReservation, createCours, createPack, assignPack, updateStatutSeance } from '../controllers/adminController'
import { listDemandes, validerDemande, refuserDemande } from '../controllers/demandePackController'

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
 * /admin/cours/{id}/message:
 *   patch:
 *     tags: [Admin]
 *     summary: Mettre à jour le statut et/ou le message d'une séance
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
 *                 example: "Je suis en retard de 10 minutes, on commence à 10h15 !"
 *     responses:
 *       200:
 *         description: Statut et/ou message mis à jour
 *       404:
 *         description: Cours introuvable
 */
router.patch('/cours/:id/message', updateStatutSeance)

/**
 * @openapi
 * /admin/reservations/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Confirmer ou annuler une réservation de cours
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
 *     summary: Assigner directement un pack à un adhérent (sans demande)
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

/**
 * @openapi
 * /admin/packs/demandes:
 *   get:
 *     tags: [Admin]
 *     summary: Lister toutes les demandes de pack
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Liste des demandes avec infos adhérent et pack
 */
router.get('/packs/demandes', listDemandes)

/**
 * @openapi
 * /admin/packs/demandes/{id}/valider:
 *   patch:
 *     tags: [Admin]
 *     summary: Valider une demande de pack (active le pack + email au membre)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Demande validée, pack activé, email envoyé au membre
 *       404:
 *         description: Demande introuvable
 *       409:
 *         description: Demande déjà traitée
 */
router.patch('/packs/demandes/:id/valider', validerDemande)

/**
 * @openapi
 * /admin/packs/demandes/{id}/refuser:
 *   patch:
 *     tags: [Admin]
 *     summary: Refuser une demande de pack
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Demande refusée
 *       404:
 *         description: Demande introuvable
 *       409:
 *         description: Demande déjà traitée
 */
router.patch('/packs/demandes/:id/refuser', refuserDemande)

export default router
