import { useParams } from 'react-router-dom'
import { ArrowLeft, Building2, Calendar, FileText, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router-dom'
import { useWorkspaceCache } from '@/context/WorkspaceCacheContext'

const FIELDS: Array<{ key: 'client' | 'matter' | 'owner' | 'lastModified'; label: string; icon: typeof Building2 }> = [
  { key: 'client', label: 'Client', icon: Building2 },
  { key: 'matter', label: 'Matter', icon: FileText },
  { key: 'owner', label: 'Owner', icon: User },
  { key: 'lastModified', label: 'Last Modified', icon: Calendar },
]

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
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-xl">{workspace.name}</CardTitle>
            <CardDescription>iManage workspace ID: {workspace.id}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {FIELDS.filter((field) => workspace[field.key]).map((field) => (
                <div key={field.key} className="flex items-start gap-2.5">
                  <field.icon className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">{field.label}</dt>
                    <dd className="text-sm text-foreground">{workspace[field.key]}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
