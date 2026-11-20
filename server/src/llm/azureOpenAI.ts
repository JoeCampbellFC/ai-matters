import { ChatOpenAI } from '@langchain/openai'
import { config } from '../config.js'
import { LlmConfigError, LlmDeploymentUnavailableError, LlmRateLimitedError, LlmRequestError } from './errors.js'

let cachedModel: ChatOpenAI | undefined

/**
 * Lazily constructs and caches the Azure OpenAI chat model, targeting Azure's
 * v1 API (no dated api-version) via a plain ChatOpenAI pointed at
 * "<endpoint>/openai/v1/". Throws LlmConfigError if credentials are missing
 * -- callers (research routes/nodes) decide how to surface that, Phase 1
 * features never touch this module.
 */
export function getAzureChatModel(): ChatOpenAI {
  if (cachedModel) return cachedModel

  const { azureOpenAiEndpoint, azureOpenAiApiKey, azureOpenAiDeploymentName } = config
  if (!azureOpenAiEndpoint || !azureOpenAiApiKey || !azureOpenAiDeploymentName) {
    throw new LlmConfigError()
  }

  cachedModel = new ChatOpenAI({
    model: azureOpenAiDeploymentName,
    apiKey: azureOpenAiApiKey,
    configuration: { baseURL: `${azureOpenAiEndpoint.replace(/\/+$/, '')}/openai/v1/` },
    maxRetries: 3,
    ...(config.azureOpenAiTemperature !== undefined ? { temperature: config.azureOpenAiTemperature } : {}),
  })
  return cachedModel
}

export function classifyAzureError(error: unknown): Error {
  if (error instanceof LlmConfigError) return error
  const status = (error as { status?: number } | null)?.status
  if (status === 401 || status === 403) return new LlmConfigError('Azure OpenAI rejected the configured credentials.')
  if (status === 404) return new LlmDeploymentUnavailableError()
  if (status === 429) return new LlmRateLimitedError()
  return new LlmRequestError(error instanceof Error ? error.message : 'Azure OpenAI request failed.')
}

/**
 * Cheap startup connectivity check. Logs on failure but never throws past its
 * own boundary -- Phase 1 auth/workspace features must keep working even if
 * Azure OpenAI is unreachable or unconfigured.
 */
export async function verifyAzureOpenAiConnectivity(): Promise<void> {
  const model = getAzureChatModel()
  await model.invoke([{ role: 'user', content: 'ping' }])
}
