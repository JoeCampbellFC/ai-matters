import { describe, expect, it, vi } from 'vitest'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'

const { streamImpl } = vi.hoisted(() => ({ streamImpl: vi.fn() }))

vi.mock('./graph/graph.js', () => ({
  buildMatterResearchGraph: () => ({ stream: streamImpl }),
}))

const {
  startResearchRun,
  getRun,
  findActiveRunForWorkspace,
  assertRunOwnedBySession,
  subscribeToRun,
  cancelRun,
  sweepStaleRuns,
} = await import('./runManager.js')
const { RunNotFoundError, RunAlreadyInProgressError } = await import('./errors.js')

const FAKE_CLIENT = {} as Client
const FAKE_TOOLS: Tool[] = []

function immediateStream(chunks: Array<[string, unknown]>) {
  return vi.fn(async function* () {
    for (const chunk of chunks) yield chunk
  })
}

function hangingStream() {
  return vi.fn(async function* (_input: unknown, options: { signal?: AbortSignal }) {
    yield ['custom', { type: 'activity', stage: 'initializing', message: 'started' }]
    await new Promise<void>((resolve) => {
      if (options.signal?.aborted) {
        resolve()
        return
      }
      options.signal?.addEventListener('abort', () => resolve(), { once: true })
    })
    throw new DOMException('Aborted', 'AbortError')
  })
}

