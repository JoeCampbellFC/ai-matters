import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { Annotation, type LangGraphRunnableConfig } from '@langchain/langgraph'
import { findTool } from '../../../mcp/tools.js'
import { McpToolError } from '../../../mcp/errors.js'
import type { BudgetLimits } from '../../budget.js'
import type { EmittedResearchEvent, ResearchStage } from '../../types.js'

/**
 * Non-serializable, request-scoped context threaded into every node via
 * `configurable`. Reuses the existing session-cached MCP client/tools
 * snapshot from mcp/connection.ts -- never a second MCP connection. `limits`
 * is injected the same way (rather than read from the global config
 * singleton inside nodes) so tests can exercise budget edges directly.
 *
 * Declared as an Annotation.Root (not just a plain TS interface) so it can be
 * passed as StateGraph's context schema -- that's what makes the `config`
 * parameter TypeScript infers for every node line up with NodeConfig below.
 */
export const NodeContextAnnotation = Annotation.Root({
  client: Annotation<Client>,
  tools: Annotation<Tool[]>,
  limits: Annotation<BudgetLimits>,
})

export type NodeContext = typeof NodeContextAnnotation.State

export type NodeConfig = LangGraphRunnableConfig<NodeContext>

/**
 * Emits a fine-grained progress event under the `custom` stream mode.
 * seq/ts/runId are stamped centrally by runManager.ts, not here, so nodes
 * never need to coordinate an ordering counter among themselves.
 *
 * Logging discipline: event fields must never carry document body text or
 * credentials -- ids, counts, queries and short human-readable rationale
 * only.
 */
export function emit(config: NodeConfig, event: EmittedResearchEvent): void {
  config.writer?.(event)
}

/**
 * Declares "this stage has started" as the very first thing a node does.
 * Each node self-reports rather than runManager.ts inferring it from
 * `updates`-mode chunks after the fact (which only fires once a node
 * *finishes*, making the reported "current" stage always one node behind
 * and the resulting duration measurements wrong).
 *
 * `iteration` defaults to `state.budget.iterationCount`, but planSearches
 * passes its about-to-be-current iteration explicitly: that node's own
 * budget update (which bumps iterationCount on a refine pass) hasn't been
 * applied yet at the point it calls this, so the default would under-report
 * by one specifically for its own stage_changed event.
 */
export function emitStage(
  config: NodeConfig,
  state: { budget: { iterationCount: number } },
  stage: ResearchStage,
  iteration?: number,
): void {
  emit(config, { type: 'stage_changed', stage, iteration: iteration ?? state.budget.iterationCount })
}

export function requireTool(tools: Tool[], name: string): Tool {
  const tool = findTool(tools, name)
  if (!tool) throw new McpToolError(`The connected iManage MCP server does not expose the "${name}" tool.`)
  return tool
}

/**
 * Resolves the live tool schema and lets the caller build arguments from it
 * (schema-driven, per mcp/tools.ts conventions) before invoking it.
 */
export async function callTool(
  config: NodeConfig,
  name: string,
  buildArgs: (tool: Tool) => Record<string, unknown>,
): Promise<CallToolResult> {
  const { client, tools } = requireContext(config)
  const tool = requireTool(tools, name)
  const args = buildArgs(tool)
  return (await client.callTool(
    { name: tool.name, arguments: args },
    undefined,
    { signal: config.signal },
  )) as CallToolResult
}

export function requireContext(config: NodeConfig): NodeContext {
  const context = config.configurable
  if (!context?.client || !context.tools) {
    throw new Error('Matter research node invoked without an MCP client/tools context.')
  }
  return context
}
