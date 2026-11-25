import { useEffect, useState } from 'react'
import { BookOpenCheck, CheckCircle2, Circle, CircleSlash2, FileSearch, Folder, Loader2, RotateCcw, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ClassificationLiveSignal } from '@/hooks/useMatterResearch'
import {
  RESEARCH_STAGE_ORDER,
  type ResearchRunStatus,
  type ResearchStage,
  type SearchQueryItem,
  type SearchQueryStatus,
  type SelectedSkill,
} from '@/types/research'

const STAGE_LABELS: Record<ResearchStage, string> = {
  initializing: 'Scanning workspace',
  planning_searches: 'Planning document searches',
  searching: 'Searching documents',
  verifying_membership: 'Verifying workspace membership',
  ranking_candidates: 'Evaluating search results',
  selecting_documents: 'Selecting relevant documents',
  reading_documents: 'Reading documents',
  assessing_coverage: 'Reviewing evidence and gaps',
  synthesizing: 'Writing matter summary',
}

type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

/**
 * `maxIndexReached` is the furthest point this run has ever gotten to, which
 * can be *ahead* of `currentIndex` during a refine pass (assessing_coverage
 * looping back to planning_searches/searching). Without it, a loop-back
 * would render as the whole run rewinding to pending -- instead, only the
 * step actually running right now moves; everything already reached stays
 * completed.
 */
