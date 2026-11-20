import { describe, expect, it, vi } from 'vitest'
import { classifyAzureError } from './azureOpenAI.js'
import { LlmConfigError, LlmDeploymentUnavailableError, LlmRateLimitedError, LlmRequestError } from './errors.js'

describe('getAzureChatModel', () => {
  it('throws LlmConfigError when Azure OpenAI credentials are not configured', async () => {
    vi.resetModules()
    vi.doMock('../config.js', () => ({
      config: {
        azureOpenAiEndpoint: undefined,
        azureOpenAiApiKey: undefined,
        azureOpenAiDeploymentName: undefined,
        azureOpenAiTemperature: undefined,
      },
    }))
    const { getAzureChatModel } = await import('./azureOpenAI.js')
    const { LlmConfigError: ResetLlmConfigError } = await import('./errors.js')
    expect(() => getAzureChatModel()).toThrow(ResetLlmConfigError)
    vi.doUnmock('../config.js')
  })
})

describe('classifyAzureError', () => {
  it('maps 401/403 to LlmConfigError', () => {
    expect(classifyAzureError({ status: 401 })).toBeInstanceOf(LlmConfigError)
    expect(classifyAzureError({ status: 403 })).toBeInstanceOf(LlmConfigError)
  })

  it('maps 404 to LlmDeploymentUnavailableError', () => {
    expect(classifyAzureError({ status: 404 })).toBeInstanceOf(LlmDeploymentUnavailableError)
  })

  it('maps 429 to LlmRateLimitedError', () => {
    expect(classifyAzureError({ status: 429 })).toBeInstanceOf(LlmRateLimitedError)
  })

  it('maps anything else to LlmRequestError', () => {
    expect(classifyAzureError(new Error('boom'))).toBeInstanceOf(LlmRequestError)
    expect(classifyAzureError({ status: 500 })).toBeInstanceOf(LlmRequestError)
  })

  it('passes an existing LlmConfigError through unchanged', () => {
    const original = new LlmConfigError('already classified')
    expect(classifyAzureError(original)).toBe(original)
  })
})
