import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CitationBadgeList } from '../CitationBadgeList'
import type { CitationRegistryEntry } from '@/types/research'
import type { DashboardWidget, OutcomeItem } from '@/types/dashboard'

const KIND_LABEL: Record<OutcomeItem['kind'], string> = {
  outcome: 'Outcome',
  next_step: 'Next Step',
  uncertainty: 'Open Question',
}

const KIND_VARIANT: Record<OutcomeItem['kind'], 'default' | 'secondary' | 'outline'> = {
  outcome: 'default',
  next_step: 'secondary',
  uncertainty: 'outline',
}

export function OutcomesWidget({
  widget,
  citationRegistry,
}: {
  widget: Extract<DashboardWidget, { type: 'outcomes' }>
  citationRegistry: CitationRegistryEntry[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{widget.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {widget.items.map((item, index) => (
          <div key={item.id} className="flex flex-col gap-1">
            {index > 0 && <Separator className="mb-2" />}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={KIND_VARIANT[item.kind]}>{KIND_LABEL[item.kind]}</Badge>
              <span className="text-sm font-medium text-foreground">{item.title}</span>
              {item.dueDate && <span className="text-xs text-muted-foreground">Due {item.dueDate}</span>}
            </div>
            {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
            <CitationBadgeList sourceRefs={item.sourceRefs} citationRegistry={citationRegistry} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
