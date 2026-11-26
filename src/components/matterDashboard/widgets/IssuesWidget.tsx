import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CitationBadgeList } from '../CitationBadgeList'
import type { CitationRegistryEntry } from '@/types/research'
import type { DashboardWidget } from '@/types/dashboard'

export function IssuesWidget({
  widget,
  citationRegistry,
}: {
  widget: Extract<DashboardWidget, { type: 'issues' }>
  citationRegistry: CitationRegistryEntry[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{widget.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {widget.issues.map((issue, index) => (
          <div key={issue.id} className="flex flex-col gap-1">
            {index > 0 && <Separator className="mb-2" />}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">{issue.title}</span>
              {issue.status && <Badge variant="secondary">{issue.status}</Badge>}
            </div>
            {issue.description && <p className="text-sm text-muted-foreground">{issue.description}</p>}
            <CitationBadgeList sourceRefs={issue.sourceRefs} citationRegistry={citationRegistry} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
