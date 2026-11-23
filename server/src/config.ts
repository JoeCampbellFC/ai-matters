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

  // Separate deployment for the Decisions API (Phase 3 matter classification) --
  // Decisions requires its own gpt-6-luna deployment on the same Azure OpenAI
  // resource; gpt-5.4 (above) keeps doing Phase 2 summarisation unchanged.
  // 'gpt-6-luna' is only a sensible default if that's also the tenant's real
  // deployment name -- classificationDeploymentUnavailable surfaces clearly if not.
  azureOpenAiDecisionsDeploymentName: process.env.AZURE_OPENAI_DECISIONS_DEPLOYMENT_NAME ?? 'gpt-6-luna',

  classificationHighConfidence: Number(process.env.CLASSIFICATION_HIGH_CONFIDENCE ?? 0.85),
  classificationReviewThreshold: Number(process.env.CLASSIFICATION_REVIEW_THRESHOLD ?? 0.65),
  // Conservative char budget for the full Markdown before falling back to a
  // deterministic reduced extract -- see classification/classificationInputBuilder.ts.
  classificationMaxInputChars: Number(process.env.CLASSIFICATION_MAX_INPUT_CHARS ?? 60_000),

  researchMaxIterations: Number(process.env.RESEARCH_MAX_ITERATIONS ?? 3),
  researchMaxDocuments: Number(process.env.RESEARCH_MAX_DOCUMENTS ?? 40),
  researchMaxDurationMs: Number(process.env.RESEARCH_MAX_DURATION_MS ?? 10 * 60 * 1000),
  researchMaxLlmCalls: Number(process.env.RESEARCH_MAX_LLM_CALLS ?? 60),
  researchMaxMcpCalls: Number(process.env.RESEARCH_MAX_MCP_CALLS ?? 300),
  researchRunTtlMs: Number(process.env.RESEARCH_RUN_TTL_MS ?? 30 * 60 * 1000),
  researchEventBufferMax: Number(process.env.RESEARCH_EVENT_BUFFER_MAX ?? 2000),

  // Phase 4: PostgreSQL. 'entra' mode (Azure) authenticates the managed
  // identity via @azure/identity instead of a static password -- see
  // database/connection.ts.
  databaseHost: requireEnv('DATABASE_HOST', 'localhost'),
  databasePort: Number(process.env.DATABASE_PORT ?? 5432),
  databaseName: requireEnv('DATABASE_NAME', 'ai_matters'),
  databaseUser: requireEnv('DATABASE_USER', 'ai_matters_dev'),
  databasePassword: process.env.DATABASE_PASSWORD,
  databaseSsl: (process.env.DATABASE_SSL ?? 'false') === 'true',
  databaseAuthMode: (process.env.DATABASE_AUTH_MODE ?? 'password') as 'password' | 'entra',

  // Identifies which iManage tenant this deployment serves -- avoids
  // assuming workspace ids are globally unique across iManage environments.
  tenantId: requireEnv('TENANT_ID', 'dev-tenant'),
}

export type AppConfig = typeof config
