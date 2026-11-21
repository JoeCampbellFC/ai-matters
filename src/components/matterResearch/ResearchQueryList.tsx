import { CircleDot, Loader2, SearchCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { SearchQueryItem, SearchQueryStatus } from '@/types/research'

const STATUS_CONFIG: Record<SearchQueryStatus, { label: string; icon: typeof CircleDot; className: string }> = {
  planned: {
    label: 'Planned',
    icon: CircleDot,
    className: 'border-border text-muted-foreground',
  },
  searching: {
    label: 'Searching…',
    icon: Loader2,
    className: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-400',
  },
  completed: {
    label: 'Done',
    icon: SearchCheck,
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400',
  },
}

function QueryStatusBadge({ status }: { status: SearchQueryStatus }) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  return (
    <Badge variant="outline" className={cn(config.className)}>
      <Icon className={cn('size-3', status === 'searching' && 'animate-spin')} />
      {config.label}
    </Badge>
  )
}

/** Shows exactly what the agent is searching for, in what order, and with what result -- not just a buried activity-log line. */
export function ResearchQueryList({ queries }: { queries: SearchQueryItem[] }) {
  if (queries.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        No searches planned yet.
      </div>
    )
  }

  const sorted = [...queries].sort((a, b) => a.iteration - b.iteration)

  return (
    <ol className="flex flex-col gap-2">
      {sorted.map((item) => (
        <li
          key={item.query}
          className="flex flex-col gap-1 rounded-md border border-border p-2.5 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-3"
        >
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground">&ldquo;{item.query}&rdquo;</span>
            <span className="text-xs text-muted-foreground">{item.rationale}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start">
            {item.status === 'completed' && (
              <span className="text-xs text-muted-foreground">
                {item.resultCount} {item.resultCount === 1 ? 'result' : 'results'}
              </span>
            )}
            <QueryStatusBadge status={item.status} />
          </div>
        </li>
      ))}
    </ol>
  )
}
