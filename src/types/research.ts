/**
 * Mirrors server/src/matterResearch/types.ts — kept hand-in-sync with the
 * backend, same convention as Workspace mirroring workspaceMapper.ts.
 */
export type ResearchStage =
  | 'initializing'
  | 'planning_searches'
  | 'searching'
  | 'verifying_membership'
  | 'ranking_candidates'
  | 'selecting_documents'
  | 'reading_documents'
  | 'assessing_coverage'
  | 'synthesizing'

/**
 * Canonical forward order of the pipeline. Shared by useMatterResearch's
 * ratcheted "how far has this run ever gotten" tracking and
 * ResearchStageTimeline's rendering, so a refine pass (which re-enters
 * planning_searches/searching after assessing_coverage finds gaps) is judged
 * against the same ordering in both places.
 */
export const RESEARCH_STAGE_ORDER: ResearchStage[] = [
  'initializing',
  'planning_searches',
  'searching',
  'verifying_membership',
  'ranking_candidates',
  'selecting_documents',
  'reading_documents',
  'assessing_coverage',
  'synthesizing',
]

export type ResearchRunStatus = 'running' | 'succeeded' | 'failed' | 'cancelled'

export type BudgetLimitReason = 'max_iterations' | 'max_documents' | 'max_duration' | 'max_llm_calls' | 'max_mcp_calls'

export type DocumentStatus = 'candidate' | 'selected' | 'reading' | 'reviewed' | 'used' | 'excluded'

export type DiscoverySource = 'global_search'

export interface ResearchDocument {
  documentId: string
  name?: string
  docType?: string
  status: DocumentStatus
  reason?: string
  discoveredVia?: DiscoverySource[]
}

export interface CoverageGap {
  topic: string
  reason: string
  suggestedQueries?: string[]
}

export interface CoverageAssessment {
  coveredTopics: string[]
  gaps: CoverageGap[]
}

export interface CitationRegistryEntry {
  marker: string
  documentId: string
  documentName?: string
  version?: string
  link?: string
}

export type SearchQueryStatus = 'planned' | 'searching' | 'completed'

export interface SearchQueryItem {
  query: string
  rationale: string
  iteration: number
  status: SearchQueryStatus
  resultCount?: number
}

/** The research playbook selected for this run -- see server/src/matterResearch/skills.ts. */
export interface SelectedSkill {
  name: string
  description: string
  rationale: string
}

export type ResearchEventType =
  | 'run_started'
  | 'skill_selected'
  | 'stage_changed'
  | 'activity'
  | 'search_planned'
  | 'search_started'
  | 'search_completed'
  | 'document_discovered'
  | 'document_status_changed'
  | 'workspace_folder_scanning'
  | 'coverage_assessed'
  | 'run_succeeded'
  | 'run_failed'
  | 'run_cancelled'
  | 'classification_started'
  | 'classification_field_started'
  | 'classification_field_completed'
  | 'classification_field_failed'
  | 'classification_completed'
  | 'classification_failed'
  | 'heartbeat'

interface ResearchEventBase {
  seq: number
  ts: string
  runId: string
  type: ResearchEventType
}

export type ResearchEvent =
  | (ResearchEventBase & { type: 'run_started'; workspaceId: string })
  | (ResearchEventBase & { type: 'skill_selected'; skillName: string; description: string; rationale: string })
  | (ResearchEventBase & { type: 'stage_changed'; stage: ResearchStage; iteration: number })
  | (ResearchEventBase & {
      type: 'activity'
      stage: ResearchStage
      message: string
      detail?: Record<string, unknown>
    })
  | (ResearchEventBase & { type: 'search_planned'; query: string; rationale: string; iteration: number })
  | (ResearchEventBase & { type: 'search_started'; query: string })
  | (ResearchEventBase & { type: 'search_completed'; query: string; resultCount: number })
  | (ResearchEventBase & {
      type: 'document_discovered'
      document: {
        documentId: string
        name?: string
        docType?: string
        status: DocumentStatus
        discoveredVia: DiscoverySource[]
      }
    })
  | (ResearchEventBase & {
      type: 'document_status_changed'
      documentId: string
      status: DocumentStatus
      reason?: string
    })
  | (ResearchEventBase & { type: 'workspace_folder_scanning'; folderName: string })
  | (ResearchEventBase & { type: 'coverage_assessed'; coveredTopics: string[]; gaps: CoverageGap[]; iteration: number })
  | (ResearchEventBase & {
      type: 'run_succeeded' | 'run_failed' | 'run_cancelled'
      summary?: { documentsUsed: number; tokensUsed: number; durationMs: number; budgetExceeded?: BudgetLimitReason }
      error?: { code: string; message: string }
    })
  | (ResearchEventBase & { type: 'classification_started' })
  | (ResearchEventBase & { type: 'classification_field_started'; fieldId: string; fieldLabel: string })
  | (ResearchEventBase & {
      type: 'classification_field_completed'
      fieldId: string
      fieldLabel: string
      valueId: string | null
      label: string | null
      confidence: number | null
      status: string
    })
  | (ResearchEventBase & {
      type: 'classification_field_failed'
      fieldId: string
      fieldLabel: string
      error: { code: string; message: string }
    })
  | (ResearchEventBase & { type: 'classification_completed' })
  | (ResearchEventBase & { type: 'classification_failed'; error: { code: string; message: string } })
  | (ResearchEventBase & { type: 'heartbeat' })

/** Shape of GET /api/matters/research/:runId */
export interface RunSnapshot {
  runId: string
  workspaceId: string
  status: ResearchRunStatus
  stage: ResearchStage
  stageStartedAt: string
  documents: ResearchDocument[]
  searchQueries: SearchQueryItem[]
  coverage?: CoverageAssessment
  skill?: SelectedSkill
  error?: { code: string; message: string }
  budgetExceeded?: BudgetLimitReason
}

export interface ResearchActivityItem {
  seq: number
  ts: string
  /** 'classifying' is synthesized client-side from classification_* events, not a real research pipeline stage. */
  stage: ResearchStage | 'classifying'
  message: string
}
