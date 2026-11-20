import { RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConnectionStatusBadge } from './ConnectionStatusBadge'
import type { Library, McpConnectionState } from '@/types/workspace'

const ALL_LIBRARIES = '__all__'

interface WorkspaceToolbarProps {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  onSubmitSearch: () => void
  onRefresh: () => void
  isRefreshing: boolean
  libraries: Library[]
  libraryId?: string
  onLibraryChange: (libraryId: string | undefined) => void
  connectionState: McpConnectionState
}

export function WorkspaceToolbar({
  searchTerm,
  onSearchTermChange,
  onSubmitSearch,
  onRefresh,
  isRefreshing,
  libraries,
  libraryId,
  onLibraryChange,
  connectionState,
}: WorkspaceToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <form
        className="flex flex-1 items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmitSearch()
        }}
      >
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search workspaces, clients or matters..."
            className="pl-8"
          />
        </div>
        <Button type="submit">Search</Button>
        {libraries.length > 0 && (
          <Select
            value={libraryId ?? ALL_LIBRARIES}
            onValueChange={(value) => onLibraryChange(value === ALL_LIBRARIES ? undefined : value)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All libraries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_LIBRARIES}>All libraries</SelectItem>
              {libraries.map((library) => (
                <SelectItem key={library.id} value={library.id}>
                  {library.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </form>
      <div className="flex items-center gap-2">
        <ConnectionStatusBadge state={connectionState} />
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw className={isRefreshing ? 'size-3.5 animate-spin' : 'size-3.5'} />
          Refresh
        </Button>
      </div>
    </div>
  )
}
