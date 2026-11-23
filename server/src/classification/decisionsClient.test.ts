import { describe, expect, it, vi } from 'vitest'

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }))

vi.mock('openai', () => {
  class OpenAIMock {
    decisions = { create: createMock }
  }
  return { default: OpenAIMock }
})

const { classifyChoice } = await import('./decisionsClient.js')
const {
  DecisionsConfigError,
  DecisionsDeploymentUnavailableError,
  DecisionsRateLimitedError,
  DecisionsRequestError,
} = await import('./errors.js')

const CHOICES = [
  { value: 'mergers_acquisitions', description: 'M&A' },
  { value: 'corporate_advisory', description: 'Corporate' },
]

describe('classifyChoice', () => {
  it('sends a single typed "choice" question built from the supplied input', async () => {
    createMock.mockResolvedValueOnce({
      model: 'gpt-6-luna',
      answers: [{ type: 'choice', name: 'matter_type', choice: 'mergers_acquisitions', confidence: 0.9, probabilities: [] }],
      usage: {},
    })

    await classifyChoice({
      questionName: 'matter_type',
      instructions: 'Pick one.',
      evidenceText: 'Matter markdown content.',
      choices: CHOICES,
    })

    expect(createMock).toHaveBeenCalledWith({
      model: 'gpt-6-luna',
      input: 'Matter markdown content.',
      questions: [{ type: 'choice', name: 'matter_type', instructions: 'Pick one.', choices: CHOICES }],
    })
  })

  it('parses a successful choice answer, including per-option probabilities', async () => {
    createMock.mockResolvedValueOnce({
      model: 'gpt-6-luna',
      answers: [
        {
          type: 'choice',
          name: 'matter_type',
          choice: 'mergers_acquisitions',
          confidence: 0.93,
          probabilities: [
            { value: 'mergers_acquisitions', probability: 0.93 },
            { value: 'corporate_advisory', probability: 0.05 },
          ],
        },
      ],
      usage: {},
    })

    const result = await classifyChoice({
      questionName: 'matter_type',
      instructions: 'Pick one.',
      evidenceText: 'x',
      choices: CHOICES,
    })

    expect(result).toEqual({
      type: 'choice',
      choice: 'mergers_acquisitions',
      confidence: 0.93,
      probabilities: [
        { value: 'mergers_acquisitions', probability: 0.93 },
        { value: 'corporate_advisory', probability: 0.05 },
      ],
    })
  })

  it('returns a refusal answer instead of fabricating a category', async () => {
    createMock.mockResolvedValueOnce({
      model: 'gpt-6-luna',
      answers: [{ type: 'refusal', name: 'matter_type' }],
      usage: {},
    })

    const result = await classifyChoice({ questionName: 'matter_type', instructions: 'x', evidenceText: 'x', choices: CHOICES })
    expect(result).toEqual({ type: 'refusal', name: 'matter_type' })
  })

  it('treats a missing answer for the question name as a refusal', async () => {
    createMock.mockResolvedValueOnce({ model: 'gpt-6-luna', answers: [], usage: {} })
    const result = await classifyChoice({ questionName: 'matter_type', instructions: 'x', evidenceText: 'x', choices: CHOICES })
    expect(result).toEqual({ type: 'refusal', name: null })
  })

  it('throws a clear error if the API returns an unexpected answer type for a choice question', async () => {
    createMock.mockResolvedValueOnce({
      model: 'gpt-6-luna',
      answers: [{ type: 'predicate', name: 'matter_type', probability: 0.5 }],
      usage: {},
    })
    await expect(
      classifyChoice({ questionName: 'matter_type', instructions: 'x', evidenceText: 'x', choices: CHOICES }),
    ).rejects.toThrow(DecisionsRequestError)
  })

  it('throws a clear error if the choice value is boolean (taxonomy choices are string-only)', async () => {
    createMock.mockResolvedValueOnce({
      model: 'gpt-6-luna',
      answers: [{ type: 'choice', name: 'matter_type', choice: true, confidence: 0.9, probabilities: [] }],
      usage: {},
    })
    await expect(
      classifyChoice({ questionName: 'matter_type', instructions: 'x', evidenceText: 'x', choices: CHOICES }),
    ).rejects.toThrow(DecisionsRequestError)
  })

  it.each([
    [401, DecisionsConfigError],
    [403, DecisionsConfigError],
    [404, DecisionsDeploymentUnavailableError],
    [429, DecisionsRateLimitedError],
    [500, DecisionsRequestError],
  ])('maps a %i status error to %s', async (status, ErrorClass) => {
    createMock.mockRejectedValueOnce(Object.assign(new Error('boom'), { status }))
    await expect(
      classifyChoice({ questionName: 'matter_type', instructions: 'x', evidenceText: 'x', choices: CHOICES }),
    ).rejects.toThrow(ErrorClass)
  })
})
