import prisma from './prisma'

export function logSession(
  utilisateurId: number,
  variation: number,
  motif: string,
  coursId?: number,
) {
  prisma.historiqueSession.create({
    data: { utilisateurId, variation, motif, ...(coursId ? { coursId } : {}) },
  }).catch(() => {})
}
