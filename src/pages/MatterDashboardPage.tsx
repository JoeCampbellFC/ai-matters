import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FolderOpen, Loader2, Sparkles } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardWidgetGrid } from '@/components/matterDashboard/DashboardWidgetGrid'
import { MatterDocumentsPanel } from '@/components/matterDashboard/MatterDocumentsPanel'
import { MatterProfileCard } from '@/components/matterProfile/MatterProfileCard'
import { DocumentFocusProvider } from '@/context/DocumentFocusContext'
import { useWorkspaceCache } from '@/context/WorkspaceCacheContext'
import { useMatterDashboard } from '@/hooks/useMatterDashboard'

export function MatterDashboardPage() {
  const { id } = useParams<{ id: string }>()
  const { getWorkspace } = useWorkspaceCache()
  const workspace = id ? getWorkspace(id) : undefined
  const workspaceId = id ?? ''
  const { data, loading, generating, error, generate } = useMatterDashboard(workspaceId)
  const [documentsOpen, setDocumentsOpen] = useState(false)

  const openDocuments = useCallback(() => setDocumentsOpen(true), [])

  if (!workspace) {
    return (
      <div className="flex flex-col gap-6">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link to="/workspaces">
            <ArrowLeft className="size-4" />
            Back to Workspaces
          </Link>
        </Button>
        <Card className="mx-auto max-w-lg">
          <CardHeader>
            <CardTitle>Workspace not found</CardTitle>
            <CardDescription>
              This workspace wasn't found in your current session. Go back to Workspaces and select it again.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <DocumentFocusProvider onFocus={openDocuments}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="w-fit" asChild>
            <Link to={`/workspaces/${encodeURIComponent(workspaceId)}`}>
              <ArrowLeft className="size-4" />
              Back to {workspace.name}
            </Link>
          </Button>

          <Sheet open={documentsOpen} onOpenChange={setDocumentsOpen}>
            <SheetTrigger asChild>
              <Button variant="outline">
                <FolderOpen className="size-4" />
                Documents
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
              <SheetHeader>
                <SheetTitle>Documents</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-hidden px-4 pb-4">
                <MatterDocumentsPanel workspaceId={workspaceId} citationRegistry={data?.citationRegistry ?? []} />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <h1 className="font-heading text-xl font-medium text-foreground">{workspace.name} — Matter Dashboard</h1>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Couldn't load the dashboard</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <MatterProfileCard
          workspaceId={workspaceId}
          workspaceName={workspace.name}
          client={workspace.client}
          matter={workspace.matter}
          owner={workspace.owner}
          lastModified={workspace.lastModified}
          researchStatus="idle"
          classificationFieldsLive={{}}
        />

        {loading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        ) : !data?.generated ? (
          <Card>
            <CardHeader className="items-center text-center">
              <CardTitle>No dashboard yet for this Matter Knowledge File</CardTitle>
              <CardDescription>
                Generate a structured dashboard from the currently published Matter Knowledge File. This never re-runs research —
                it only transforms the Markdown that's already there.
              </CardDescription>
              <Button className="mt-2" onClick={() => void generate()} disabled={generating}>
                {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {generating ? 'Generating…' : 'Generate Dashboard'}
              </Button>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => void generate()} disabled={generating}>
                {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Regenerate
              </Button>
            </div>
            <DashboardWidgetGrid widgets={data.projection?.widgets ?? []} citationRegistry={data.citationRegistry} />
          </>
        )}
      </div>
    </DocumentFocusProvider>
  )
}
