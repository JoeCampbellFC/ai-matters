import { Router } from 'express'
import { z } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { getConnection } from '../mcp/connection.js'
import {
  GET_RECENT_WORKSPACES_TOOL,
  SEARCH_WORKSPACES_TOOL,
  buildRecentWorkspacesArgs,
  buildSearchWorkspacesArgs,
  findTool,
} from '../mcp/tools.js'
import { mapToolResultToWorkspaces } from '../mcp/workspaceMapper.js'
import { ToolUnavailableError } from '../mcp/errors.js'

export const workspacesRouter = Router()

const LibraryQuerySchema = z.object({
  libraryId: z.string().trim().min(1).optional(),
})

workspacesRouter.get('/recent', async (req, res, next) => {
  const parsed = LibraryQuerySchema.safeParse({ libraryId: req.query.libraryId })
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'invalid_request', message: 'Invalid libraryId parameter.' } })
    return
  }

  try {
    const { client, tools } = await getConnection(req)
    const tool = findTool(tools, GET_RECENT_WORKSPACES_TOOL)
    if (!tool) throw new ToolUnavailableError(GET_RECENT_WORKSPACES_TOOL)

    const args = buildRecentWorkspacesArgs(tool, { libraryId: parsed.data.libraryId })
    const result = (await client.callTool({ name: tool.name, arguments: args })) as CallToolResult
    const workspaces = mapToolResultToWorkspaces(result)
    res.json({ workspaces })
  } catch (error) {
    next(error)
  }
})

const SearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Enter a search term.').max(200, 'Search term is too long.'),
  libraryId: z.string().trim().min(1).optional(),
})

workspacesRouter.get('/search', async (req, res, next) => {
  const parsed = SearchQuerySchema.safeParse({ q: req.query.q, libraryId: req.query.libraryId })
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'invalid_request', message: parsed.error.issues[0]?.message ?? 'Invalid search request.' },
    })
    return
  }

  try {
    const { client, tools } = await getConnection(req)
    const tool = findTool(tools, SEARCH_WORKSPACES_TOOL)
    if (!tool) throw new ToolUnavailableError(SEARCH_WORKSPACES_TOOL)

    const args = buildSearchWorkspacesArgs(tool, { query: parsed.data.q, libraryId: parsed.data.libraryId })
    const result = (await client.callTool({ name: tool.name, arguments: args })) as CallToolResult
    const workspaces = mapToolResultToWorkspaces(result)
    res.json({ workspaces })
  } catch (error) {
    next(error)
  }
})
