import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { adminOnly } from '../middleware/adminOnly'
import { parseId } from '../lib/validate'
import { getParticipants, updateReservation, createCours, listAllCours, createPack, updatePack, deletePack, adminListPacks, togglePackActif, assignPack, createCoach, listCoaches, updateCoach, updateStatutSeance, listMembres, listCoachesDetailed, toggleActif, getStats, listTransactions, listNotifications, marquerNotificationsLues } from '../controllers/adminController'
import { listDemandes, validerDemande, refuserDemande } from '../controllers/demandePackController'
import { adminListEvenements, createEvenement, updateEvenement, deleteEvenement } from '../controllers/evenementController'
import { adminListLieux, createLieu, toggleLieu, deleteLieu, updateMapSettings } from '../controllers/lieuController'
import { listAvisAdmin, deleteAvis, updateAvisSettings } from '../controllers/avisController'

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
 * /admin/cours/{id}/statut:
 *   patch:
 *     tags: [Admin]
 *     summary: Modifier le statut d'une séance (PLANIFIE, EN_RETARD, LIEU_MODIFIE, ANNULE, EFFECTUE)
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
 *               statutSeance:  { type: string, enum: [PLANIFIE, EN_RETARD, LIEU_MODIFIE, ANNULE, EFFECTUE] }
 *               messageCoach:  { type: string, nullable: true }
 *               adresse:       { type: string, nullable: true }
 *               imageUrl:      { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Statut mis à jour. Si ANNULE, toutes les réservations sont annulées et les sessions remboursées.
 *       409:
 *         description: Cours déjà annulé ou effectué — modification impossible
 */
router.patch('/cours/:id/statut', updateStatutSeance)

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
router.get('/cours', listAllCours)
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
/**
 * @openapi
 * /admin/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Statistiques globales (revenus, adhérents, séances, demandes en attente)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *         description: Date de début (ISO)
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *         description: Date de fin (ISO)
 *     responses:
 *       200:
 *         description: Stats revenus, adhérents, séances et demandes
 */
router.get('/stats', getStats)

/**
 * @openapi
 * /admin/transactions:
 *   get:
 *     tags: [Admin]
 *     summary: Liste des paiements Stripe avec filtres optionnels
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: statut
 *         schema: { type: string, enum: [EN_ATTENTE, REUSSI, ECHOUE, REMBOURSE] }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Liste des transactions avec utilisateur et pack associés
 */
router.get('/transactions', listTransactions)

/**
 * @openapi
 * /admin/packs:
 *   get:
 *     tags: [Admin]
 *     summary: Liste tous les packs (actifs et inactifs)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Liste complète des packs
 */
router.get('/packs', adminListPacks)
router.post('/packs', createPack)

/**
 * @openapi
 * /admin/packs/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Modifier un pack (nom, sessions, tarif, description, tag)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nom:         { type: string }
 *               nbSessions:  { type: integer }
 *               tarif:       { type: number, nullable: true }
 *               ancienTarif: { type: number, nullable: true }
 *               description: { type: string, nullable: true }
 *               tag:         { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Pack mis à jour
 *       404:
 *         description: Pack introuvable
 */
router.patch('/packs/:id', updatePack)

/**
 * @openapi
 * /admin/packs/{id}/actif:
 *   patch:
 *     tags: [Admin]
 *     summary: Activer ou désactiver un pack (toggle)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Statut actif basculé
 */
router.patch('/packs/:id/actif', togglePackActif)

/**
 * @openapi
 * /admin/packs/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Supprimer un pack (bloqué si des paiements Stripe y sont liés)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Pack supprimé
 *       409:
 *         description: Pack lié à des paiements Stripe — suppression impossible
 */
router.delete('/packs/:id', deletePack)

/**
 * @openapi
 * /admin/coachs:
 *   get:
 *     tags: [Admin]
 *     summary: Liste simplifiée des coachs (id, nom, prénom)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Liste des coachs
 */
router.get('/coachs', listCoaches)

/**
 * @openapi
 * /admin/membres:
 *   get:
 *     tags: [Admin]
 *     summary: Liste tous les adhérents avec leur pack et statut
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Liste des membres avec comptePack et statut actif
 */
router.get('/membres', listMembres)

/**
 * @openapi
 * /admin/coachs/details:
 *   get:
 *     tags: [Admin]
 *     summary: Liste détaillée des coachs avec nombre de cours assignés
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Liste des coachs avec email, téléphone et cours
 */
router.get('/coachs/details', listCoachesDetailed)

/**
 * @openapi
 * /admin/utilisateurs/{id}/actif:
 *   patch:
 *     tags: [Admin]
 *     summary: Bloquer ou débloquer un utilisateur (toggle actif)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Statut actif basculé
 *       404:
 *         description: Utilisateur introuvable
 */
router.patch('/utilisateurs/:id/actif', toggleActif)

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
/**
 * @openapi
 * /admin/coachs:
 *   post:
 *     tags: [Admin]
 *     summary: Créer un compte coach (Utilisateur COACH + Coach liés)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nom, prenom, email, password]
 *             properties:
 *               nom:       { type: string, example: Dupont }
 *               prenom:    { type: string, example: Sarah }
 *               email:     { type: string, example: sarah@taiyofit.com }
 *               password:  { type: string, example: coach2026 }
 *               telephone: { type: string, example: "0612345678" }
 *     responses:
 *       201:
 *         description: Compte coach créé avec userId et coachId
 *       409:
 *         description: Email déjà utilisé
 */
router.post('/coachs', createCoach)

/**
 * @openapi
 * /admin/coachs/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Modifier le nom et/ou prénom d'un coach
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
 *               nom:    { type: string, example: "Taiyo Fit" }
 *               prenom: { type: string, example: "Malak" }
 *     responses:
 *       200:
 *         description: Coach mis à jour
 *       404:
 *         description: Coach introuvable
 */
router.patch('/coachs/:id', updateCoach)

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

/**
 * @openapi
 * /admin/evenements:
 *   get:
 *     tags: [Admin]
 *     summary: Liste tous les événements (publics et privés)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Liste complète des événements
 *   post:
 *     tags: [Admin]
 *     summary: Créer un événement
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [titre, contenu]
 *             properties:
 *               titre:         { type: string }
 *               contenu:       { type: string }
 *               imageUrl:      { type: string, nullable: true }
 *               dateEvenement: { type: string, format: date-time, nullable: true }
 *               tag:           { type: string, nullable: true }
 *               estPublic:     { type: boolean }
 *               epingle:       { type: boolean }
 *     responses:
 *       201:
 *         description: Événement créé
 */
router.get('/evenements',       adminListEvenements)
router.post('/evenements',      createEvenement)

/**
 * @openapi
 * /admin/evenements/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Modifier un événement
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Événement mis à jour
 *       404:
 *         description: Événement introuvable
 *   delete:
 *     tags: [Admin]
 *     summary: Supprimer un événement
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Événement supprimé
 */
router.patch('/evenements/:id', updateEvenement)
router.delete('/evenements/:id',deleteEvenement)

/**
 * @openapi
 * /admin/notifications:
 *   get:
 *     tags: [Admin]
 *     summary: Liste les notifications in-app (non lues en premier)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Liste des notifications avec statut lu/non lu
 */
router.get('/notifications',        listNotifications)

/**
 * @openapi
 * /admin/notifications/lire:
 *   patch:
 *     tags: [Admin]
 *     summary: Marquer toutes les notifications comme lues
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Toutes les notifications marquées comme lues
 */
router.patch('/notifications/lire', marquerNotificationsLues)

/**
 * @openapi
 * /admin/membres/{id}/historique:
 *   get:
 *     tags: [Admin]
 *     summary: Historique des mouvements de sessions d'un membre (50 derniers)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Liste des mouvements avec variation, motif et date
 */
router.get('/membres/:id/historique', async (req, res) => {
  const id = parseId(req.params.id, res)
  if (id === null) return
  const { default: prisma } = await import('../lib/prisma')
  const historique = await prisma.historiqueSession.findMany({
    where: { utilisateurId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, variation: true, motif: true, createdAt: true },
  })
  res.json({ success: true, message: 'OK', data: historique })
})

// ─── Carte / lieux ───────────────────────────────────────────────────────────
router.get('/lieux',               adminListLieux)
router.post('/lieux',              createLieu)
router.patch('/lieux/:id/toggle',  toggleLieu)
router.delete('/lieux/:id',        deleteLieu)
router.patch('/lieux/settings',    updateMapSettings)
router.get('/avis',               listAvisAdmin)
router.delete('/avis/:id',        deleteAvis)
router.patch('/settings/avis',    updateAvisSettings)

export default router
