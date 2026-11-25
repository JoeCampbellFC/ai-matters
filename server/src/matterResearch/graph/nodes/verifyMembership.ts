import { GET_DOCUMENT_PROFILE_TOOL, buildGetDocumentProfileArgs } from '../../../mcp/tools.js'
import { mapToolResultToDocumentProfile } from '../../../mcp/matterMapper.js'
import { verifyWorkspaceMembership } from '../../membership.js'
import { incrementBudget } from '../../budget.js'
import type { CandidateDocument } from '../../types.js'
import type { ResearchState, ResearchStateUpdate } from '../state.js'
import { callTool, emit, emitStage, type NodeConfig } from './shared.js'

export async function verifyMembership(state: ResearchState, config: NodeConfig): Promise<ResearchStateUpdate> {
  emitStage(config, state, 'verifying_membership')

  const candidateList = Object.values(state.candidates)
  const unverified = candidateList.filter((c) => !c.verifiedBy && c.status !== 'excluded')
  if (unverified.length === 0) {
    return {}
  }

  const candidateIds = unverified.map((c) => c.documentId)

  emit(config, {
    type: 'activity',
    stage: 'verifying_membership',
    message: `Verifying workspace membership for ${candidateIds.length} search ${candidateIds.length === 1 ? 'result' : 'results'}…`,
  })

  let mcpCalls = 0
  let checked = 0
  const getDocumentProfile = async (documentId: string) => {
    const result = await callTool(config, GET_DOCUMENT_PROFILE_TOOL, (tool) =>
      buildGetDocumentProfileArgs(tool, { documentId }),
    )
    mcpCalls += 1
    checked += 1
    const profile = mapToolResultToDocumentProfile(result)
    emit(config, {
      type: 'activity',
      stage: 'verifying_membership',
      message: `Verifying via document profile (${checked}): ${profile?.name ?? documentId}`,
    })
    return profile
  }

  const result = await verifyWorkspaceMembership(
    { getDocumentProfile },
    {
      workspaceId: state.workspaceId,
      candidateIds,
      knownDocumentIds: state.workspaceDocumentIds,
      knownDocumentIdsComplete: state.workspaceDocumentIdsComplete,
    },
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
