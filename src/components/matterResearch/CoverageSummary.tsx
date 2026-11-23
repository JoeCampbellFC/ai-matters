import { CheckCircle2, CircleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { CoverageAssessment } from '@/types/research'

/** LLM-generated topics/reasons aren't guaranteed to start with a capital letter -- enforced here at display time. */
function capitalize(text: string): string {
  return text.length > 0 ? text.charAt(0).toUpperCase() + text.slice(1) : text
}

export function CoverageSummary({ coverage }: { coverage?: CoverageAssessment }) {
  if (!coverage) return null

  const hasCovered = coverage.coveredTopics.length > 0
  const hasGaps = coverage.gaps.length > 0

  if (!hasCovered && !hasGaps) {
    return <p className="text-sm text-muted-foreground">No coverage has been assessed yet.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          What We Found
        </div>
        {hasCovered ? (
          <div className="flex flex-wrap gap-1.5">
            {coverage.coveredTopics.map((topic) => (
              <Badge
                key={topic}
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
              >
                {capitalize(topic)}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing confirmed yet.</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <CircleAlert className="size-4 text-amber-600 dark:text-amber-400" />
          What's Missing
        </div>
        {hasGaps ? (
          <ul className="flex flex-col gap-1.5">
            {coverage.gaps.map((gap) => (
              <li
                key={gap.topic}
                className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-sm text-muted-foreground dark:border-amber-900 dark:bg-amber-950"
              >
                <span className="font-medium text-foreground">{capitalize(gap.topic)}:</span> {capitalize(gap.reason)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No gaps identified — coverage looks complete.</p>
        )}
      </div>
    </div>
  )
}
