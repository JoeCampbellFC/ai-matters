import { Router } from 'express'
import { z } from 'zod'
import type { ContainerType } from '../mcp/matterMapper.js'
import { resolveAccessibleMatter } from '../services/matterAccessService.js'
import { listContainerChildren, searchWorkspaceDocuments } from '../services/matterDocumentsService.js'

export const matterDocumentsRouter = Router()

const ContainerTypeSchema = z.enum(['workspace', 'tab', 'folder'])

const ChildrenQuerySchema = z.object({
  containerId: z.string().min(1).optional(),
  containerType: ContainerTypeSchema.optional(),
  cursor: z.string().min(1).optional(),
})

/**
 * Lists one container's immediate children for the Documents panel's Browse
 * tab -- defaults to the workspace root when no containerId is given, so the
 * panel's first load needs no prior knowledge of the workspace's own
 * container id/type. Never walks the tree itself: the frontend calls this
 * again, with the clicked folder's id/type, to expand it.
 */
matterDocumentsRouter.get('/:workspaceId/documents/children', async (req, res, next) => {
  try {
    const query = ChildrenQuerySchema.parse(req.query)
    const { matter } = await resolveAccessibleMatter(req, req.params.workspaceId!)
    const containerId = query.containerId ?? req.params.workspaceId!
    const containerType: ContainerType = query.containerType ?? 'workspace'
    const page = await listContainerChildren(req, { containerId, containerType, cursor: query.cursor })
    res.json({ matterId: matter.id, ...page })
  } catch (error) {
    next(error)
  }
})

const SearchQuerySchema = z.object({
  query: z.string().min(1),
})

/**
 * Workspace-scoped document search for the Documents panel's Search tab --
 * see matterDocumentsService.searchWorkspaceDocuments for why every raw hit
 * is independently membership-verified before being returned.
 */
matterDocumentsRouter.get('/:workspaceId/documents/search', async (req, res, next) => {
  try {
    const { query } = SearchQuerySchema.parse(req.query)
    const { matter, workspace } = await resolveAccessibleMatter(req, req.params.workspaceId!)
    const result = await searchWorkspaceDocuments(req, { workspaceId: req.params.workspaceId!, workspace, query })
    res.json({ matterId: matter.id, ...result })
  } catch (error) {
    next(error)
  }
})
