import dotenv from 'dotenv'
dotenv.config()
import app from './app'
import { startExpirePaiementsJob } from './jobs/expirePaiements'
import { verifyMailer } from './services/mailer'

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`Taiyo Fit API running on :${PORT}`)
  verifyMailer()
  startExpirePaiementsJob()
})
