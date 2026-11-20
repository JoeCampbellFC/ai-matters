import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import { createSessionMiddleware } from './auth/session.js'
import { authRouter } from './routes/auth.js'
import { mcpRouter } from './routes/mcp.js'
import { workspacesRouter } from './routes/workspaces.js'
import { librariesRouter } from './routes/libraries.js'
import { classifyError } from './httpErrors.js'

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
app.use(createSessionMiddleware())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRouter)
app.use('/api/mcp', mcpRouter)
app.use('/api/workspaces', workspacesRouter)
app.use('/api/libraries', librariesRouter)

app.use((req, res) => {
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
