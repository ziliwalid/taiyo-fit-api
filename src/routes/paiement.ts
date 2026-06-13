import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { createCheckoutSession, getSession, cancelPendingPayment } from '../controllers/paiementController'

// NOTE: /paiement/webhook is NOT here — it needs express.raw() and is
// registered directly in app.ts BEFORE express.json().

const router = Router()
router.use(requireAuth)

/**
 * @openapi
 * /paiement/checkout:
 *   post:
 *     tags: [Paiement]
 *     summary: Créer une session Stripe Checkout pour acheter un pack
 *     description: Retourne une URL Stripe vers laquelle rediriger l'utilisateur. Le pack est activé automatiquement via webhook après paiement.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [packId]
 *             properties:
 *               packId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: URL Stripe Checkout
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 url:     { type: string, example: "https://checkout.stripe.com/pay/cs_test_..." }
 *       400:
 *         description: packId manquant ou pack sans tarif (demande manuelle uniquement)
 *       409:
 *         description: Pack actif existant ou paiement déjà en cours
 */
router.post('/checkout', createCheckoutSession)
router.post('/cancel', cancelPendingPayment)

/**
 * @openapi
 * /paiement/webhook:
 *   post:
 *     tags: [Paiement]
 *     summary: Webhook Stripe (usage interne)
 *     description: |
 *       Endpoint appelé par Stripe uniquement. Nécessite le header `Stripe-Signature` et un body raw.
 *       - `checkout.session.completed` → active le pack (transaction atomique)
 *       - `checkout.session.expired`   → marque le paiement ECHOUE
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Événement reçu et traité
 *       400:
 *         description: Signature webhook invalide
 */

/**
 * @openapi
 * /paiement/session/{sessionId}:
 *   get:
 *     tags: [Paiement]
 *     summary: Récupérer le statut d'une session de paiement
 *     description: Utilisé par la page /packs/success pour afficher la confirmation. Combine le statut DB et le statut Stripe live.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string }
 *         example: cs_test_a1b2c3...
 *     responses:
 *       200:
 *         description: Détails de la session et du pack
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     statut:      { type: string, enum: [EN_ATTENTE, REUSSI, ECHOUE, REMBOURSE] }
 *                     stripeStatus: { type: string, enum: [paid, unpaid, no_payment_required] }
 *                     packNom:     { type: string }
 *                     nbSessions:  { type: integer }
 *                     montant:     { type: number }
 *       404:
 *         description: Session introuvable ou n'appartient pas à l'utilisateur
 */
router.get('/session/:sessionId', getSession)

export default router
