import type { ComponentProps } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { WorkspaceTable } from './WorkspaceTable'
import type { Workspace } from '@/types/workspace'

vi.mock('@/services/mcpService', () => ({
  fetchMcpStatus: vi.fn().mockResolvedValue({ state: 'connected', environment: 'https://fireman.cloudimanage.com/mcp/work' }),
}))

function workspace(overrides: Partial<Workspace>): Workspace {
  return { id: 'WS-1', name: 'Acme Matter', raw: {}, ...overrides }
}

/** useMcpStatus() needs a QueryClient in scope -- every render in this file goes through this. */
function renderTable(props: ComponentProps<typeof WorkspaceTable>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WorkspaceTable {...props} />
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

describe('WorkspaceTable', () => {
  it('shows the empty state when there are no workspaces', () => {
    renderTable({
      workspaces: [],
      isLoading: false,
      isError: false,
      onSelect: vi.fn(),
      emptyTitle: 'No workspaces',
      emptyDescription: 'Try again later.',
    })
    expect(screen.getByText('No workspaces')).toBeInTheDocument()
  })

  it('shows the error state with the provided message', () => {
    renderTable({
      workspaces: [],
      isLoading: false,
      isError: true,
      errorMessage: 'The MCP server is unreachable.',
      onSelect: vi.fn(),
      emptyTitle: 'No workspaces',
      emptyDescription: 'Try again later.',
    })
    expect(screen.getByText('The MCP server is unreachable.')).toBeInTheDocument()
  })

  it('hides optional columns when no row has that field', () => {
    renderTable({
      workspaces: [workspace({})],
      isLoading: false,
      isError: false,
      onSelect: vi.fn(),
      emptyTitle: 'No workspaces',
      emptyDescription: 'Try again later.',
    })
    expect(screen.queryByText('Client')).not.toBeInTheDocument()
    expect(screen.queryByText('Matter')).not.toBeInTheDocument()
    expect(screen.getByText('Workspace')).toBeInTheDocument()
  })

  it('shows a populated column and calls onSelect when a row is clicked', () => {
    const onSelect = vi.fn()
    const ws = workspace({ client: 'Acme Corp' })
    renderTable({
      workspaces: [ws],
      isLoading: false,
      isError: false,
      onSelect,
      emptyTitle: 'No workspaces',
      emptyDescription: 'Try again later.',
    })
    expect(screen.getByText('Client')).toBeInTheDocument()
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Acme Matter'))
    expect(onSelect).toHaveBeenCalledWith(ws)
  })

  it('links the "Open in iManage" button to the workspace\'s web UI page, derived from the id and MCP host', async () => {
    renderTable({
      workspaces: [workspace({ id: 'ACTIVE!123772' })],
      isLoading: false,
      isError: false,
      onSelect: vi.fn(),
      emptyTitle: 'No workspaces',
      emptyDescription: 'Try again later.',
    })
    const link = await screen.findByRole('link', { name: /open in imanage/i })
    expect(link).toHaveAttribute('href', 'https://fireman.cloudimanage.com/work/web/r/libraries/ACTIVE/workspaces/ACTIVE!123772')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })
})
