import { Router } from 'express'
import { getExistingDashboardProjection, getOrCreateDashboardProjection } from '../dashboard/dashboardProjectionService.js'
import { resolveAccessibleMatter } from '../services/matterAccessService.js'
import { getCurrentVersionOrThrow } from '../services/matterKnowledgeService.js'

export const matterDashboardRouter = Router()

/**
 * Read-only: returns a cached projection immediately if one exists for the
 * matter's current Markdown version, otherwise `generated: false` with no
 * LLM call -- lets the dashboard page show a "Generate" prompt instead of
 * silently paying for generation on every page load/refresh.
 */
matterDashboardRouter.get('/:workspaceId/dashboard', async (req, res, next) => {
  try {
    const { matter } = await resolveAccessibleMatter(req, req.params.workspaceId!)
    const existing = await getExistingDashboardProjection(matter.id)
    if (!existing) {
      const version = await getCurrentVersionOrThrow(matter.id)
      res.json({ generated: false, markdownVersionId: version.id, citationRegistry: version.citationRegistry ?? [] })
      return
    }
    res.json({
      generated: true,
      projection: existing.projection,
      markdownVersionId: existing.version.id,
      citationRegistry: existing.version.citationRegistry ?? [],
    })
  } catch (error) {
    next(error)
  }
})

/**
 * Generates (or returns the already-cached) projection for the matter's
 * current Markdown version. Never regenerates the Markdown itself and never
 * reruns Phase 2 research -- purely a read-side transform, cached per exact
 * Markdown version + schema version so repeat views never re-call the LLM.
 */
matterDashboardRouter.post('/:workspaceId/dashboard/generate', async (req, res, next) => {
  try {
    const { matter } = await resolveAccessibleMatter(req, req.params.workspaceId!)
    const { projection, version, wasCached } = await getOrCreateDashboardProjection(matter.id)
    res.status(wasCached ? 200 : 201).json({
      generated: true,
      projection,
      markdownVersionId: version.id,
      citationRegistry: version.citationRegistry ?? [],
      wasCached,
    })
  } catch (error) {
    next(error)
  }
})
