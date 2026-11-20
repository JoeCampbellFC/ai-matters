import { Router } from 'express'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { getConnection } from '../mcp/connection.js'
import { GET_LIBRARIES_TOOL, findTool } from '../mcp/tools.js'
import { mapToolResultToLibraries } from '../mcp/libraryMapper.js'

export const librariesRouter = Router()

librariesRouter.get('/', async (req, res, next) => {
  try {
    const { client, tools } = await getConnection(req)
    const tool = findTool(tools, GET_LIBRARIES_TOOL)
    if (!tool) {
      // get_libraries is optional — tenants that don't enable it simply get no library filter.
      res.json({ libraries: [] })
      return
    }
    const result = (await client.callTool({ name: tool.name, arguments: {} })) as CallToolResult
    res.json({ libraries: mapToolResultToLibraries(result) })
  } catch (error) {
    next(error)
  }
})
