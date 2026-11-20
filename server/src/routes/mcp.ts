import { Router } from 'express'
import { config } from '../config.js'
import { getConnection } from '../mcp/connection.js'
import { GET_LIBRARIES_TOOL, GET_RECENT_WORKSPACES_TOOL, SEARCH_WORKSPACES_TOOL } from '../mcp/tools.js'
import { classifyError } from '../httpErrors.js'
import { decodeIdTokenClaims } from '../auth/jwt.js'

export const mcpRouter = Router()

mcpRouter.get('/status', async (req, res) => {
  if (!req.session.imanage?.tokens) {
    res.json({ state: 'not_connected', environment: config.imanageMcpUrl })
    return
  }

  try {
    const { tools } = await getConnection(req)
    const toolNames = new Set(tools.map((tool) => tool.name))
    res.json({
      state: 'connected',
      environment: config.imanageMcpUrl,
      authenticatedUser: decodeIdTokenClaims(req.session.imanage.tokens.id_token),
      tools: {
        searchWorkspaces: toolNames.has(SEARCH_WORKSPACES_TOOL),
        getRecentWorkspaces: toolNames.has(GET_RECENT_WORKSPACES_TOOL),
        getLibraries: toolNames.has(GET_LIBRARIES_TOOL),
      },
    })
  } catch (error) {
    const { code, message } = classifyError(error)
    res.json({ state: code, environment: config.imanageMcpUrl, error: message })
  }
})

const RELEVANT_TOOL_NAMES: string[] = [SEARCH_WORKSPACES_TOOL, GET_RECENT_WORKSPACES_TOOL, GET_LIBRARIES_TOOL]

mcpRouter.get('/tools', async (req, res, next) => {
  try {
    const { tools } = await getConnection(req)
    const relevant = tools.filter((tool) => RELEVANT_TOOL_NAMES.includes(tool.name))
    res.json({
      tools: relevant.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    })
  } catch (error) {
    next(error)
  }
})
