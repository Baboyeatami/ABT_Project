import express from 'express'
import adminRouter from './admin.js'

const app = express()

app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

app.use('/api/admin', adminRouter)

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

export default app
