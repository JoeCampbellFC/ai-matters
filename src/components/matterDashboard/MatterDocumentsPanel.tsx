import { useState } from 'react'
import { ChevronRight, File, Folder, Loader2, Mail, Search as SearchIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentFocus } from '@/context/DocumentFocusContext'
import { useMatterDocuments } from '@/hooks/useMatterDocuments'
import { cn } from '@/lib/utils'
import type { CitationRegistryEntry } from '@/types/research'
import type { ContainerChild } from '@/types/documents'

function ItemIcon({ type }: { type: ContainerChild['type'] }) {
  if (type === 'folder' || type === 'tab') return <Folder className="size-4 shrink-0 text-muted-foreground" />
  if (type === 'email') return <Mail className="size-4 shrink-0 text-muted-foreground" />
  return <File className="size-4 shrink-0 text-muted-foreground" />
}

/**
 * The live iManage Documents panel: Browse (lazy, one folder at a time via
 * get_container_children), Search (workspace-scoped, membership-verified),
 * and Sources (the matter's citation registry, highlighted when a widget's
 * citation badge is clicked -- see DocumentFocusContext).
 */
export function MatterDocumentsPanel({ workspaceId, citationRegistry }: { workspaceId: string; citationRegistry: CitationRegistryEntry[] }) {
  const { path, children, hasMore, loading, error, openFolder, goToCrumb, loadMore, searchResult, searching, searchError, search } =
    useMatterDocuments(workspaceId)
  const [query, setQuery] = useState('')
  const { focusedMarker } = useDocumentFocus()

  return (
    <Tabs defaultValue={focusedMarker ? 'sources' : 'browse'} className="flex h-full min-h-0 flex-col gap-2">
      <TabsList>
        <TabsTrigger value="browse">Browse</TabsTrigger>
        <TabsTrigger value="search">Search</TabsTrigger>
        <TabsTrigger value="sources">Sources{citationRegistry.length > 0 ? ` (${citationRegistry.length})` : ''}</TabsTrigger>
      </TabsList>

      <TabsContent value="browse" className="min-h-0 flex-1">
        <div className="flex h-full flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1 px-1 text-sm text-muted-foreground">
            <button type="button" className="hover:underline" onClick={() => goToCrumb(-1)}>
              Workspace
            </button>
            {path.map((crumb, index) => (
              <span key={crumb.containerId} className="flex items-center gap-1">
                <ChevronRight className="size-3" />
                <button type="button" className="hover:underline" onClick={() => goToCrumb(index)}>
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>
          {error && <p className="px-1 text-sm text-destructive">{error}</p>}
          <ScrollArea className="min-h-0 flex-1">
            <ul className="flex flex-col">
              {children.map((child) => (
                <li key={child.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent"
                    onClick={() => openFolder(child)}
                    disabled={child.type !== 'folder' && child.type !== 'tab'}
                  >
                    <ItemIcon type={child.type} />
                    <span className="truncate">{child.name ?? child.id}</span>
                  </button>
                </li>
              ))}
              {children.length === 0 && !loading && (
                <li className="px-2 py-4 text-sm text-muted-foreground">No items in this folder.</li>
              )}
            </ul>
            {hasMore && (
              <Button variant="ghost" size="sm" className="m-2" onClick={loadMore} disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                Load more
              </Button>
            )}
            {loading && children.length === 0 && (
              <div className="flex justify-center p-4">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </ScrollArea>
        </div>
      </TabsContent>

      <TabsContent value="search" className="min-h-0 flex-1">
        <div className="flex h-full flex-col gap-2">
          <form
            className="flex gap-2 px-1"
            onSubmit={(e) => {
              e.preventDefault()
              void search(query)
            }}
          >
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this matter's documents…" />
            <Button type="submit" size="icon" disabled={searching}>
              {searching ? <Loader2 className="size-4 animate-spin" /> : <SearchIcon className="size-4" />}
            </Button>
          </form>
          {searchError && <p className="px-1 text-sm text-destructive">{searchError}</p>}
          <ScrollArea className="min-h-0 flex-1">
            <ul className="flex flex-col">
              {searchResult?.hits.map((hit) => (
                <li key={hit.documentId} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                  <File className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{hit.name ?? hit.documentId}</span>
                </li>
              ))}
            </ul>
            {searchResult && searchResult.hits.length === 0 && (
              <p className="px-2 py-4 text-sm text-muted-foreground">No verified matches in this matter's workspace.</p>
            )}
            {searchResult && searchResult.excludedCount > 0 && (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                {searchResult.excludedCount} additional {searchResult.excludedCount === 1 ? 'result' : 'results'} excluded — not confirmed
                members of this workspace.
              </p>
            )}
          </ScrollArea>
        </div>
      </TabsContent>

      <TabsContent value="sources" className="min-h-0 flex-1">
        <ScrollArea className="h-full">
          <ul className="flex flex-col">
            {citationRegistry.map((entry) => (
              <li
                key={entry.marker}
                className={cn('flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors', focusedMarker === entry.marker && 'bg-muted')}
              >
                <Badge variant="outline">{entry.marker}</Badge>
                <span className="truncate">{entry.documentName ?? entry.documentId}</span>
              </li>
            ))}
            {citationRegistry.length === 0 && (
              <li className="px-2 py-4 text-sm text-muted-foreground">No citations recorded for this Matter Knowledge File.</li>
            )}
          </ul>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  )
}
