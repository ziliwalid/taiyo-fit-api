import { z } from 'zod'
import { Response } from 'express'

export function parseId(param: unknown, res: Response): number | null {
  const result = z.coerce.number().int().positive().safeParse(param)
  if (!result.success) {
    res.status(400).json({ success: false, message: 'Identifiant invalide.' })
    return null
  }
  return result.data
}

export function zodFail(res: Response, err: z.ZodError<unknown>): void {
  const message = err.issues.map((e: z.ZodIssue) => e.message).join(', ')
  res.status(400).json({ success: false, message })
}
