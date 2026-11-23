/** Mirrors server/src/database/schema/matterKnowledge.ts's matterKnowledgeVersions row shape (API projection). */
export interface MatterKnowledgeVersion {
  id: string
  matterId: string
  versionNumber: number
  content: string
  contentHash: string
  source: 'ai_generated' | 'user_edited'
  researchRunId: string | null
  status: 'draft' | 'published' | 'superseded'
  createdBy: string
  createdAt: string
  parentVersionId: string | null
  changeSummary: string | null
}
