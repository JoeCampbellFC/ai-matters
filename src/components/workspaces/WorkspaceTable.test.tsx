import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceTable } from './WorkspaceTable'
import type { Workspace } from '@/types/workspace'

function workspace(overrides: Partial<Workspace>): Workspace {
  return { id: 'WS-1', name: 'Acme Matter', raw: {}, ...overrides }
}

describe('WorkspaceTable', () => {
  it('shows the empty state when there are no workspaces', () => {
    render(
      <WorkspaceTable
        workspaces={[]}
        isLoading={false}
        isError={false}
        onSelect={vi.fn()}
        emptyTitle="No workspaces"
        emptyDescription="Try again later."
      />,
    )
    expect(screen.getByText('No workspaces')).toBeInTheDocument()
  })

  it('shows the error state with the provided message', () => {
    render(
      <WorkspaceTable
        workspaces={[]}
        isLoading={false}
        isError
        errorMessage="The MCP server is unreachable."
        onSelect={vi.fn()}
        emptyTitle="No workspaces"
        emptyDescription="Try again later."
      />,
    )
    expect(screen.getByText('The MCP server is unreachable.')).toBeInTheDocument()
  })

  it('hides optional columns when no row has that field', () => {
    render(
      <WorkspaceTable
        workspaces={[workspace({})]}
        isLoading={false}
        isError={false}
        onSelect={vi.fn()}
        emptyTitle="No workspaces"
        emptyDescription="Try again later."
      />,
    )
    expect(screen.queryByText('Client')).not.toBeInTheDocument()
    expect(screen.queryByText('Matter')).not.toBeInTheDocument()
    expect(screen.getByText('Workspace')).toBeInTheDocument()
  })

  it('shows a populated column and calls onSelect when a row is clicked', () => {
    const onSelect = vi.fn()
    const ws = workspace({ client: 'Acme Corp' })
    render(
      <WorkspaceTable
        workspaces={[ws]}
        isLoading={false}
        isError={false}
        onSelect={onSelect}
        emptyTitle="No workspaces"
        emptyDescription="Try again later."
      />,
    )
    expect(screen.getByText('Client')).toBeInTheDocument()
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Acme Matter'))
    expect(onSelect).toHaveBeenCalledWith(ws)
  })
})
