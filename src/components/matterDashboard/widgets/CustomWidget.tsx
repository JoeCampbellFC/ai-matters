import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CitationBadgeList } from '../CitationBadgeList'
import type { CitationRegistryEntry } from '@/types/research'
import type { DashboardWidget } from '@/types/dashboard'

export function CustomWidget({
  widget,
  citationRegistry,
}: {
  widget: Extract<DashboardWidget, { type: 'custom' }>
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
            <span className="text-sm font-medium text-foreground">{item.title}</span>
            {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
            <CitationBadgeList sourceRefs={item.sourceRefs} citationRegistry={citationRegistry} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
