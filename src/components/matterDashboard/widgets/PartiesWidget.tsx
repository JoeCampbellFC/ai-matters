import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CitationBadgeList } from '../CitationBadgeList'
import type { CitationRegistryEntry } from '@/types/research'
import type { DashboardWidget } from '@/types/dashboard'

export function PartiesWidget({
  widget,
  citationRegistry,
}: {
  widget: Extract<DashboardWidget, { type: 'parties' }>
  citationRegistry: CitationRegistryEntry[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{widget.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {widget.parties.map((party, index) => (
          <div key={party.id} className="flex flex-col gap-1">
            {index > 0 && <Separator className="mb-2" />}
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-medium text-foreground">{party.name}</span>
              <span className="text-xs text-muted-foreground">
                {party.role}
                {party.organisation ? ` · ${party.organisation}` : ''}
              </span>
            </div>
            {party.description && <p className="text-sm text-muted-foreground">{party.description}</p>}
            <CitationBadgeList sourceRefs={party.sourceRefs} citationRegistry={citationRegistry} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
