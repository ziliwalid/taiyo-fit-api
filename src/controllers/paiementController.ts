import { Request, Response } from 'express'
import { StatutPaiement } from '@prisma/client'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'
import stripe from '../lib/stripe'
import { logSession } from '../lib/logSession'
import { sendValidationConfirmationToMembre } from '../services/mailer'

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000'

// ─── POST /paiement/checkout ──────────────────────────────────────────────────
// Creates a Stripe Checkout Session and returns the redirect URL.

export async function createCheckoutSession(req: AuthRequest, res: Response) {
  const { packId } = req.body
  if (!packId) {
    res.status(400).json({ success: false, message: 'packId requis' })
    return
  }

  const [pack, user] = await Promise.all([
    prisma.pack.findUnique({ where: { id: packId } }),
    prisma.utilisateur.findUnique({ where: { id: req.user!.id } }),
  ])

  if (!pack) { res.status(404).json({ success: false, message: 'Pack introuvable' }); return }
  if (!user)  { res.status(404).json({ success: false, message: 'Utilisateur introuvable' }); return }
  if (!pack.tarif) {
    res.status(400).json({ success: false, message: 'Ce pack est sur demande manuelle uniquement.' })
    return
  }

  // Guard: already has an active pack
  const compteActif = await prisma.comptePack.findUnique({ where: { utilisateurId: user.id } })
  if (compteActif && compteActif.sessionsRestantes > 0) {
    res.status(409).json({
      success: false,
      message: `Tu as déjà un pack actif avec ${compteActif.sessionsRestantes} session(s) restante(s).`,
    })
    return
  }

  // Guard: already has a pending payment (prevent duplicate sessions)
  const paiementEnAttente = await prisma.paiement.findFirst({
    where: { utilisateurId: user.id, statut: StatutPaiement.EN_ATTENTE },
  })
  if (paiementEnAttente) {
    res.status(409).json({
      success: false,
      message: 'Tu as déjà un paiement en cours. Vérifie ta boîte mail ou attends quelques minutes.',
    })
    return
  }

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    customer_email: user.email,
    locale: 'fr',
    line_items: [{
      price_data: {
        currency: 'eur',
        unit_amount: Math.round(pack.tarif * 100), // Stripe works in cents
        product_data: {
          name: pack.nom,
          description: pack.description ?? `${pack.nbSessions} sessions Taiyo Fit`,
        },
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${FRONTEND_URL}/packs/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${FRONTEND_URL}/packs?cancelled=1`,
    metadata: {
      utilisateurId: String(user.id),
      packId:        String(pack.id),
    },
    // Session expires after 30 minutes
    expires_at: Math.floor(Date.now() / 1000) + 1800,
  })

  // Persist payment record (EN_ATTENTE until webhook confirms)
  await prisma.paiement.create({
    data: {
      utilisateurId:   user.id,
      packId:          pack.id,
      stripeSessionId: session.id,
      montant:         pack.tarif,
    },
  })

  res.json({ success: true, url: session.url })
}

// ─── POST /paiement/webhook ───────────────────────────────────────────────────
// Stripe calls this endpoint. Body must be raw (no JSON parsing).
// Registered in app.ts with express.raw() BEFORE express.json().

export async function stripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'] as string

  let event: ReturnType<typeof stripe.webhooks.constructEvent>
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch {
    res.status(400).json({ error: 'Webhook signature invalide' })
    return
  }

  // ── Payment succeeded ────────────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as { id: string; payment_intent: string | null }

    const paiement = await prisma.paiement.findUnique({
      where:   { stripeSessionId: session.id },
      include: { pack: true, utilisateur: true },
    })

    // Idempotency: skip if already successfully processed
    if (!paiement || paiement.statut === StatutPaiement.REUSSI) {
      res.json({ received: true })
      return
    }

    // Atomic: mark payment + activate (or renew) pack
    await prisma.$transaction([
      prisma.paiement.update({
        where: { id: paiement.id },
        data:  {
          statut:         StatutPaiement.REUSSI,
          stripePaymentId: session.payment_intent as string,
        },
      }),
      prisma.comptePack.upsert({
        where:  { utilisateurId: paiement.utilisateurId },
        update: { packId: paiement.packId, sessionsRestantes: paiement.pack.nbSessions },
        create: { utilisateurId: paiement.utilisateurId, packId: paiement.packId, sessionsRestantes: paiement.pack.nbSessions },
      }),
    ])

    logSession(paiement.utilisateurId, paiement.pack.nbSessions, `Achat pack (Stripe) · ${paiement.pack.nom}`)

    // Fire-and-forget confirmation email — webhook must not fail on email error
    sendValidationConfirmationToMembre({
      membrePrenom:    paiement.utilisateur.prenom,
      membreNom:       paiement.utilisateur.nom,
      membreEmail:     paiement.utilisateur.email,
      membreTelephone: paiement.utilisateur.telephone,
      packNom:         paiement.pack.nom,
      packNbSessions:  paiement.pack.nbSessions,
      packDescription: paiement.pack.description,
    }).catch(() => {})
  }

  // ── Session expired before payment ──────────────────────────────────────
  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as { id: string; payment_intent: string | null }
    await prisma.paiement.updateMany({
      where: { stripeSessionId: session.id, statut: StatutPaiement.EN_ATTENTE },
      data:  { statut: StatutPaiement.ECHOUE },
    })
  }

  res.json({ received: true })
}

// ─── GET /paiement/session/:sessionId ────────────────────────────────────────
// Called by the success page to show confirmation details.

export async function getSession(req: AuthRequest, res: Response) {
  const sessionId = req.params.sessionId as string

  const paiement = await prisma.paiement.findUnique({
    where: { stripeSessionId: sessionId },
  })

  if (!paiement || paiement.utilisateurId !== req.user!.id) {
    res.status(404).json({ success: false, message: 'Session introuvable' })
    return
  }

  const [stripeSession, pack] = await Promise.all([
    stripe.checkout.sessions.retrieve(sessionId),
    prisma.pack.findUnique({ where: { id: paiement.packId } }),
  ])

  if (!pack) {
    res.status(404).json({ success: false, message: 'Pack introuvable' })
    return
  }

  res.json({
    success: true,
    data: {
      statut:       paiement.statut,
      stripeStatus: stripeSession.payment_status,
      packNom:      pack.nom,
      nbSessions:   pack.nbSessions,
      montant:      paiement.montant,
    },
  })
}
