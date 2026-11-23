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

export type ResearchRunStatus = 'running' | 'succeeded' | 'failed' | 'cancelled'

export type DocumentStatus = 'candidate' | 'selected' | 'reading' | 'reviewed' | 'used' | 'excluded'

export type DiscoverySource = 'global_search'
export type MembershipVerifiedBy = 'profile_match'
export type MembershipExcludedReason = 'wrong_workspace' | 'membership_unverifiable' | 'profile_lookup_failed'

export type SearchQueryStatus = 'planned' | 'searching' | 'completed'

/** The research playbook selected for this run -- see matterResearch/skills.ts. */
export interface SelectedSkill {
  name: string
  description: string
  rationale: string
}

export interface SearchPlan {
  query: string
  rationale: string
  /** Which refine pass produced this plan (0 = initial plan), so executors only act on the current iteration's plans. */
  iteration: number
}

/** UI-facing projection of a search query's lifecycle (planned -> searching -> completed). */
export interface SearchQueryItem {
  query: string
  rationale: string
  iteration: number
  status: SearchQueryStatus
  resultCount?: number
}

export interface CandidateDocument {
  documentId: string
  name?: string
  folder?: string
  docType?: string
  author?: string
  date?: string
  description?: string
  discoveredVia: DiscoverySource[]
  verifiedBy?: MembershipVerifiedBy
  excludedReason?: MembershipExcludedReason
  relevanceScore?: number
  selectionReason?: string
  status: DocumentStatus
  truncated?: boolean
}

export interface EvidenceItem {
  id: string
  documentId: string
  claim: string
  quote?: string
  topic: string
  confidence: 'high' | 'medium' | 'low'
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

export interface OutlineSection {
  heading: string
  topics: string[]
  evidenceIds: string[]
}

export interface CitationRegistryEntry {
  marker: string
  documentId: string
  documentName?: string
  version?: string
  link?: string
}

export interface ResearchResult {
  markdown: string
  citationRegistry: CitationRegistryEntry[]
  unresolvedCitationCount: number
}

export type BudgetLimitReason =
  | 'max_iterations'
  | 'max_documents'
  | 'max_duration'
  | 'max_llm_calls'
  | 'max_mcp_calls'

export interface BudgetCounters {
  startedAt: string
  iterationCount: number
  documentsFetched: number
  llmCalls: number
  mcpCalls: number
  exceeded?: BudgetLimitReason
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
  | (ResearchEventBase & { type: 'coverage_assessed'; coveredTopics: string[]; gaps: CoverageGap[]; iteration: number })
  | (ResearchEventBase & {
      type: 'run_succeeded' | 'run_failed' | 'run_cancelled'
      summary?: { documentsUsed: number; tokensUsed: number; durationMs: number }
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

/** Distributes Omit over the ResearchEvent union so each variant keeps its own extra fields. */
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never

/** The shape a node emits via config.writer -- seq/ts/runId are stamped centrally by runManager.ts. */
export type EmittedResearchEvent = DistributiveOmit<ResearchEvent, 'seq' | 'ts' | 'runId'>
