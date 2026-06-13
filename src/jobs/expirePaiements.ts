import cron from 'node-cron'
import prisma from '../lib/prisma'

// Runs every 4 minutes — keeps Neon DB warm (prevents cold starts on free tier).
// Payment expiration is handled by Stripe's checkout.session.expired webhook,
// which retries for 72h — no cron needed.
export function startExpirePaiementsJob() {
  cron.schedule('*/4 * * * *', async () => {
    await prisma.$queryRaw`SELECT 1`
  })
}
