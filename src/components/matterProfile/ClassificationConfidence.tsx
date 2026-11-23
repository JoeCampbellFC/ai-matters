import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ClassificationStatus } from '@/types/matterProfile'

const STATUS_CONFIG: Record<ClassificationStatus, { label: string; className: string }> = {
  classified: {
    label: 'Classified',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400',
  },
  review_recommended: {
    label: 'Review Recommended',
    className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400',
  },
  needs_review: {
    label: 'Needs Review',
    className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400',
  },
  failed: {
    label: 'Failed',
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
}

export function ClassificationStatusBadge({ status }: { status: ClassificationStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <Badge variant="outline" className={cn(config.className)}>
      {config.label}
    </Badge>
  )
}

/** Never implies a confidence figure is a correctness guarantee -- just the raw Decisions API value, formatted. */
export function ConfidenceLabel({ confidence }: { confidence: number | null }) {
  if (confidence === null) return <span className="text-muted-foreground">—</span>
  return <span className="tabular-nums">{Math.round(confidence * 100)}%</span>
}
