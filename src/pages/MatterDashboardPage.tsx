import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardHero } from '@/components/matterDashboard/DashboardHero'
import { DashboardWidgetGrid } from '@/components/matterDashboard/DashboardWidgetGrid'
import { DocumentsWidget } from '@/components/matterDashboard/widgets/DocumentsWidget'
import { MatterOverviewWidget } from '@/components/matterDashboard/widgets/MatterOverviewWidget'
import { DocumentFocusProvider } from '@/context/DocumentFocusContext'
import { useWorkspaceCache } from '@/context/WorkspaceCacheContext'
import { useMatterDashboard } from '@/hooks/useMatterDashboard'
import type { DashboardWidget } from '@/types/dashboard'

export function MatterDashboardPage() {
  const { id } = useParams<{ id: string }>()
  const { getWorkspace } = useWorkspaceCache()
  const workspace = id ? getWorkspace(id) : undefined
  const workspaceId = id ?? ''
  const { data, loading, generating, error, generate } = useMatterDashboard(workspaceId)
  const allWidgets = data?.projection?.widgets ?? []
  const overviewWidget = allWidgets.find((w): w is Extract<DashboardWidget, { type: 'overview' }> => w.type === 'overview')
  const otherWidgets = allWidgets.filter((w) => w.type !== 'overview')

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
    <DocumentFocusProvider>
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link to={`/workspaces/${encodeURIComponent(workspaceId)}`}>
            <ArrowLeft className="size-4" />
            Back to {workspace.name}
          </Link>
        </Button>

        <DashboardHero workspace={workspace} />

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Couldn't load the dashboard</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <MatterOverviewWidget
          matterDescription={workspace.matter}
          summaryWidget={overviewWidget}
          citationRegistry={data?.citationRegistry ?? []}
        />

        <DocumentsWidget workspaceId={workspaceId} citationRegistry={data?.citationRegistry ?? []} />

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
            <DashboardWidgetGrid widgets={otherWidgets} citationRegistry={data.citationRegistry} />
          </>
        )}
      </div>
    </DocumentFocusProvider>
  )
}
