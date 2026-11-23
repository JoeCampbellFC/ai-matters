import { useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router-dom'
import { useWorkspaceCache } from '@/context/WorkspaceCacheContext'
import { MatterKnowledgePanel } from '@/components/matterResearch/MatterKnowledgePanel'

export function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { getWorkspace } = useWorkspaceCache()
  const workspace = id ? getWorkspace(id) : undefined

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link to="/workspaces">
          <ArrowLeft className="size-4" />
          Back to Workspaces
        </Link>
      </Button>

      {!workspace ? (
        <Card className="mx-auto max-w-lg">
          <CardHeader>
            <CardTitle>Workspace not found</CardTitle>
            <CardDescription>
              This workspace wasn't found in your current session. Go back to Workspaces and select it again from
              Recent or Search results.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <MatterKnowledgePanel workspace={workspace} />
      )}
    </div>
  )
}
