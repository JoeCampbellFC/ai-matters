import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { disconnectMcp, fetchMcpStatus, fetchMcpTools } from '@/services/mcpService'

export const MCP_STATUS_QUERY_KEY = ['mcp', 'status'] as const
export const MCP_TOOLS_QUERY_KEY = ['mcp', 'tools'] as const

export function useMcpStatus() {
  return useQuery({
    queryKey: MCP_STATUS_QUERY_KEY,
    queryFn: ({ signal }) => fetchMcpStatus(signal),
    staleTime: 15_000,
  })
}

export function useMcpTools(enabled: boolean) {
  return useQuery({
    queryKey: MCP_TOOLS_QUERY_KEY,
    queryFn: ({ signal }) => fetchMcpTools(signal),
    enabled,
  })
}

export function useDisconnectMcp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: disconnectMcp,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MCP_STATUS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: MCP_TOOLS_QUERY_KEY })
    },
  })
}
