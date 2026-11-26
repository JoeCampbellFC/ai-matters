import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, FolderOpen, Inbox } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMcpStatus } from '@/hooks/useMcpConnection'
import { buildImanageWorkspaceUrl } from '@/lib/imanageUrl'
import type { MatterSummary } from '@/types/matterProfile'
import type { Workspace } from '@/types/workspace'

type SortKey = 'name' | 'client' | 'matter' | 'owner' | 'lastModified'

interface Column {
  key: SortKey
  label: string
  show: (workspaces: Workspace[]) => boolean
}

const COLUMNS: Column[] = [
  { key: 'name', label: 'Workspace', show: () => true },
  { key: 'client', label: 'Client', show: (ws) => ws.some((w) => w.client) },
  { key: 'matter', label: 'Matter', show: (ws) => ws.some((w) => w.matter) },
  { key: 'owner', label: 'Owner', show: (ws) => ws.some((w) => w.owner) },
  { key: 'lastModified', label: 'Last Modified', show: (ws) => ws.some((w) => w.lastModified) },
]

interface WorkspaceTableProps {
  workspaces: Workspace[]
  isLoading: boolean
  isError: boolean
  errorMessage?: string
  selectedId?: string
  onSelect: (workspace: Workspace) => void
  emptyTitle: string
  emptyDescription: string
  /** Keyed by workspaceId -- persisted Phase 4 "already analysed" status, batch-fetched by the caller. Omitted columns render only once at least one row has a summary. */
  matterSummaries?: Map<string, MatterSummary>
}

export function WorkspaceTable({
  workspaces,
  isLoading,
  isError,
  errorMessage,
  selectedId,
  onSelect,
  emptyTitle,
  emptyDescription,
  matterSummaries,
}: WorkspaceTableProps) {
  const showMatterColumn = Boolean(matterSummaries?.size)
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null)
  const { data: mcpStatus } = useMcpStatus()

  const visibleColumns = useMemo(() => COLUMNS.filter((column) => column.show(workspaces)), [workspaces])

  const sortedWorkspaces = useMemo(() => {
    if (!sort) return workspaces
    const { key, direction } = sort
    const factor = direction === 'asc' ? 1 : -1
    return [...workspaces].sort((a, b) => {
      const aValue = a[key] ?? ''
      const bValue = b[key] ?? ''
      if (!aValue && !bValue) return 0
      if (!aValue) return 1
      if (!bValue) return -1
      return factor * aValue.localeCompare(bValue)
    })
  }, [workspaces, sort])

  function toggleSort(key: SortKey) {
    setSort((current) => {
      if (current?.key !== key) return { key, direction: 'asc' }
      if (current.direction === 'asc') return { key, direction: 'desc' }
      return null
    })
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Couldn't load workspaces</AlertTitle>
        <AlertDescription>{errorMessage ?? 'An unexpected error occurred. Please try again.'}</AlertDescription>
      </Alert>
    )
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((column) => (
                <TableHead key={column.key}>{column.label}</TableHead>
              ))}
              {showMatterColumn && <TableHead>Knowledge</TableHead>}
              <TableHead className="w-36" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, index) => (
              <TableRow key={index}>
                {COLUMNS.map((column) => (
                  <TableCell key={column.key}>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                ))}
                {showMatterColumn && (
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                )}
                <TableCell>
                  <Skeleton className="h-7 w-16" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (workspaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
        <Inbox className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{emptyDescription}</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            {visibleColumns.map((column) => (
              <TableHead key={column.key}>
                <button
                  type="button"
                  onClick={() => toggleSort(column.key)}
                  className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                >
                  {column.label}
                  {sort?.key === column.key ? (
                    sort.direction === 'asc' ? (
                      <ArrowUp className="size-3.5" />
                    ) : (
                      <ArrowDown className="size-3.5" />
                    )
                  ) : (
                    <ArrowUpDown className="size-3.5 text-muted-foreground/50" />
                  )}
                </button>
              </TableHead>
            ))}
            {showMatterColumn && <TableHead>Knowledge</TableHead>}
            <TableHead className="w-36">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedWorkspaces.map((workspace) => (
            <TableRow
              key={workspace.id}
              data-state={selectedId === workspace.id ? 'selected' : undefined}
              className="cursor-pointer"
              onClick={() => onSelect(workspace)}
            >
              {visibleColumns.map((column) => (
                <TableCell key={column.key} className={column.key === 'name' ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                  {workspace[column.key] ?? '—'}
                </TableCell>
              ))}
              {showMatterColumn && (
                <TableCell>
                  {matterSummaries?.get(workspace.id) ? (
                    <Badge variant="outline">{matterSummaries.get(workspace.id)!.hasKnowledge ? 'Generated' : 'Not Generated'}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              )}
              <TableCell>
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation()
                      onSelect(workspace)
                    }}
                  >
                    <FolderOpen className="size-3.5" />
                    Open
                  </Button>
                  {(() => {
                    const imanageUrl = buildImanageWorkspaceUrl(mcpStatus?.environment, workspace.id)
                    if (!imanageUrl) return null
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon-sm" asChild onClick={(event) => event.stopPropagation()}>
                            <a href={imanageUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="size-3.5" />
                              <span className="sr-only">Open in iManage</span>
                            </a>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Open in iManage</TooltipContent>
                      </Tooltip>
                    )
                  })()}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
