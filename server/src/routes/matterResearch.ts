import { Router } from 'express'
import { getConnection } from '../mcp/connection.js'
import { RunNotFoundError, RunNotReadyError } from '../matterResearch/errors.js'
import { formatSseEvent } from '../matterResearch/sseFormat.js'
import {
  assertRunOwnedBySession,
  cancelRun,
  findActiveRunForWorkspace,
  getRun,
  recordHeartbeat,
  startResearchRun,
  subscribeToRun,
  type ResearchRunRecord,
} from '../matterResearch/runManager.js'

export const matterResearchRouter = Router()

const HEARTBEAT_INTERVAL_MS = 15_000

function requireOwnedRun(req: { params: { runId: string }; sessionID: string }): ResearchRunRecord {
  const run = getRun(req.params.runId)
  if (!run) throw new RunNotFoundError()
  assertRunOwnedBySession(run, req.sessionID)
  return run
}

matterResearchRouter.post('/:workspaceId/research', async (req, res, next) => {
  try {
    const { client, tools } = await getConnection(req)
    const { workspaceId } = req.params

    const existing = findActiveRunForWorkspace(req.sessionID, workspaceId)
    if (existing) {
      res.status(409).json({
        error: { code: 'run_in_progress', message: 'A research run is already in progress for this workspace.' },
        runId: existing.runId,
      })
      return
    }

    const run = startResearchRun({ sessionId: req.sessionID, workspaceId, client, tools })
    res.status(202).json({ runId: run.runId, status: run.status, stage: run.stage })
  } catch (error) {
    next(error)
  }
})

matterResearchRouter.get('/research/:runId/events', (req, res, next) => {
  let run: ResearchRunRecord
  try {
    run = requireOwnedRun(req)
  } catch (error) {
    next(error)
    return
  }

  const lastEventIdHeader = req.headers['last-event-id']
  const afterParam = typeof req.query.after === 'string' ? req.query.after : undefined
  const afterSeq = Number(afterParam ?? lastEventIdHeader ?? 0) || 0

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  })
  res.flushHeaders()

  const unsubscribe = subscribeToRun(run, afterSeq, (event) => {
    res.write(formatSseEvent(event))
  })

  const heartbeat = setInterval(() => {
    recordHeartbeat(run)
  }, HEARTBEAT_INTERVAL_MS)

  req.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe()
  })
})

matterResearchRouter.get('/research/:runId', (req, res, next) => {
  try {
    const run = requireOwnedRun(req)
    res.json({
      runId: run.runId,
      workspaceId: run.workspaceId,
      status: run.status,
      stage: run.stage,
      documents: Array.from(run.documents.values()),
      searchQueries: Array.from(run.searchQueries.values()),
      coverage: run.coverage,
      skill: run.skill,
      error: run.error,
    })
  } catch (error) {
    next(error)
  }
})

matterResearchRouter.post('/research/:runId/cancel', (req, res, next) => {
  try {
    const run = requireOwnedRun(req)
    cancelRun(run)
    res.status(202).json({ runId: run.runId, status: 'cancelling' })
  } catch (error) {
    next(error)
  }
})

matterResearchRouter.get('/research/:runId/markdown', (req, res, next) => {
  try {
    const run = requireOwnedRun(req)
    if (run.status !== 'succeeded' || !run.result) {
      throw new RunNotReadyError()
    }
    res.json({ markdown: run.result.markdown, citations: run.result.citationRegistry })
  } catch (error) {
    next(error)
  }
})