function stepStatus(index: number, currentIndex: number, maxIndexReached: number, status: ResearchRunStatus | 'idle'): StepStatus {
  if (status === 'idle') return 'pending'
  if (index === currentIndex) {
    if (status === 'failed') return 'failed'
    if (status === 'cancelled') return 'skipped'
    if (status === 'succeeded') return 'completed'
    return 'running'
  }
  if (index <= maxIndexReached) return 'completed'
  return status === 'cancelled' ? 'skipped' : 'pending'
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

function classificationStepStatus(live: ClassificationLiveSignal | undefined): StepStatus {
  if (!live) return 'pending'
  if (live.status === 'classifying') return 'running'
  if (live.status === 'completed') return 'completed'
  return 'failed'
}

function DurationPill({ ms }: { ms?: number }) {
  if (ms === undefined) return null
  return (
    <Badge variant="outline" className="ml-auto text-muted-foreground tabular-nums">
      {formatDuration(ms)}
    </Badge>
  )
}

function QueryStatusIcon({ status }: { status: SearchQueryStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
    case 'searching':
      return <Loader2 className="size-3 animate-spin text-sky-600 dark:text-sky-400" />
    default:
      return <Circle className="size-3 text-muted-foreground" />
  }
}

/** Shows exactly what's being searched for, inline under the "Searching documents" step rather than in a separate card. */
function SearchQuerySubList({ queries }: { queries: SearchQueryItem[] }) {
  const sorted = [...queries].sort((a, b) => a.iteration - b.iteration)
  const hasMultipleRounds = new Set(queries.map((q) => q.iteration)).size > 1
  return (
    <ul className="ml-6 flex flex-col gap-1 border-l border-border pl-3">
      {sorted.map((item) => (
        <li key={item.query} className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <QueryStatusIcon status={item.status} />
          <span>
            {hasMultipleRounds && (
              <Badge variant="outline" className="mr-1 px-1 py-0 text-[10px] leading-4">
                Round {item.iteration + 1}
              </Badge>
            )}
            &ldquo;{item.query}&rdquo;
            {item.status === 'completed' && (
              <span className="tabular-nums"> — {item.resultCount} {item.resultCount === 1 ? 'result' : 'results'}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Shows which research playbook was picked and why, inline under "Planning document searches" rather than in a separate banner card. */
function SkillSubList({ skill }: { skill: SelectedSkill }) {
  return (
    <ul className="ml-6 flex flex-col gap-1 border-l border-border pl-3">
      <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <BookOpenCheck className="size-3 shrink-0 translate-y-0.5" />
        <span>
          Using playbook <span className="font-medium text-foreground">{skill.name}</span> — {skill.rationale}
        </span>
      </li>
    </ul>
  )
}

/**
 * Shows only the single folder currently being scanned, inline under
 * "Scanning workspace" -- unlike SearchQuerySubList this never grows into a
 * history; `key={folderName}` forces a fresh mount (and so a fresh
 * animate-in play) each time the folder changes, giving the "swipe up to
 * the next one" effect without tracking any exit animation.
 */
function FolderScanSubList({ folderName }: { folderName: string }) {
  return (
    <ul className="ml-6 flex flex-col gap-1 overflow-hidden border-l border-border pl-3">
      <li key={folderName} className="flex items-start gap-1.5 text-xs text-muted-foreground animate-in slide-in-from-bottom-2 fade-in duration-300">
        <Folder className="size-3 shrink-0 translate-y-0.5" />
        <span>Scanning &ldquo;{folderName}&rdquo;…</span>
      </li>
    </ul>
  )
}

/** Shows how many search candidates were found vs. how many actually verified as belonging to this matter, inline under "Verifying workspace membership". */
function DocumentCountSubList({ count, relevantCount }: { count: number; relevantCount: number }) {
  return (
    <ul className="ml-6 flex flex-col gap-1 border-l border-border pl-3">
      <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <FileSearch className="size-3 shrink-0 translate-y-0.5" />
        <span>
          {count} {count === 1 ? 'document' : 'documents'} found. {relevantCount} relevant for this matter.
        </span>
      </li>
    </ul>
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
  searchQueries,
  iteration,
  maxStageIndexReached,
  skill,
  documentCount,
  relevantDocumentCount,
  currentScanningFolder,
  classificationLive,
  classificationStartedAt,
  classificationDurationMs,
}: {
  stage?: ResearchStage
  status: ResearchRunStatus | 'idle'
  stageDurationsMs: Partial<Record<ResearchStage, number>>
  currentStageStartedAt?: number
  searchQueries: SearchQueryItem[]
  /** Which refine pass is active (0 = initial pass). */
  iteration: number
  /** The furthest stage index this run has ever reached -- see useMatterResearch. */
  maxStageIndexReached: number
  skill?: SelectedSkill
  documentCount: number
  /** How many discovered candidates actually verified as belonging to this matter (not excluded). */
  relevantDocumentCount: number
  /** Name of the folder loadWorkspaceDocumentIds.ts is currently indexing, if any. */
  currentScanningFolder?: string
  classificationLive?: ClassificationLiveSignal
  classificationStartedAt?: number
  classificationDurationMs?: number
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (status !== 'running' && classificationLive?.status !== 'classifying') return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [status, classificationLive?.status])

  const currentIndex = stage ? RESEARCH_STAGE_ORDER.indexOf(stage) : -1
  const finalStatus: StepStatus =
    status === 'succeeded' ? 'completed' : status === 'failed' ? 'failed' : status === 'cancelled' ? 'skipped' : 'pending'

  return (
    <div className="flex flex-col gap-2">
      {status === 'running' && iteration > 0 && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          <RotateCcw className="size-3" />
          Refining research based on evidence gaps — pass {iteration + 1}
        </div>
      )}
      <ol className="flex flex-col gap-2.5">
        {RESEARCH_STAGE_ORDER.map((step, index) => {
          const st = stepStatus(index, currentIndex, maxStageIndexReached, status)
          const durationMs =
            st === 'running' && currentStageStartedAt !== undefined ? now - currentStageStartedAt : stageDurationsMs[step]
          return (
            <li key={step} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5 text-sm">
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
              </div>
              {step === 'initializing' && currentScanningFolder && <FolderScanSubList folderName={currentScanningFolder} />}
              {step === 'planning_searches' && skill && <SkillSubList skill={skill} />}
              {step === 'searching' && searchQueries.length > 0 && <SearchQuerySubList queries={searchQueries} />}
              {step === 'verifying_membership' && documentCount > 0 && (
                <DocumentCountSubList count={documentCount} relevantCount={relevantDocumentCount} />
              )}
            </li>
          )
        })}
        <li className="flex items-center gap-2.5 text-sm">
          <StepIcon status={finalStatus} />
          <span className={cn(finalStatus === 'completed' ? 'font-medium text-foreground' : 'text-muted-foreground')}>
            Completed
          </span>
        </li>
        {(() => {
          const st = classificationStepStatus(classificationLive)
          const durationMs =
            st === 'running' && classificationStartedAt !== undefined ? now - classificationStartedAt : classificationDurationMs
          return (
            <li className="flex items-center gap-2.5 text-sm">
              <StepIcon status={st} />
              <span
                className={cn(
                  st === 'pending' && 'text-muted-foreground',
                  st === 'running' && 'font-medium text-foreground',
                  st === 'completed' && 'text-foreground',
                  st === 'failed' && 'text-destructive',
                )}
              >
                Classify Matter Fields
              </span>
              <DurationPill ms={durationMs} />
            </li>
          )
        })()}
      </ol>
    </div>
  )
}
