export interface IdTokenClaims {
  sub?: string
  name?: string
  email?: string
}

/**
 * Decodes (without verifying) the payload of an OIDC id_token purely for
 * display in the UI. The MCP connection itself is what proves the user is
 * authenticated; this is never used to make an authorization decision.
 */
export function decodeIdTokenClaims(idToken: string | undefined): IdTokenClaims | undefined {
  if (!idToken) return undefined
  const parts = idToken.split('.')
  if (parts.length < 2) return undefined

  try {
    const payload = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    const claims = JSON.parse(payload) as Record<string, unknown>
    return {
      sub: typeof claims.sub === 'string' ? claims.sub : undefined,
      name: typeof claims.name === 'string' ? claims.name : undefined,
      email: typeof claims.email === 'string' ? claims.email : undefined,
    }
  } catch {
    return undefined
  }
}
