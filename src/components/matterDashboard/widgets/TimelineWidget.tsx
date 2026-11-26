import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineDescription,
  TimelineIndicator,
  TimelineItem,
  TimelineTime,
  TimelineTitle,
} from '@/components/ui/timeline'
import { CitationBadgeList } from '../CitationBadgeList'
import type { CitationRegistryEntry } from '@/types/research'
import type { DashboardWidget, TimelineEvent } from '@/types/dashboard'

const STATUS_INDICATOR: Record<TimelineEvent['status'], 'default' | 'primary' | 'success' | 'warning'> = {
  completed: 'success',
  planned: 'primary',
  expected: 'warning',
  unknown: 'default',
}

const STATUS_BADGE_VARIANT: Record<TimelineEvent['status'], 'default' | 'secondary' | 'outline'> = {
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
        <Timeline>
          {widget.events.map((event) => (
            <TimelineItem key={event.id}>
              <TimelineIndicator variant={STATUS_INDICATOR[event.status]} />
              <TimelineConnector />
              <TimelineContent>
                <div className="flex flex-wrap items-center gap-2">
                  {event.date && <TimelineTime>{event.date}</TimelineTime>}
                  <Badge variant={STATUS_BADGE_VARIANT[event.status]}>{STATUS_LABEL[event.status]}</Badge>
                </div>
                <TimelineTitle>{event.title}</TimelineTitle>
                {event.description && <TimelineDescription>{event.description}</TimelineDescription>}
                <CitationBadgeList sourceRefs={event.sourceRefs} citationRegistry={citationRegistry} />
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      </CardContent>
    </Card>
  )
}
