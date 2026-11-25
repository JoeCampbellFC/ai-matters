import { describe, expect, it } from 'vitest'
import { summarizeToolError } from './shared.js'

describe('summarizeToolError', () => {
  it('extracts the first issue from a Zod-style JSON issues array', () => {
    // Observed live: an MCP tool call rejected with exactly this shape as its error message.
    const raw = JSON.stringify([
      { expected: 'string', code: 'invalid_type', path: ['results', 34, 'title'], message: 'Invalid input: expected string, received undefined' },
    ])
    expect(summarizeToolError(new Error(raw))).toBe('Invalid input: expected string, received undefined (at results.34.title)')
  })

  it('extracts a single JSON issue object the same way', () => {
    const raw = JSON.stringify({ code: 'invalid_type', path: ['title'], message: 'Expected string' })
    expect(summarizeToolError(new Error(raw))).toBe('Expected string (at title)')
  })

  it('falls back to plain-text truncation for a non-JSON message', () => {
    expect(summarizeToolError(new Error('connection reset'))).toBe('connection reset')
  })

  it('truncates a very long plain-text message', () => {
    const long = 'x'.repeat(300)
    const result = summarizeToolError(new Error(long))
    expect(result.length).toBe(201) // 200 chars + ellipsis
    expect(result.endsWith('…')).toBe(true)
  })

  it('falls back gracefully when the message looks like JSON but is not parseable', () => {
    expect(summarizeToolError(new Error('[not actually json'))).toBe('[not actually json')
  })

  it('handles a non-Error thrown value', () => {
    expect(summarizeToolError('plain string failure')).toBe('plain string failure')
  })
})
