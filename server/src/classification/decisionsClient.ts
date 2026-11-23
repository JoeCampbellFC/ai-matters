import OpenAI from 'openai'
import { config } from '../config.js'
import {
  DecisionsConfigError,
  DecisionsDeploymentUnavailableError,
  DecisionsRateLimitedError,
  DecisionsRequestError,
} from './errors.js'

let cachedClient: OpenAI | undefined

/** Same normalization as llm/azureOpenAI.ts -- Azure's v1 API, no dated api-version. */
function normalizeV1BaseUrl(endpoint: string): string {
  return `${endpoint.replace(/\/+$/, '')}/openai/v1/`
}

/**
 * Lazily constructs and caches a *separate* raw OpenAI SDK client for the
 * Decisions API. This is intentionally not the same client as
 * llm/azureOpenAI.ts's ChatOpenAI: Decisions is reached via the raw `openai`
 * SDK's `client.decisions.create(...)` (LangChain's ChatOpenAI has no
 * equivalent), and Azure OpenAI deployments are model-specific, so this
 * targets the gpt-6-luna deployment while gpt-5.4 keeps serving Phase 2
 * summarisation unchanged.
 */
export function getDecisionsClient(): OpenAI {
  if (cachedClient) return cachedClient

  const { azureOpenAiEndpoint, azureOpenAiApiKey, azureOpenAiDecisionsDeploymentName } = config
  if (!azureOpenAiEndpoint || !azureOpenAiApiKey || !azureOpenAiDecisionsDeploymentName) {
    throw new DecisionsConfigError()
  }

  cachedClient = new OpenAI({
    baseURL: normalizeV1BaseUrl(azureOpenAiEndpoint),
    apiKey: azureOpenAiApiKey,
  })
  return cachedClient
}

export function classifyDecisionsError(error: unknown): Error {
  if (error instanceof DecisionsConfigError) return error
  const status = (error as { status?: number } | null)?.status
  if (status === 401 || status === 403) {
    return new DecisionsConfigError('Azure OpenAI rejected the configured credentials for the Decisions API.')
  }
  if (status === 404) return new DecisionsDeploymentUnavailableError()
  if (status === 429) return new DecisionsRateLimitedError()
  return new DecisionsRequestError(error instanceof Error ? error.message : 'Decisions API request failed.')
}

export interface ChoiceDecisionAnswer {
  type: 'choice'
  choice: string
  confidence: number
  probabilities: Array<{ value: string; probability: number }>
}

export interface RefusalDecisionAnswer {
  type: 'refusal'
  name: string | null
}

/**
 * Submits a single `choice` question to the Decisions API and returns a
 * typed answer -- never a narrative response. Only string-valued choices are
 * supported here (the taxonomy has no boolean options), so a non-string
 * choice value is treated as a malformed response, not silently coerced.
 */
export async function classifyChoice(input: {
  questionName: string
  instructions: string
  evidenceText: string
  choices: Array<{ value: string; description: string }>
}): Promise<ChoiceDecisionAnswer | RefusalDecisionAnswer> {
  const client = getDecisionsClient()
  const { azureOpenAiDecisionsDeploymentName } = config

  let decision: Awaited<ReturnType<typeof client.decisions.create>>
  try {
    decision = await client.decisions.create({
      model: azureOpenAiDecisionsDeploymentName,
      input: input.evidenceText,
      questions: [
        {
          type: 'choice',
          name: input.questionName,
          instructions: input.instructions,
          choices: input.choices,
        },
      ],
    })
  } catch (error) {
    throw classifyDecisionsError(error)
  }

  const answer = decision.answers.find((a) => a.name === input.questionName)
  if (!answer || answer.type === 'refusal') {
    return { type: 'refusal', name: answer?.name ?? null }
  }
  if (answer.type !== 'choice') {
    throw new DecisionsRequestError(`Expected a "choice" answer from the Decisions API but received "${answer.type}".`)
  }
  if (typeof answer.choice !== 'string') {
    throw new DecisionsRequestError('The Decisions API returned a non-string choice value for a string-only question.')
  }

  return {
    type: 'choice',
    choice: answer.choice,
    confidence: answer.confidence,
    probabilities: answer.probabilities
      .filter((p): p is { value: string; probability: number } => typeof p.value === 'string')
      .map((p) => ({ value: p.value, probability: p.probability })),
  }
}
