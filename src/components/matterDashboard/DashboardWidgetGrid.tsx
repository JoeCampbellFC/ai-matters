import type { CitationRegistryEntry } from '@/types/research'
import type { DashboardWidget } from '@/types/dashboard'
import { OverviewWidget } from './widgets/OverviewWidget'
import { TimelineWidget } from './widgets/TimelineWidget'
import { PartiesWidget } from './widgets/PartiesWidget'
import { IssuesWidget } from './widgets/IssuesWidget'
import { OutcomesWidget } from './widgets/OutcomesWidget'
import { CustomWidget } from './widgets/CustomWidget'

/** Dispatches each widget to its renderer by `type` -- an unrecognized type (e.g. a newer schema version) is skipped rather than crashing the page. */
export function DashboardWidgetGrid({ widgets, citationRegistry }: { widgets: DashboardWidget[]; citationRegistry: CitationRegistryEntry[] }) {
  const ordered = [...widgets].sort((a, b) => a.order - b.order)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {ordered.map((widget) => {
        switch (widget.type) {
          case 'overview':
            return <OverviewWidget key={widget.id} widget={widget} citationRegistry={citationRegistry} />
          case 'timeline':
            return <TimelineWidget key={widget.id} widget={widget} citationRegistry={citationRegistry} />
          case 'parties':
            return <PartiesWidget key={widget.id} widget={widget} citationRegistry={citationRegistry} />
          case 'issues':
            return <IssuesWidget key={widget.id} widget={widget} citationRegistry={citationRegistry} />
          case 'outcomes':
            return <OutcomesWidget key={widget.id} widget={widget} citationRegistry={citationRegistry} />
          case 'custom':
            return <CustomWidget key={widget.id} widget={widget} citationRegistry={citationRegistry} />
          default:
            return null
        }
      })}
    </div>
  )
}
