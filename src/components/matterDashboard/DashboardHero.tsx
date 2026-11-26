import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Workspace } from '@/types/workspace'

/**
 * Read-only header for the Matter Dashboard: name, description, and iManage
 * metadata only -- deliberately not the interactive MatterProfileCard used on
 * the Matter Knowledge page (no reclassify/correction controls here). Editing
 * classification fields stays a Matter Knowledge page concern.
 */
export function DashboardHero({ workspace }: { workspace: Workspace }) {
  const metadata: Array<{ label: string; value: string }> = [
    { label: 'Client', value: workspace.client ?? '—' },
    { label: 'Owner', value: workspace.owner ?? '—' },
    { label: 'Last Modified', value: workspace.lastModified ?? '—' },
    { label: 'Workspace ID', value: workspace.id },
    { label: 'Source', value: 'iManage Work' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-2xl font-semibold">{workspace.name}</CardTitle>
        <CardDescription className="text-sm">{workspace.matter ?? 'No description available from iManage.'}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          {metadata.map((item) => (
            <div key={item.label} className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
              <dd className="text-sm text-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
