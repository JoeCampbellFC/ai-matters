import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CitationBadgeList } from '../CitationBadgeList'
import type { CitationRegistryEntry } from '@/types/research'
import type { DashboardWidget } from '@/types/dashboard'

/**
 * The single Matter Overview section -- combines the matter's iManage
 * description (always available, no generation needed) with the AI-generated
 * narrative summary once a dashboard has been generated. Deliberately one
 * widget rather than splitting the iManage description into the hero and the
 * AI summary into its own separate card.
 */
export function MatterOverviewWidget({
  matterDescription,
  summaryWidget,
  citationRegistry,
}: {
  matterDescription?: string
  summaryWidget?: Extract<DashboardWidget, { type: 'overview' }>
  citationRegistry: CitationRegistryEntry[]
}) {
  const hasDescription = Boolean(matterDescription?.trim())
  const hasSummary = Boolean(summaryWidget)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Matter Overview</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {hasDescription && <p className="text-sm text-foreground">{matterDescription}</p>}
        {hasDescription && hasSummary && <Separator />}
        {summaryWidget && (
          <>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{summaryWidget.summary}</p>
            <CitationBadgeList sourceRefs={summaryWidget.sourceRefs} citationRegistry={citationRegistry} />
          </>
        )}
        {!hasDescription && !hasSummary && (
          <p className="text-sm text-muted-foreground">No overview available yet. Generate a dashboard to summarize this matter.</p>
        )}
      </CardContent>
    </Card>
  )
}
