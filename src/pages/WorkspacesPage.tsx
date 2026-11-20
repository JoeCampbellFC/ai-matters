import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConnectPrompt } from '@/components/workspaces/ConnectPrompt'
import { WorkspaceTable } from '@/components/workspaces/WorkspaceTable'
import { WorkspaceToolbar } from '@/components/workspaces/WorkspaceToolbar'
import { useWorkspaceCache } from '@/context/WorkspaceCacheContext'
import { useLibraries } from '@/hooks/useLibraries'
import { useMcpStatus } from '@/hooks/useMcpConnection'
import { useRecentWorkspaces, useWorkspaceSearch } from '@/hooks/useWorkspaces'
import { startMcpConnect } from '@/services/mcpService'
import type { Workspace } from '@/types/workspace'

export function WorkspacesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { remember } = useWorkspaceCache()
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useMcpStatus()

  const connected = status?.state === 'connected'
  const canSearch = connected && status?.tools?.searchWorkspaces
  const canListRecent = connected && status?.tools?.getRecentWorkspaces

  const [activeTab, setActiveTab] = useState<'recent' | 'search'>(canListRecent === false ? 'search' : 'recent')
  const [searchInput, setSearchInput] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [libraryId, setLibraryId] = useState<string | undefined>(undefined)

  const { data: libraries = [] } = useLibraries(connected ?? false)

  const recent = useRecentWorkspaces({ enabled: Boolean(canListRecent) && activeTab === 'recent', libraryId })
  const search = useWorkspaceSearch({ query: submittedQuery, libraryId, enabled: Boolean(canSearch) && activeTab === 'search' })

  useEffect(() => {
    if (recent.data) remember(recent.data)
  }, [recent.data, remember])

  useEffect(() => {
    if (search.data) remember(search.data)
  }, [search.data, remember])

  function handleSelect(workspace: Workspace) {
    remember([workspace])
    navigate(`/workspaces/${encodeURIComponent(workspace.id)}`)
  }

  const activeQuery = activeTab === 'recent' ? recent : search

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Workspaces</h1>
        <p className="mt-1 text-sm text-muted-foreground">Find and explore your matters from iManage Work.</p>
      </div>

      {searchParams.get('connection') === 'error' && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Connection failed</AlertTitle>
          <AlertDescription>
            We couldn't complete the iManage connection. Check the Settings page for details, or try connecting again.
          </AlertDescription>
        </Alert>
      )}

      {!statusLoading && (status?.state === 'not_connected' || status?.state === 'auth_required') && <ConnectPrompt />}

      {!statusLoading && status?.state === 'permission_denied' && (
        <Alert variant="destructive">
          <ShieldAlert className="size-4" />
          <AlertTitle>Permission denied</AlertTitle>
          <AlertDescription>
            Your iManage account or AI Matters is not authorized to use the Work MCP tools. Ask your iManage
            administrator to allow AI Matters as an MCP client and grant the required read tools in Control Center.
          </AlertDescription>
        </Alert>
      )}

      {!statusLoading && status?.state === 'error' && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Couldn't reach the iManage MCP server</AlertTitle>
          <AlertDescription>
            {status.error ?? 'An unexpected error occurred while connecting.'}{' '}
            <Button variant="link" className="h-auto p-0" onClick={() => refetchStatus()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {connected && (
        <div className="flex flex-col gap-4">
          <WorkspaceToolbar
            searchTerm={searchInput}
            onSearchTermChange={setSearchInput}
            onSubmitSearch={() => {
              setActiveTab('search')
              setSubmittedQuery(searchInput.trim())
            }}
            onRefresh={() => {
              if (activeTab === 'recent') recent.refetch()
              else search.refetch()
            }}
            isRefreshing={activeQuery.isFetching}
            libraries={libraries}
            libraryId={libraryId}
            onLibraryChange={setLibraryId}
            connectionState={status.state}
          />

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'recent' | 'search')}>
            <TabsList>
              {canListRecent && <TabsTrigger value="recent">Recent</TabsTrigger>}
              {canSearch && <TabsTrigger value="search">Search results</TabsTrigger>}
            </TabsList>

            {canListRecent && (
              <TabsContent value="recent" className="mt-4">
                <WorkspaceTable
                  workspaces={recent.data ?? []}
                  isLoading={recent.isLoading}
                  isError={recent.isError}
                  errorMessage={recent.error instanceof Error ? recent.error.message : undefined}
                  onSelect={handleSelect}
                  emptyTitle="No recent workspaces"
                  emptyDescription="Workspaces you've opened recently in iManage Work will show up here."
                />
              </TabsContent>
            )}

            {canSearch && (
              <TabsContent value="search" className="mt-4">
                {submittedQuery ? (
                  <WorkspaceTable
                    workspaces={search.data ?? []}
                    isLoading={search.isLoading}
                    isError={search.isError}
                    errorMessage={search.error instanceof Error ? search.error.message : undefined}
                    onSelect={handleSelect}
                    emptyTitle="No matching workspaces"
                    emptyDescription={`No workspaces matched "${submittedQuery}". Try a different search term.`}
                  />
                ) : (
                  <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
                    Enter a search term above to find workspaces, clients or matters.
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        </div>
      )}

      {!statusLoading && status?.state === 'tool_unavailable' && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>Required tools unavailable</AlertTitle>
          <AlertDescription>
            {status.error ?? 'The iManage MCP connection does not expose the workspace tools AI Matters needs.'}{' '}
            <Button variant="link" className="h-auto p-0" onClick={() => startMcpConnect()}>
              Reconnect
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
