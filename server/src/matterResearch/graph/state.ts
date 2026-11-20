import { Annotation } from '@langchain/langgraph'
import type { Workspace } from '../../mcp/workspaceMapper.js'
import { initialBudget } from '../budget.js'
import type {
  BudgetCounters,
  CandidateDocument,
  CitationRegistryEntry,
  CoverageAssessment,
  EvidenceItem,
  OutlineSection,
  ResearchRunStatus,
  ResearchStage,
  SearchPlan,
} from '../types.js'

function mergeCandidates(
  current: Record<string, CandidateDocument>,
  update: Record<string, CandidateDocument>,
): Record<string, CandidateDocument> {
  const merged = { ...current }
  for (const [id, doc] of Object.entries(update)) {
    merged[id] = { ...merged[id], ...doc }
  }
  return merged
}

/**
 * Typed graph state. The SSE event log is deliberately NOT part of this state
 * -- it's a transport concern owned by runManager.ts's own ring buffer, kept
 * independent of graph internals so replay/reconnect logic never has to
 * reason about checkpointed graph state.
 */
export const ResearchAnnotation = Annotation.Root({
  runId: Annotation<string>,
  sessionId: Annotation<string>,
  workspaceId: Annotation<string>,

  workspace: Annotation<Workspace | undefined>({ reducer: (_current, next) => next, default: () => undefined }),
  containerId: Annotation<string | undefined>({ reducer: (_current, next) => next, default: () => undefined }),
  containerTraversalComplete: Annotation<boolean>({ reducer: (_current, next) => next, default: () => false }),

  searchPlans: Annotation<SearchPlan[]>({ reducer: (current, next) => current.concat(next), default: () => [] }),

  candidates: Annotation<Record<string, CandidateDocument>>({ reducer: mergeCandidates, default: () => ({}) }),
  selectedDocumentIds: Annotation<string[]>({ reducer: (_current, next) => next, default: () => [] }),
  evidence: Annotation<EvidenceItem[]>({ reducer: (current, next) => current.concat(next), default: () => [] }),

  coverage: Annotation<CoverageAssessment | undefined>({ reducer: (_current, next) => next, default: () => undefined }),

  outline: Annotation<OutlineSection[] | undefined>({ reducer: (_current, next) => next, default: () => undefined }),
  citationRegistry: Annotation<CitationRegistryEntry[]>({ reducer: (_current, next) => next, default: () => [] }),
  sectionMarkdown: Annotation<string[]>({ reducer: (current, next) => current.concat(next), default: () => [] }),
  markdown: Annotation<string | undefined>({ reducer: (_current, next) => next, default: () => undefined }),

  budget: Annotation<BudgetCounters>({
    reducer: (current, next) => ({ ...current, ...next }),
    default: initialBudget,
  }),
  status: Annotation<ResearchRunStatus>({ reducer: (_current, next) => next, default: () => 'running' }),
  stage: Annotation<ResearchStage>({ reducer: (_current, next) => next, default: () => 'initializing' }),
  warnings: Annotation<string[]>({ reducer: (current, next) => current.concat(next), default: () => [] }),
})

export type ResearchState = typeof ResearchAnnotation.State
export type ResearchStateUpdate = typeof ResearchAnnotation.Update
