import { Router } from 'express'
import { z } from 'zod'
import { listClassificationFieldOptions } from '../classification/classificationFields.js'
import { listAuditEvents } from '../database/repositories/auditRepository.js'
import { getVersion, listVersions } from '../database/repositories/knowledgeRepository.js'
import { listMattersByWorkspaceIds } from '../database/repositories/matterRepository.js'
import { config } from '../config.js'
import { MarkdownNotPublishedError } from '../database/errors.js'
import { actorFor, resolveAccessibleMatter } from '../services/matterAccessService.js'
import { editMarkdown, restoreVersion } from '../services/matterKnowledgeService.js'
import { getMatterProfile, reclassifyCurrentVersion, updateProfileFields } from '../services/matterProfileService.js'

export const matterProfileRouter = Router()

/**
 * id/label pairs only, per field, for the manual-correction Selects -- each
 * field's taxonomy descriptions and classification guidance are prompt
 * content and never leave the server.
 */
matterProfileRouter.get('/classification-fields', (_req, res) => {
  res.json({ fields: listClassificationFieldOptions() })
})

/**
 * Batch "already analysed" lookup for the Workspaces list (spec section 16)
 * -- one query for every row on the page, not one per row. Trusts the
 * caller's own workspaceIds (expected to be the results of their own
 * authenticated iManage search/recent-workspaces call) rather than
 * re-verifying live access per id, which would defeat the point of
 * batching; opening an individual matter (routes below) always re-verifies.
 */
matterProfileRouter.get('/', async (req, res, next) => {
  try {
    const raw = typeof req.query.workspaceIds === 'string' ? req.query.workspaceIds : ''
    const workspaceIds = raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
    const matters = await listMattersByWorkspaceIds(config.tenantId, workspaceIds)
    res.json({
      matters: matters.map((m) => ({
        workspaceId: m.workspaceId,
        workspaceName: m.workspaceName,
        status: m.status,
        hasKnowledge: Boolean(m.currentMarkdownVersionId),
        updatedAt: m.updatedAt.toISOString(),
      })),
    })
  } catch (error) {
    next(error)
  }
})

matterProfileRouter.get('/:workspaceId/profile', async (req, res, next) => {
  try {
    const { matter } = await resolveAccessibleMatter(req, req.params.workspaceId!)
    const profile = await getMatterProfile(matter.id)
    res.json(profile)
  } catch (error) {
    next(error)
  }
})

/**
 * Classifies every field against the current Matter Knowledge version. In
 * ordinary operation this never needs to be called -- a successful research
 * run triggers classification automatically (runManager.ts) -- this exists
 * for retrying after a failure, and behaves identically to /reclassify.
 */
matterProfileRouter.post('/:workspaceId/classify', async (req, res, next) => {
  try {
    const { matter } = await resolveAccessibleMatter(req, req.params.workspaceId!)
    const profile = await reclassifyCurrentVersion(matter.id, actorFor(req))
    res.status(202).json(profile)
  } catch (error) {
    next(error)
  }
})

matterProfileRouter.post('/:workspaceId/reclassify', async (req, res, next) => {
  try {
    const { matter } = await resolveAccessibleMatter(req, req.params.workspaceId!)
    const profile = await reclassifyCurrentVersion(matter.id, actorFor(req))
    res.status(202).json(profile)
  } catch (error) {
    next(error)
  }
})

const ProfileUpdateSchema = z.object({
  updates: z
    .array(
      z.object({
        fieldKey: z.string().min(1),
        value: z.unknown(),
        expectedVersion: z.number().int().min(0),
      }),
    )
    .min(1),
})

/** Generalized field editor -- both the 16 AI-classified dimensions (a manual override) and the pure-profile fields go through the same batch, one optimistic-concurrency check per field. */
matterProfileRouter.patch('/:workspaceId/profile', async (req, res, next) => {
  try {
    const { matter } = await resolveAccessibleMatter(req, req.params.workspaceId!)
    const body = ProfileUpdateSchema.parse(req.body)
    const profile = await updateProfileFields(matter.id, body.updates, actorFor(req))
    res.json(profile)
  } catch (error) {
    next(error)
  }
})

matterProfileRouter.get('/:workspaceId/knowledge/versions', async (req, res, next) => {
  try {
    const { matter } = await resolveAccessibleMatter(req, req.params.workspaceId!)
    const versions = await listVersions(matter.id)
    res.json({ versions })
  } catch (error) {
    next(error)
  }
})

matterProfileRouter.get('/:workspaceId/knowledge/versions/:versionId', async (req, res, next) => {
  try {
    const { matter } = await resolveAccessibleMatter(req, req.params.workspaceId!)
    const version = await getVersion(req.params.versionId!)
    if (!version || version.matterId !== matter.id) throw new MarkdownNotPublishedError('That Matter Knowledge version does not exist for this workspace.')
    res.json({ version })
  } catch (error) {
    next(error)
  }
})

const EditMarkdownSchema = z.object({
  content: z.string().min(1),
  basedOnVersionId: z.string().min(1),
  changeSummary: z.string().optional(),
})

matterProfileRouter.put('/:workspaceId/knowledge', async (req, res, next) => {
  try {
    const { matter } = await resolveAccessibleMatter(req, req.params.workspaceId!)
    const body = EditMarkdownSchema.parse(req.body)
    const version = await editMarkdown({
      matterId: matter.id,
      content: body.content,
      basedOnVersionId: body.basedOnVersionId,
      changeSummary: body.changeSummary,
      updatedBy: actorFor(req),
    })
    res.json({ version })
  } catch (error) {
    next(error)
  }
})

const RestoreVersionSchema = z.object({ versionId: z.string().min(1) })

matterProfileRouter.post('/:workspaceId/knowledge/restore', async (req, res, next) => {
  try {
    const { matter } = await resolveAccessibleMatter(req, req.params.workspaceId!)
    const body = RestoreVersionSchema.parse(req.body)
    const version = await restoreVersion({ matterId: matter.id, versionId: body.versionId, updatedBy: actorFor(req) })
    res.json({ version })
  } catch (error) {
    next(error)
  }
})

matterProfileRouter.get('/:workspaceId/audit', async (req, res, next) => {
  try {
    const { matter } = await resolveAccessibleMatter(req, req.params.workspaceId!)
    const events = await listAuditEvents(matter.id)
    res.json({ events })
  } catch (error) {
    next(error)
  }
})
