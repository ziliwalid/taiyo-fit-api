import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth'
import coursRoutes from './routes/cours'
import packRoutes from './routes/pack'
import adminRoutes from './routes/admin'

const app = express()
app.use(cors())
app.use(express.json())

app.use('/auth', authRoutes)
app.use('/cours', coursRoutes)
app.use('/mon-compte', packRoutes)
app.use('/admin', adminRoutes)

app.get('/health', (_, res) => res.json({ ok: true }))

export default app
