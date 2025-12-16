import express from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import YAML from 'yamljs'
import path from 'path'
import flowsRouter from './routes/flows'
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
  // Wait for database connection
  let retries = 10
  while (retries > 0) {
    const connected = await testConnection()
    if (connected) {
      console.log('Database connected')
      break
    }
    console.log(`Waiting for database... (${retries} retries left)`)
    retries--
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`)
  })
}

start()
