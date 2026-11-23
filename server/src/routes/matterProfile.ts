import { Router } from 'express'
import { listClassificationFieldOptions } from '../classification/classificationFields.js'
import { MatterProfileNotFoundError } from '../classification/errors.js'
import {
  recordManualClassificationCorrection,
  reclassifyLatestArtifact,
  toMatterProfile,
} from '../classification/matterClassificationService.js'

export const matterProfileRouter = Router()

/**
 * id/label pairs only, per field, for the manual-correction Selects -- each
 * field's taxonomy descriptions and classification guidance are prompt
 * content and never leave the server.
 */
matterProfileRouter.get('/classification-fields', (_req, res) => {
  res.json({ fields: listClassificationFieldOptions() })
})

matterProfileRouter.get('/:workspaceId/profile', (req, res, next) => {
  try {
    const profile = toMatterProfile(req.sessionID, req.params.workspaceId!)
    if (!profile) throw new MatterProfileNotFoundError()
    res.json(profile)
  } catch (error) {
    next(error)
  }
})

/**
 * Classifies every field against the latest completed Matter Knowledge
 * artifact for this workspace. In ordinary operation this never needs to be
 * called -- a successful research run triggers classification automatically
 * (runManager.ts) -- this exists for retrying after a failure, and behaves
 * identically to /reclassify (re-running Decisions on the existing
 * Markdown, never Phase 2 research).
 */
matterProfileRouter.post('/:workspaceId/classify', async (req, res, next) => {
  try {
    const profile = await reclassifyLatestArtifact(req.sessionID, req.params.workspaceId!)
    res.status(202).json(profile)
  } catch (error) {
    next(error)
  }
})

matterProfileRouter.post('/:workspaceId/reclassify', async (req, res, next) => {
  try {
    const profile = await reclassifyLatestArtifact(req.sessionID, req.params.workspaceId!)
    res.status(202).json(profile)
  } catch (error) {
    next(error)
  }
})

matterProfileRouter.patch('/:workspaceId/profile', (req, res, next) => {
  try {
    const body = req.body as { fieldId?: unknown; valueId?: unknown; correctedBy?: unknown }
    const profile = recordManualClassificationCorrection(req.sessionID, req.params.workspaceId!, {
      fieldId: typeof body.fieldId === 'string' ? body.fieldId : '',
      valueId: typeof body.valueId === 'string' ? body.valueId : '',
      correctedBy: typeof body.correctedBy === 'string' && body.correctedBy.trim() ? body.correctedBy : 'current user',
    })
    res.json(profile)
  } catch (error) {
    next(error)
  }
})
