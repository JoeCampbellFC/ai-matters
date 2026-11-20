import session from 'express-session'
import type { OAuthClientInformationMixed, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'
import type { OAuthDiscoveryState } from '@modelcontextprotocol/sdk/client/auth.js'
import { config } from '../config.js'

export interface ImanageSessionData {
  clientInformation?: OAuthClientInformationMixed & { issuer?: string }
  tokens?: OAuthTokens & { issuer?: string }
  codeVerifier?: string
  state?: string
  discoveryState?: OAuthDiscoveryState
}

declare module 'express-session' {
  interface SessionData {
    imanage?: ImanageSessionData
  }
}

/**
 * MemoryStore is fine for local development (single process, short-lived
 * sessions) but does not scale across processes and leaks memory over time.
 * Before deploying this application, swap in a persistent, shared session
 * store (e.g. Redis via connect-redis) and ensure SESSION_SECRET is a long,
 * random value injected from a secrets manager rather than source control.
 */
export function createSessionMiddleware() {
  return session({
    name: config.sessionCookieName,
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 12,
    },
  })
}
