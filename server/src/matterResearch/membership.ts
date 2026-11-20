import type { DocumentProfile } from '../mcp/matterMapper.js'

export type MembershipVerifiedReason = 'container_traversal' | 'profile_match'
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
 * parameter, so its leads are unverified by construction -- each must be
 * cross-checked via get_document_profile. Documents already discovered by
 * recursively traversing the workspace's own containers are verified by
 * construction and need no further check.
 *
 * Ambiguous cases (no workspace field on the profile, or a failed lookup) are
 * excluded and reported, never silently treated as members.
 */
export async function verifyWorkspaceMembership(
  deps: { getDocumentProfile: (documentId: string) => Promise<DocumentProfile | null> },
  input: { workspaceId: string; containerVerifiedIds: Set<string>; searchLeadIds: string[] },
): Promise<MembershipVerificationResult> {
  const result: MembershipVerificationResult = { verified: [], excluded: [] }
  const targetWorkspaceId = normalizeWorkspaceId(input.workspaceId)

  for (const documentId of input.containerVerifiedIds) {
    result.verified.push({ documentId, verifiedBy: 'container_traversal' })
  }

  const unverifiedLeads = input.searchLeadIds.filter((id) => !input.containerVerifiedIds.has(id))

  for (const documentId of unverifiedLeads) {
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
