import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import { createSessionMiddleware } from './auth/session.js'
import { authRouter } from './routes/auth.js'
import { mcpRouter } from './routes/mcp.js'
import { workspacesRouter } from './routes/workspaces.js'
import { librariesRouter } from './routes/libraries.js'
import { matterResearchRouter } from './routes/matterResearch.js'
import { matterProfileRouter } from './routes/matterProfile.js'
import { fieldDefinitionsRouter } from './routes/fieldDefinitions.js'
import { classifyError } from './httpErrors.js'
import { verifyAzureOpenAiConnectivity } from './llm/azureOpenAI.js'
import { sweepStaleRuns } from './matterResearch/runManager.js'
import { verifyDatabaseConnectivity } from './database/connection.js'
import { seedFieldDefinitions } from './database/repositories/fieldDefinitionRepository.js'

const app = express()

// The browser only ever talks to the Vite dev server (same-origin proxy) or,
// in production, whatever reverse proxy terminates TLS in front of this
// service — this CORS config is a defense-in-depth fallback for direct access.
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  }),
)
app.set('trust proxy', 1)
app.use(express.json())
app.use(createSessionMiddleware())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRouter)
app.use('/api/mcp', mcpRouter)
app.use('/api/workspaces', workspacesRouter)
app.use('/api/libraries', librariesRouter)
app.use('/api/matters', matterResearchRouter)
app.use('/api/matters', matterProfileRouter)
app.use('/api/field-definitions', fieldDefinitionsRouter)

// Populated only in the deployed package (the CI pipeline copies the built
// frontend here, see azure-pipelines.yml) -- absent in local dev, where Vite
// serves the frontend itself, so this block simply never matches anything.
const staticDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public')
const indexHtmlPath = path.join(staticDir, 'index.html')
const servesStaticFrontend = existsSync(indexHtmlPath)

if (servesStaticFrontend) {
  app.use(express.static(staticDir))
}

app.use((req, res) => {
  // SPA fallback: any non-API GET (a client-side route) serves the app shell, same as a real static host would.
  if (servesStaticFrontend && req.method === 'GET' && !req.path.startsWith('/api/')) {
    res.sendFile(indexHtmlPath)
    return
  }
  res.status(404).json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` } })
})

// Express 5 forwards rejected promises from async handlers here automatically.
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const { status, code, message } = classifyError(error)
  if (status >= 500) {
    console.error('[server] unhandled error', error)
  }
  res.status(status).json({ error: { code, message } })
})

app.listen(config.port, () => {
  console.log(`AI Matters backend listening on http://localhost:${config.port}`)
  console.log(`iManage MCP endpoint: ${config.imanageMcpUrl}`)
})

// Non-blocking: Phase 1 auth/workspace features must keep working even if
// Azure OpenAI is unreachable or not yet configured.
verifyAzureOpenAiConnectivity().catch((error) => {
  console.error('[server] Azure OpenAI connectivity check failed at startup:', (error as Error).message)
})

// Non-blocking for the same reason -- Phase 1 auth/workspace features don't
// depend on Postgres. seedFieldDefinitions() is idempotent (onConflictDoNothing),
// safe to run on every boot.
verifyDatabaseConnectivity()
  .then(() => seedFieldDefinitions())
  .catch((error) => {
    console.error('[server] Database connectivity/seed check failed at startup:', (error as Error).message)
  })

setInterval(sweepStaleRuns, 5 * 60 * 1000).unref()
