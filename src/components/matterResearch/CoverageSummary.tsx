import { Badge } from '@/components/ui/badge'
import type { CoverageAssessment } from '@/types/research'

export function CoverageSummary({ coverage }: { coverage?: CoverageAssessment }) {
  if (!coverage) return null

  return (
    <div className="flex flex-col gap-3">
      {coverage.coveredTopics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {coverage.coveredTopics.map((topic) => (
            <Badge key={topic} variant="secondary">
              {topic}
            </Badge>
          ))}
        </div>
      )}
      {coverage.gaps.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm">
          {coverage.gaps.map((gap) => (
            <li key={gap.topic} className="text-muted-foreground">
              <span className="font-medium text-foreground">{gap.topic}:</span> {gap.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
