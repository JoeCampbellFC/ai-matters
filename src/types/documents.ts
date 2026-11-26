/** Mirrors server/src/mcp/matterMapper.ts's ContainerChild/SearchHit shapes (API projection). */

export type ContainerItemType = 'document' | 'folder' | 'workspace' | 'tab' | 'email' | 'shortcut' | 'unknown'
export type ContainerType = 'workspace' | 'tab' | 'folder'

export interface ContainerChild {
  id: string
  name?: string
  type: ContainerItemType
  raw: Record<string, unknown>
}

export interface DocumentChildrenPage {
  matterId: string
  children: ContainerChild[]
  nextCursor?: string
}

export interface VerifiedSearchHit {
  documentId?: string
  name?: string
  snippet?: string
  raw: Record<string, unknown>
  verifiedBy: 'profile_match' | 'workspace_listing'
}

export interface DocumentSearchResult {
  matterId: string
  hits: VerifiedSearchHit[]
  excludedCount: number
}
