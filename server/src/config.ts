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

  // Intentionally optional at the config layer (not requireEnv): Phase 1 auth/workspace
  // features must keep working even when Azure OpenAI isn't configured yet. Missing
  // values are only surfaced as an LlmConfigError when matter research is actually started.
  azureOpenAiEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
  azureOpenAiApiKey: process.env.AZURE_OPENAI_API_KEY,
  azureOpenAiDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  azureOpenAiTemperature:
    process.env.AZURE_OPENAI_TEMPERATURE !== undefined ? Number(process.env.AZURE_OPENAI_TEMPERATURE) : undefined,

  researchMaxIterations: Number(process.env.RESEARCH_MAX_ITERATIONS ?? 3),
  researchMaxDocuments: Number(process.env.RESEARCH_MAX_DOCUMENTS ?? 40),
  researchMaxDurationMs: Number(process.env.RESEARCH_MAX_DURATION_MS ?? 10 * 60 * 1000),
  researchMaxLlmCalls: Number(process.env.RESEARCH_MAX_LLM_CALLS ?? 60),
  researchMaxMcpCalls: Number(process.env.RESEARCH_MAX_MCP_CALLS ?? 300),
  researchRunTtlMs: Number(process.env.RESEARCH_RUN_TTL_MS ?? 30 * 60 * 1000),
  researchEventBufferMax: Number(process.env.RESEARCH_EVENT_BUFFER_MAX ?? 2000),
}

export type AppConfig = typeof config
