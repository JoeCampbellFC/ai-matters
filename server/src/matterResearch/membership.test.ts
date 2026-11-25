import { describe, expect, it, vi } from 'vitest'
import type { DocumentProfile } from '../mcp/matterMapper.js'
import { verifyWorkspaceMembership } from './membership.js'

function profile(overrides: Partial<DocumentProfile> = {}): DocumentProfile {
  return { id: 'DOC-X', raw: {}, ...overrides }
}

describe('verifyWorkspaceMembership', () => {
  it('verifies a candidate whose profile matches the target workspace', async () => {
    const getDocumentProfile = vi.fn().mockResolvedValue(profile({ id: 'DOC-3', workspaceId: 'WS-1' }))
    const result = await verifyWorkspaceMembership(
      { getDocumentProfile },
      { workspaceId: 'WS-1', candidateIds: ['DOC-3'] },
    )
    expect(result.verified).toEqual([{ documentId: 'DOC-3', verifiedBy: 'profile_match' }])
    expect(result.excluded).toEqual([])
  })

  it('matches workspace ids case-insensitively and ignoring surrounding whitespace', async () => {
    const getDocumentProfile = vi.fn().mockResolvedValue(profile({ workspaceId: ' ws-1 ' }))
    const result = await verifyWorkspaceMembership(
      { getDocumentProfile },
      { workspaceId: 'WS-1', candidateIds: ['DOC-3'] },
    )
    expect(result.verified).toEqual([{ documentId: 'DOC-3', verifiedBy: 'profile_match' }])
  })

  it('excludes a candidate whose profile belongs to a different workspace', async () => {
    const getDocumentProfile = vi.fn().mockResolvedValue(profile({ workspaceId: 'WS-OTHER' }))
    const result = await verifyWorkspaceMembership(
      { getDocumentProfile },
      { workspaceId: 'WS-1', candidateIds: ['DOC-3'] },
    )
    expect(result.excluded).toEqual([{ documentId: 'DOC-3', reason: 'wrong_workspace' }])
  })

  it('excludes (rather than trusts) a profile with no workspace field at all', async () => {
    const getDocumentProfile = vi.fn().mockResolvedValue(profile({ workspaceId: undefined }))
    const result = await verifyWorkspaceMembership(
      { getDocumentProfile },
      { workspaceId: 'WS-1', candidateIds: ['DOC-3'] },
    )
    expect(result.excluded).toEqual([{ documentId: 'DOC-3', reason: 'membership_unverifiable' }])
  })

  it('excludes (rather than trusts) a profile that could not be resolved to null', async () => {
    const getDocumentProfile = vi.fn().mockResolvedValue(null)
    const result = await verifyWorkspaceMembership(
      { getDocumentProfile },
      { workspaceId: 'WS-1', candidateIds: ['DOC-3'] },
    )
    expect(result.excluded).toEqual([{ documentId: 'DOC-3', reason: 'membership_unverifiable' }])
  })

  it('excludes a candidate when the profile lookup itself throws', async () => {
    const getDocumentProfile = vi.fn().mockRejectedValue(new Error('MCP call failed'))
    const result = await verifyWorkspaceMembership(
      { getDocumentProfile },
      { workspaceId: 'WS-1', candidateIds: ['DOC-3'] },
    )
    expect(result.excluded).toEqual([{ documentId: 'DOC-3', reason: 'profile_lookup_failed' }])
  })

  describe('with a known workspace document listing', () => {
    it('verifies a candidate present in the listing without calling getDocumentProfile', async () => {
      const getDocumentProfile = vi.fn()
      const result = await verifyWorkspaceMembership(
        { getDocumentProfile },
        { workspaceId: 'WS-1', candidateIds: ['DOC-3'], knownDocumentIds: new Set(['DOC-3']), knownDocumentIdsComplete: true },
      )
      expect(result.verified).toEqual([{ documentId: 'DOC-3', verifiedBy: 'workspace_listing' }])
      expect(getDocumentProfile).not.toHaveBeenCalled()
    })

    it('excludes a candidate absent from a complete listing without calling getDocumentProfile', async () => {
      const getDocumentProfile = vi.fn()
      const result = await verifyWorkspaceMembership(
        { getDocumentProfile },
        { workspaceId: 'WS-1', candidateIds: ['DOC-3'], knownDocumentIds: new Set(['DOC-OTHER']), knownDocumentIdsComplete: true },
      )
      expect(result.excluded).toEqual([{ documentId: 'DOC-3', reason: 'wrong_workspace' }])
      expect(getDocumentProfile).not.toHaveBeenCalled()
    })

    it('falls back to getDocumentProfile for a candidate absent from an incomplete listing', async () => {
      const getDocumentProfile = vi.fn().mockResolvedValue(profile({ id: 'DOC-3', workspaceId: 'WS-1' }))
      const result = await verifyWorkspaceMembership(
        { getDocumentProfile },
        { workspaceId: 'WS-1', candidateIds: ['DOC-3'], knownDocumentIds: new Set(), knownDocumentIdsComplete: false },
      )
      expect(result.verified).toEqual([{ documentId: 'DOC-3', verifiedBy: 'profile_match' }])
      expect(getDocumentProfile).toHaveBeenCalledWith('DOC-3')
    })

    it('still uses the fast path for ids the incomplete listing did manage to collect', async () => {
      const getDocumentProfile = vi.fn()
      const result = await verifyWorkspaceMembership(
        { getDocumentProfile },
        { workspaceId: 'WS-1', candidateIds: ['DOC-3'], knownDocumentIds: new Set(['DOC-3']), knownDocumentIdsComplete: false },
      )
      expect(result.verified).toEqual([{ documentId: 'DOC-3', verifiedBy: 'workspace_listing' }])
      expect(getDocumentProfile).not.toHaveBeenCalled()
    })
  })
})
