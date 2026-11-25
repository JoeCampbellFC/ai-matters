import type { DocumentProfile } from '../mcp/matterMapper.js'

export type MembershipVerifiedReason = 'profile_match' | 'workspace_listing'
export type MembershipExcludedReason = 'wrong_workspace' | 'membership_unverifiable' | 'profile_lookup_failed'

export interface MembershipVerificationResult {
  verified: Array<{ documentId: string; verifiedBy: MembershipVerifiedReason }>
  excluded: Array<{ documentId: string; reason: MembershipExcludedReason }>
}

function normalizeWorkspaceId(id: string): string {
  return id.trim().toLowerCase()
}

/**
 * Establishes workspace membership for candidate documents before any of them
 * may be fetched. The `search` MCP tool has no documented workspace-scoping
 * parameter (results are a free-text best-effort match, even when the query
 * text itself mentions the client/matter identifiers) -- so every candidate
 * must be cross-checked before it can be trusted.
 *
 * Fast path: if `knownDocumentIds` (an exhaustive listing of every document
 * actually in the workspace, built once per run by loadWorkspaceDocumentIds.ts
 * via get_container_children) is available, membership is a plain Set lookup
 * -- no MCP call per candidate at all. When that listing is known to be
 * complete, absence from it is itself a reliable "not a member" signal.
 *
 * Fallback (unchanged from before this existed): per-candidate
 * get_document_profile, used whenever the listing is missing or was cut
 * short (budget limit, tool unavailable) and the candidate's id doesn't
 * already appear in whatever was collected. Ambiguous cases (no workspace
 * field on the profile, or a failed lookup) are excluded and reported, never
 * silently treated as members.
 */
export async function verifyWorkspaceMembership(
  deps: { getDocumentProfile: (documentId: string) => Promise<DocumentProfile | null> },
  input: {
    workspaceId: string
    candidateIds: string[]
    knownDocumentIds?: Set<string>
    knownDocumentIdsComplete?: boolean
  },
): Promise<MembershipVerificationResult> {
  const result: MembershipVerificationResult = { verified: [], excluded: [] }
  const targetWorkspaceId = normalizeWorkspaceId(input.workspaceId)
  const knownIds = input.knownDocumentIds

  for (const documentId of input.candidateIds) {
    if (knownIds?.has(documentId)) {
      result.verified.push({ documentId, verifiedBy: 'workspace_listing' })
      continue
    }
    if (knownIds && input.knownDocumentIdsComplete) {
      result.excluded.push({ documentId, reason: 'wrong_workspace' })
      continue
    }

    let profile: DocumentProfile | null
    try {
      profile = await deps.getDocumentProfile(documentId)
    } catch {
      result.excluded.push({ documentId, reason: 'profile_lookup_failed' })
      continue
    }

    if (!profile || !profile.workspaceId) {
      result.excluded.push({ documentId, reason: 'membership_unverifiable' })
      continue
    }

    if (normalizeWorkspaceId(profile.workspaceId) === targetWorkspaceId) {
      result.verified.push({ documentId, verifiedBy: 'profile_match' })
    } else {
      result.excluded.push({ documentId, reason: 'wrong_workspace' })
    }
  }

  return result
}
