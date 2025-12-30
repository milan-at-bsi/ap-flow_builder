import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import YAML from 'yamljs'
import path from 'path'
import flowsRouter from './routes/flows'
import aiRouter from './routes/ai'
import { testConnection } from './db'

const app = express()

// Load OpenAPI spec
const swaggerDocument = YAML.load(path.join(__dirname, '../openapi.yaml'))
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Routes
app.use('/api/flows', flowsRouter)
app.use('/api/ai', aiRouter)

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Protocol Builder API'
}))

// Serve OpenAPI spec as JSON
app.get('/openapi.json', (req, res) => {
  res.json(swaggerDocument)
})

// Health check
app.get('/health', async (req, res) => {
  const dbConnected = await testConnection()
  res.json({
    status: dbConnected ? 'healthy' : 'unhealthy',
    database: dbConnected ? 'connected' : 'disconnected',
  })
})

// Start server
async function start() {
  // Try to connect to database (optional - AI features work without it)
  let dbConnected = false
  let retries = 3
  while (retries > 0) {
    dbConnected = await testConnection()
    if (dbConnected) {
      console.log('Database connected')
      break
    }
    console.log(`Database not available, retrying... (${retries} retries left)`)
    retries--
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  if (!dbConnected) {
    console.log('⚠️  Starting without database - flow saving/loading disabled, AI features available')
  }

  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`)
    console.log(`API docs: http://localhost:${PORT}/api-docs`)
  })
}

start()
