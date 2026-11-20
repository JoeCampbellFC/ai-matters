import { GET_DOCUMENT_PROFILE_TOOL, buildGetDocumentProfileArgs } from '../../../mcp/tools.js'
import { mapToolResultToDocumentProfile } from '../../../mcp/matterMapper.js'
import { verifyWorkspaceMembership } from '../../membership.js'
import { incrementBudget } from '../../budget.js'
import type { CandidateDocument } from '../../types.js'
import type { ResearchState, ResearchStateUpdate } from '../state.js'
import { callTool, emit, type NodeConfig } from './shared.js'

export async function verifyMembership(state: ResearchState, config: NodeConfig): Promise<ResearchStateUpdate> {
  const candidateList = Object.values(state.candidates)
  const unverified = candidateList.filter((c) => !c.verifiedBy && c.status !== 'excluded')
  if (unverified.length === 0) {
    return {}
  }

  emit(config, { type: 'activity', stage: 'verifying_membership', message: 'Verifying workspace membership…' })

  let mcpCalls = 0
  const getDocumentProfile = async (documentId: string) => {
    const result = await callTool(config, GET_DOCUMENT_PROFILE_TOOL, (tool) =>
      buildGetDocumentProfileArgs(tool, { documentId }),
    )
    mcpCalls += 1
    return mapToolResultToDocumentProfile(result)
  }

  const containerVerifiedIds = new Set(
    unverified.filter((c) => c.discoveredVia.includes('container_traversal')).map((c) => c.documentId),
  )
  const searchLeadIds = unverified
    .filter((c) => !c.discoveredVia.includes('container_traversal'))
    .map((c) => c.documentId)

  const result = await verifyWorkspaceMembership(
    { getDocumentProfile },
    { workspaceId: state.workspaceId, containerVerifiedIds, searchLeadIds },
  )

  const candidates: Record<string, CandidateDocument> = {}
  for (const v of result.verified) {
    candidates[v.documentId] = {
      ...state.candidates[v.documentId],
      documentId: v.documentId,
      verifiedBy: v.verifiedBy,
    }
  }
  for (const e of result.excluded) {
    candidates[e.documentId] = {
      ...state.candidates[e.documentId],
      documentId: e.documentId,
      excludedReason: e.reason,
      status: 'excluded',
    }
    emit(config, { type: 'document_status_changed', documentId: e.documentId, status: 'excluded', reason: e.reason })
  }

  emit(config, {
    type: 'activity',
    stage: 'verifying_membership',
    message:
      `Verified ${result.verified.length} ${result.verified.length === 1 ? 'document' : 'documents'} as workspace members` +
      (result.excluded.length > 0 ? `, excluded ${result.excluded.length}` : ''),
  })

  return {
    candidates,
    budget: incrementBudget(state.budget, { mcpCalls }),
  }
}
