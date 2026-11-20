import type { Request } from 'express'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js'
import { StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { config } from '../config.js'
import { SessionOAuthClientProvider } from '../auth/oauthProvider.js'
import { AuthRequiredError, NotConnectedError, PermissionDeniedError } from './errors.js'

interface CachedConnection {
  client: Client
  transport: StreamableHTTPClientTransport
  tools: Tool[]
  connectedAt: Date
}

const connectionsBySessionId = new Map<string, CachedConnection>()

function classifyConnectError(error: unknown): never {
  if (error instanceof UnauthorizedError) {
    throw new AuthRequiredError(error.message || undefined)
  }
  if (error instanceof StreamableHTTPError) {
    if (error.code === 401) throw new AuthRequiredError()
    if (error.code === 403) throw new PermissionDeniedError()
  }
  throw error instanceof Error ? error : new Error('Failed to connect to the iManage MCP server.')
}

async function establishConnection(req: Request): Promise<CachedConnection> {
  const provider = new SessionOAuthClientProvider(req)
  const transport = new StreamableHTTPClientTransport(new URL(config.imanageMcpUrl), {
    authProvider: provider,
  })
  const client = new Client({ name: 'ai-matters', version: '0.1.0' })

  try {
    await client.connect(transport)
  } catch (error) {
    classifyConnectError(error)
  }

  const { tools } = await client.listTools()
  const cached: CachedConnection = { client, transport, tools, connectedAt: new Date() }
  connectionsBySessionId.set(req.sessionID, cached)
  return cached
}

/**
 * Returns the live, authenticated MCP connection for this browser session,
 * reconnecting with the session's stored tokens if the in-memory cache was
 * dropped (e.g. after a server restart). Throws NotConnectedError if the
 * user has never completed authentication.
 */
export async function getConnection(req: Request): Promise<CachedConnection> {
  const cached = connectionsBySessionId.get(req.sessionID)
  if (cached) return cached

  if (!req.session.imanage?.tokens) {
    throw new NotConnectedError()
  }

  return establishConnection(req)
}

export async function disconnect(req: Request): Promise<void> {
  const cached = connectionsBySessionId.get(req.sessionID)
  connectionsBySessionId.delete(req.sessionID)
  if (cached) {
    try {
      await cached.transport.terminateSession()
    } catch {
      // Best-effort: the server may not support explicit session termination.
    }
    await cached.client.close().catch(() => undefined)
  }
  if (req.session.imanage) {
    req.session.imanage.tokens = undefined
    req.session.imanage.codeVerifier = undefined
    req.session.imanage.discoveryState = undefined
  }
}