describe('startResearchRun / lifecycle', () => {
  it('runs to completion and records a succeeded run with replayable events', async () => {
    streamImpl.mockImplementation(
      immediateStream([
        ['custom', { type: 'activity', stage: 'initializing', message: 'Connecting…' }],
        ['values', { markdown: '# Report', citationRegistry: [{ marker: 'D01', documentId: 'DOC-1' }] }],
      ]),
    )

    const run = startResearchRun({
      sessionId: 'session-1',
      workspaceId: 'WS-1',
      client: FAKE_CLIENT,
      tools: FAKE_TOOLS,
    })
    await run.done

    expect(run.status).toBe('succeeded')
    expect(run.result?.markdown).toBe('# Report')

    const replayed: string[] = []
    subscribeToRun(run, 0, (event) => replayed.push(event.type))
    expect(replayed).toContain('run_started')
    expect(replayed).toContain('activity')
    expect(replayed).toContain('run_succeeded')

    const replayedAfterLast: string[] = []
    const lastSeq = run.events[run.events.length - 1]!.seq
    subscribeToRun(run, lastSeq, (event) => replayedAfterLast.push(event.type))
    expect(replayedAfterLast).toEqual([])
  })

  it('projects the search_planned/started/completed lifecycle onto run.searchQueries', async () => {
    streamImpl.mockImplementation(
      immediateStream([
        ['custom', { type: 'search_planned', query: 'share purchase agreement', rationale: 'core deal document', iteration: 0 }],
        ['custom', { type: 'search_started', query: 'share purchase agreement' }],
        ['custom', { type: 'search_completed', query: 'share purchase agreement', resultCount: 3 }],
      ]),
    )

    const run = startResearchRun({
      sessionId: 'session-search',
      workspaceId: 'WS-search',
      client: FAKE_CLIENT,
      tools: FAKE_TOOLS,
    })
    await run.done

    expect(run.searchQueries.get('share purchase agreement')).toEqual({
      query: 'share purchase agreement',
      rationale: 'core deal document',
      iteration: 0,
      status: 'completed',
      resultCount: 3,
    })
  })

  it('classifies a cancelled run as cancelled, not failed', async () => {
    streamImpl.mockImplementation(hangingStream())

    const run = startResearchRun({
      sessionId: 'session-2',
      workspaceId: 'WS-2',
      client: FAKE_CLIENT,
      tools: FAKE_TOOLS,
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    cancelRun(run)
    await run.done

    expect(run.status).toBe('cancelled')
    expect(run.error).toBeUndefined()
  })

  it('classifies a genuine stream failure as failed', async () => {
    streamImpl.mockImplementation(async () => {
      throw new Error('MCP connection lost')
    })

    const run = startResearchRun({
      sessionId: 'session-3',
      workspaceId: 'WS-3',
      client: FAKE_CLIENT,
      tools: FAKE_TOOLS,
    })
    await run.done

    expect(run.status).toBe('failed')
    expect(run.error?.message).toContain('MCP connection lost')
  })

  it('rejects starting a second run for the same session+workspace while one is active', async () => {
    streamImpl.mockImplementation(hangingStream())

    const run = startResearchRun({
      sessionId: 'session-4',
      workspaceId: 'WS-4',
      client: FAKE_CLIENT,
      tools: FAKE_TOOLS,
    })

    expect(() =>
      startResearchRun({ sessionId: 'session-4', workspaceId: 'WS-4', client: FAKE_CLIENT, tools: FAKE_TOOLS }),
    ).toThrow(RunAlreadyInProgressError)
    expect(findActiveRunForWorkspace('session-4', 'WS-4')?.runId).toBe(run.runId)

    cancelRun(run)
    await run.done
  })

  it('throws RunNotFoundError (not a permission error) when the session does not own the run', async () => {
    streamImpl.mockImplementation(immediateStream([]))
    const run = startResearchRun({
      sessionId: 'owner-session',
      workspaceId: 'WS-5',
      client: FAKE_CLIENT,
      tools: FAKE_TOOLS,
    })
    await run.done
    expect(() => assertRunOwnedBySession(run, 'other-session')).toThrow(RunNotFoundError)
    expect(() => assertRunOwnedBySession(run, 'owner-session')).not.toThrow()
  })
})

describe('stage tracking', () => {
  it('advances run.stage and only logs/resets on a genuine transition, not a same-stage repeat', async () => {
    streamImpl.mockImplementation(async function* () {
      yield ['custom', { type: 'stage_changed', stage: 'initializing', iteration: 0 }]
      yield ['custom', { type: 'stage_changed', stage: 'planning_searches', iteration: 0 }]
      yield ['custom', { type: 'stage_changed', stage: 'synthesizing', iteration: 0 }]
      // A short real delay so this and the next 'synthesizing' event get distinct
      // timestamps -- otherwise both could land in the same millisecond and the
      // "did it reset the clock" assertion below would be meaningless either way.
      await new Promise((resolve) => setTimeout(resolve, 5))
      // Several synthesis nodes report the same stage back-to-back; this should not look like two transitions.
      yield ['custom', { type: 'stage_changed', stage: 'synthesizing', iteration: 0 }]
    })

    const run = startResearchRun({
      sessionId: 'session-stage',
      workspaceId: 'WS-stage',
      client: FAKE_CLIENT,
      tools: FAKE_TOOLS,
    })
    await run.done

    expect(run.stage).toBe('synthesizing')
    const stageEvents = run.events.filter((e) => e.type === 'stage_changed')
    expect(stageEvents).toHaveLength(4)

    // The repeated 'synthesizing' event (the 3rd stage_changed, after -> planning_searches and
    // -> synthesizing) must not reset the clock: stageStartedAt should still match when
    // 'synthesizing' first began, not the later repeat.
    expect(run.stageStartedAt.toISOString()).toBe(stageEvents[2]!.ts)
    expect(run.stageStartedAt.toISOString()).not.toBe(stageEvents[3]!.ts)
  })
})

describe('sweepStaleRuns', () => {
  it('removes a terminal run older than the TTL but never a running one', async () => {
    streamImpl.mockImplementation(immediateStream([]))
    const finished = startResearchRun({
      sessionId: 'sweep-session',
      workspaceId: 'WS-finished',
      client: FAKE_CLIENT,
      tools: FAKE_TOOLS,
    })
    await finished.done
    finished.updatedAt = new Date(Date.now() - 1_000_000_000)

    streamImpl.mockImplementation(hangingStream())
    const running = startResearchRun({
      sessionId: 'sweep-session',
      workspaceId: 'WS-running',
      client: FAKE_CLIENT,
      tools: FAKE_TOOLS,
    })
    running.updatedAt = new Date(Date.now() - 1_000_000_000)

    sweepStaleRuns()

    expect(getRun(finished.runId)).toBeUndefined()
    expect(getRun(running.runId)).toBe(running)

    cancelRun(running)
    await running.done
  })
})
