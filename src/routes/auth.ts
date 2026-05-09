import { Router } from 'express'
import { register, login } from '../controllers/authController'

const router = Router()

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Créer un compte adhérent
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, nom, prenom]
 *             properties:
 *               email:    { type: string, example: marie@example.com }
 *               password: { type: string, example: secret123 }
 *               nom:      { type: string, example: Martin }
 *               prenom:   { type: string, example: Marie }
 *               telephone: { type: string, example: "0601020304" }
 *     responses:
 *       201:
 *         description: Compte créé — retourne un token JWT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 token:   { type: string }
 *       400:
 *         description: Champs requis manquants
 *       409:
 *         description: Email déjà utilisé
 */
router.post('/register', register)

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Se connecter
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, example: marie@example.com }
 *               password: { type: string, example: secret123 }
 *     responses:
 *       200:
 *         description: Connexion réussie — retourne un token JWT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 token:   { type: string }
 *       401:
 *         description: Email ou mot de passe incorrect
 */
router.post('/login', login)

export default router
