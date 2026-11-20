import 'dotenv/config'

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  frontendUrl: requireEnv('FRONTEND_URL', 'https://localhost:5173'),
  imanageMcpUrl: requireEnv('IMANAGE_MCP_URL', 'https://cloudimanage.com/mcp/work'),
  oauthRedirectUrl: requireEnv('OAUTH_REDIRECT_URL', 'https://localhost:5173/api/auth/callback'),
  sessionSecret: requireEnv('SESSION_SECRET', 'dev-only-insecure-secret-change-me'),
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? 'ai_matters_sid',
}

export type AppConfig = typeof config
