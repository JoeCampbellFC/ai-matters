import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { disconnectMcp, fetchMcpStatus, fetchMcpTools } from '@/services/mcpService'

export const MCP_STATUS_QUERY_KEY = ['mcp', 'status'] as const
export const MCP_TOOLS_QUERY_KEY = ['mcp', 'tools'] as const

export function useMcpStatus() {
  return useQuery({
    queryKey: MCP_STATUS_QUERY_KEY,
    queryFn: ({ signal }) => fetchMcpStatus(signal),
    staleTime: 15_000,
    // The backend can still be booting (far more to compile/import than Vite) when this
    // first fires in dev -- the global QueryClient disables retries, so without this override
    // a race here gets stuck in error state forever instead of healing once the backend is up.
    retry: 3,
    retryDelay: 1_000,
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
