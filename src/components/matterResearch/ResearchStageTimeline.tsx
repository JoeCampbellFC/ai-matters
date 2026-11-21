import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, CircleSlash2, Loader2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ResearchRunStatus, ResearchStage } from '@/types/research'

const STAGE_ORDER: ResearchStage[] = [
  'initializing',
  'planning_searches',
  'traversing_workspace',
  'searching',
  'verifying_membership',
  'ranking_candidates',
  'selecting_documents',
  'reading_documents',
  'assessing_coverage',
  'synthesizing',
]

const STAGE_LABELS: Record<ResearchStage, string> = {
  initializing: 'Connecting to workspace',
  planning_searches: 'Planning document searches',
  traversing_workspace: 'Examining workspace structure',
  searching: 'Searching documents',
  verifying_membership: 'Verifying workspace membership',
  ranking_candidates: 'Evaluating search results',
  selecting_documents: 'Selecting relevant documents',
  reading_documents: 'Reading documents',
  assessing_coverage: 'Reviewing evidence and gaps',
  synthesizing: 'Writing matter summary',
}

type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

function stepStatus(index: number, currentIndex: number, status: ResearchRunStatus | 'idle'): StepStatus {
  if (status === 'idle') return 'pending'
  if (index > currentIndex) return status === 'cancelled' ? 'skipped' : 'pending'
  if (index < currentIndex) return 'completed'
  // index === currentIndex
  if (status === 'failed') return 'failed'
  if (status === 'cancelled') return 'skipped'
  if (status === 'succeeded') return 'completed'
  return 'running'
}

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
    case 'running':
      return <Loader2 className="size-4 animate-spin text-sky-600 dark:text-sky-400" />
    case 'failed':
      return <XCircle className="size-4 text-destructive" />
    case 'skipped':
      return <CircleSlash2 className="size-4 text-muted-foreground" />
    default:
      return <Circle className="size-4 text-muted-foreground" />
  }
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds}s`
}

function DurationPill({ ms }: { ms?: number }) {
  if (ms === undefined) return null
  return (
    <Badge variant="outline" className="ml-auto text-muted-foreground tabular-nums">
      {formatDuration(ms)}
    </Badge>
  )
}

/**
 * No invented percentage progress here by design -- this is stage
 * completion only (pending/running/completed/failed/skipped per step), plus
 * a real elapsed-time pill per step (frozen once a stage finishes, ticking
 * live for whichever stage is currently running).
 */
export function ResearchStageTimeline({
  stage,
  status,
  stageDurationsMs,
  currentStageStartedAt,
}: {
  stage?: ResearchStage
  status: ResearchRunStatus | 'idle'
  stageDurationsMs: Partial<Record<ResearchStage, number>>
  currentStageStartedAt?: number
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (status !== 'running') return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [status])

  const currentIndex = stage ? STAGE_ORDER.indexOf(stage) : -1
  const finalStatus: StepStatus =
    status === 'succeeded' ? 'completed' : status === 'failed' ? 'failed' : status === 'cancelled' ? 'skipped' : 'pending'

  return (
    <ol className="flex flex-col gap-2.5">
      {STAGE_ORDER.map((step, index) => {
        const st = stepStatus(index, currentIndex, status)
        const durationMs =
          st === 'running' && currentStageStartedAt !== undefined ? now - currentStageStartedAt : stageDurationsMs[step]
        return (
          <li key={step} className="flex items-center gap-2.5 text-sm">
            <StepIcon status={st} />
            <span
              className={cn(
                st === 'pending' && 'text-muted-foreground',
                st === 'running' && 'font-medium text-foreground',
                st === 'completed' && 'text-foreground',
                st === 'failed' && 'text-destructive',
              )}
            >
              {STAGE_LABELS[step]}
            </span>
            <DurationPill ms={durationMs} />
          </li>
        )
      })}
      <li className="flex items-center gap-2.5 text-sm">
        <StepIcon status={finalStatus} />
        <span className={cn(finalStatus === 'completed' ? 'font-medium text-foreground' : 'text-muted-foreground')}>
          Completed
        </span>
      </li>
    </ol>
  )
}
