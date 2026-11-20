import { describe, expect, it, vi } from 'vitest'
import type { DocumentProfile } from '../mcp/matterMapper.js'
import { verifyWorkspaceMembership } from './membership.js'

function profile(overrides: Partial<DocumentProfile> = {}): DocumentProfile {
  return { id: 'DOC-X', raw: {}, ...overrides }
}

describe('verifyWorkspaceMembership', () => {
  it('verifies container-traversal documents without ever calling get_document_profile for them', async () => {
    const getDocumentProfile = vi.fn()
    const result = await verifyWorkspaceMembership(
      { getDocumentProfile },
      { workspaceId: 'WS-1', containerVerifiedIds: new Set(['DOC-1', 'DOC-2']), searchLeadIds: [] },
    )

    expect(result.verified).toEqual([
      { documentId: 'DOC-1', verifiedBy: 'container_traversal' },
      { documentId: 'DOC-2', verifiedBy: 'container_traversal' },
    ])
    expect(getDocumentProfile).not.toHaveBeenCalled()
  })

  it('verifies a search lead whose profile matches the target workspace', async () => {
    const getDocumentProfile = vi.fn().mockResolvedValue(profile({ id: 'DOC-3', workspaceId: 'WS-1' }))
    const result = await verifyWorkspaceMembership(
      { getDocumentProfile },
      { workspaceId: 'WS-1', containerVerifiedIds: new Set(), searchLeadIds: ['DOC-3'] },
    )
    expect(result.verified).toEqual([{ documentId: 'DOC-3', verifiedBy: 'profile_match' }])
    expect(result.excluded).toEqual([])
  })

  it('matches workspace ids case-insensitively and ignoring surrounding whitespace', async () => {
    const getDocumentProfile = vi.fn().mockResolvedValue(profile({ workspaceId: ' ws-1 ' }))
    const result = await verifyWorkspaceMembership(
      { getDocumentProfile },
      { workspaceId: 'WS-1', containerVerifiedIds: new Set(), searchLeadIds: ['DOC-3'] },
    )
    expect(result.verified).toEqual([{ documentId: 'DOC-3', verifiedBy: 'profile_match' }])
  })

  it('excludes a search lead whose profile belongs to a different workspace', async () => {
    const getDocumentProfile = vi.fn().mockResolvedValue(profile({ workspaceId: 'WS-OTHER' }))
    const result = await verifyWorkspaceMembership(
      { getDocumentProfile },
      { workspaceId: 'WS-1', containerVerifiedIds: new Set(), searchLeadIds: ['DOC-3'] },
    )
    expect(result.excluded).toEqual([{ documentId: 'DOC-3', reason: 'wrong_workspace' }])
  })

  it('excludes (rather than trusts) a profile with no workspace field at all', async () => {
    const getDocumentProfile = vi.fn().mockResolvedValue(profile({ workspaceId: undefined }))
    const result = await verifyWorkspaceMembership(
      { getDocumentProfile },
      { workspaceId: 'WS-1', containerVerifiedIds: new Set(), searchLeadIds: ['DOC-3'] },
    )
    expect(result.excluded).toEqual([{ documentId: 'DOC-3', reason: 'membership_unverifiable' }])
  })

  it('excludes (rather than trusts) a profile that could not be resolved to null', async () => {
    const getDocumentProfile = vi.fn().mockResolvedValue(null)
    const result = await verifyWorkspaceMembership(
      { getDocumentProfile },
      { workspaceId: 'WS-1', containerVerifiedIds: new Set(), searchLeadIds: ['DOC-3'] },
    )
    expect(result.excluded).toEqual([{ documentId: 'DOC-3', reason: 'membership_unverifiable' }])
  })

  it('excludes a search lead when the profile lookup itself throws', async () => {
    const getDocumentProfile = vi.fn().mockRejectedValue(new Error('MCP call failed'))
    const result = await verifyWorkspaceMembership(
      { getDocumentProfile },
      { workspaceId: 'WS-1', containerVerifiedIds: new Set(), searchLeadIds: ['DOC-3'] },
    )
    expect(result.excluded).toEqual([{ documentId: 'DOC-3', reason: 'profile_lookup_failed' }])
  })

  it('does not re-check a search lead that was already verified via container traversal', async () => {
    const getDocumentProfile = vi.fn()
    const result = await verifyWorkspaceMembership(
      { getDocumentProfile },
      { workspaceId: 'WS-1', containerVerifiedIds: new Set(['DOC-1']), searchLeadIds: ['DOC-1', 'DOC-2'] },
    )
    expect(getDocumentProfile).toHaveBeenCalledTimes(1)
    expect(getDocumentProfile).toHaveBeenCalledWith('DOC-2')
    expect(result.verified).toEqual([{ documentId: 'DOC-1', verifiedBy: 'container_traversal' }])
  })
})
