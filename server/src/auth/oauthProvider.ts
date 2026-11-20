import crypto from 'node:crypto'
import type { Request } from 'express'
import type { OAuthClientProvider, OAuthDiscoveryState } from '@modelcontextprotocol/sdk/client/auth.js'
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'
import { config } from '../config.js'

/**
 * Server-side OAuthClientProvider backed by the Express session for a single
 * browser user. Tokens, the PKCE verifier and DCR client registration never
 * leave the server process; the browser only ever holds an httpOnly session
 * cookie that references them.
 */
export class SessionOAuthClientProvider implements OAuthClientProvider {
  private lastAuthorizationUrl: URL | undefined

  constructor(private readonly req: Request) {}

  private get store() {
    this.req.session.imanage ??= {}
    return this.req.session.imanage
  }

  get redirectUrl(): string {
    return config.oauthRedirectUrl
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [config.oauthRedirectUrl],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      client_name: 'AI Matters',
      client_uri: config.frontendUrl,
      scope: 'read',
    }
  }

  clientInformation(): OAuthClientInformationMixed | undefined {
    return this.store.clientInformation
  }

  saveClientInformation(clientInformation: OAuthClientInformationMixed): void {
    this.store.clientInformation = { ...clientInformation }
  }

  tokens(): OAuthTokens | undefined {
    return this.store.tokens
  }

  saveTokens(tokens: OAuthTokens & { issuer?: string }): void {
    this.store.tokens = { ...tokens }
  }

  redirectToAuthorization(authorizationUrl: URL): void {
    this.lastAuthorizationUrl = authorizationUrl
  }

  /** Read by the /api/auth/connect route after calling auth() to issue the actual HTTP redirect. */
  consumeAuthorizationUrl(): URL | undefined {
    const url = this.lastAuthorizationUrl
    this.lastAuthorizationUrl = undefined
    return url
  }

  saveCodeVerifier(codeVerifier: string): void {
    this.store.codeVerifier = codeVerifier
  }

  codeVerifier(): string {
    const verifier = this.store.codeVerifier
    if (!verifier) {
      throw new Error('No PKCE code verifier found for this session.')
    }
    return verifier
  }

  state(): string {
    const state = crypto.randomBytes(24).toString('hex')
    this.store.state = state
    return state
  }

  /** Validates the `state` query parameter returned by the authorization server (CSRF protection). */
  verifyState(candidate: string | undefined): boolean {
    const expected = this.store.state
    this.store.state = undefined
    return Boolean(expected) && Boolean(candidate) && expected === candidate
  }

  saveDiscoveryState(state: OAuthDiscoveryState): void {
    this.store.discoveryState = state
  }

  discoveryState(): OAuthDiscoveryState | undefined {
    return this.store.discoveryState
  }

  invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery'): void {
    if (scope === 'all' || scope === 'client') this.store.clientInformation = undefined
    if (scope === 'all' || scope === 'tokens') this.store.tokens = undefined
    if (scope === 'all' || scope === 'verifier') this.store.codeVerifier = undefined
    if (scope === 'all' || scope === 'discovery') this.store.discoveryState = undefined
  }
}
