import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CitationBadgeList } from '../CitationBadgeList'
import type { CitationRegistryEntry } from '@/types/research'
import type { DashboardWidget } from '@/types/dashboard'

export function OverviewWidget({
  widget,
  citationRegistry,
}: {
  widget: Extract<DashboardWidget, { type: 'overview' }>
  citationRegistry: CitationRegistryEntry[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{widget.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm whitespace-pre-wrap text-foreground">{widget.summary}</p>
        <CitationBadgeList sourceRefs={widget.sourceRefs} citationRegistry={citationRegistry} />
      </CardContent>
    </Card>
  )
}
