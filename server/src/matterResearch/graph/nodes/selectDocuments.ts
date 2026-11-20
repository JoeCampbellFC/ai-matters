import type { CandidateDocument } from '../../types.js'
import type { ResearchState, ResearchStateUpdate } from '../state.js'
import { emit, requireContext, type NodeConfig } from './shared.js'

/** Below this relevance score a candidate isn't worth spending a fetch on. */
const MIN_RELEVANCE = 0.35

/**
 * Pure, deterministic selection: prefers a smaller group of authoritative
 * documents over a larger group of low-quality ones, and never forces the
 * budget cap to be used in full if fewer candidates clear the relevance bar.
 */
export async function selectDocuments(state: ResearchState, config: NodeConfig): Promise<ResearchStateUpdate> {
  const { limits } = requireContext(config)

  const alreadySelected = new Set(state.selectedDocumentIds)
  const eligible = Object.values(state.candidates)
    .filter(
      (c) =>
        c.verifiedBy &&
        c.status !== 'excluded' &&
        c.status !== 'used' &&
        c.status !== 'reviewed' &&
        !alreadySelected.has(c.documentId),
    )
    .filter((c) => (c.relevanceScore ?? 0) >= MIN_RELEVANCE)
    .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))

  const remainingBudget = Math.max(0, limits.maxDocuments - state.budget.documentsFetched - alreadySelected.size)
  const selected = eligible.slice(0, remainingBudget)

  const candidates: Record<string, CandidateDocument> = {}
  for (const doc of selected) {
    candidates[doc.documentId] = { ...doc, status: 'selected' }
    emit(config, { type: 'document_status_changed', documentId: doc.documentId, status: 'selected' })
  }

  emit(config, {
    type: 'activity',
    stage: 'selecting_documents',
    message: `Shortlisted ${selected.length} ${selected.length === 1 ? 'document' : 'documents'}`,
  })

  return {
    candidates,
    selectedDocumentIds: [...state.selectedDocumentIds, ...selected.map((d) => d.documentId)],
  }
}
