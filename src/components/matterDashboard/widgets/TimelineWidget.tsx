import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CitationBadgeList } from '../CitationBadgeList'
import type { CitationRegistryEntry } from '@/types/research'
import type { DashboardWidget, TimelineEvent } from '@/types/dashboard'

const STATUS_VARIANT: Record<TimelineEvent['status'], 'default' | 'secondary' | 'outline'> = {
  completed: 'default',
  planned: 'secondary',
  expected: 'secondary',
  unknown: 'outline',
}

const STATUS_LABEL: Record<TimelineEvent['status'], string> = {
  completed: 'Completed',
  planned: 'Planned',
  expected: 'Expected',
  unknown: 'Unclear',
}

export function TimelineWidget({
  widget,
  citationRegistry,
}: {
  widget: Extract<DashboardWidget, { type: 'timeline' }>
  citationRegistry: CitationRegistryEntry[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{widget.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-4 border-l pl-4">
          {widget.events.map((event) => (
            <li key={event.id} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                {event.date && <span className="text-xs font-medium text-muted-foreground">{event.date}</span>}
                <Badge variant={STATUS_VARIANT[event.status]}>{STATUS_LABEL[event.status]}</Badge>
              </div>
              <p className="text-sm font-medium text-foreground">{event.title}</p>
              {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
              <CitationBadgeList sourceRefs={event.sourceRefs} citationRegistry={citationRegistry} />
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
