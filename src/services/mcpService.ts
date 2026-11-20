import { apiRequest } from './api'
import type { McpStatus, McpToolSummary } from '@/types/workspace'

export async function fetchMcpStatus(signal?: AbortSignal): Promise<McpStatus> {
  return apiRequest<McpStatus>('/mcp/status', { signal })
}

export async function fetchMcpTools(signal?: AbortSignal): Promise<McpToolSummary[]> {
  const { tools } = await apiRequest<{ tools: McpToolSummary[] }>('/mcp/tools', { signal })
  return tools
}

export async function disconnectMcp(): Promise<void> {
  await apiRequest<void>('/auth/disconnect', { method: 'POST' })
}

export function startMcpConnect(): void {
  window.location.href = '/api/auth/connect'
}
