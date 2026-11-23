import { apiRequest } from './api'
import type { MatterKnowledgeVersion } from '@/types/matterKnowledge'

export async function fetchKnowledgeVersions(workspaceId: string): Promise<MatterKnowledgeVersion[]> {
  const result = await apiRequest<{ versions: MatterKnowledgeVersion[] }>(`/matters/${encodeURIComponent(workspaceId)}/knowledge/versions`)
  return result.versions
}

/** Saves a Markdown edit as a new version -- basedOnVersionId must be the matter's current version, or the server returns a 409 (stale_markdown_version). */
export async function saveKnowledgeEdit(
  workspaceId: string,
  input: { content: string; basedOnVersionId: string; changeSummary?: string },
): Promise<MatterKnowledgeVersion> {
  const result = await apiRequest<{ version: MatterKnowledgeVersion }>(`/matters/${encodeURIComponent(workspaceId)}/knowledge`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return result.version
}

/** Restores an earlier version by creating a new current version with its content -- history is never overwritten. */
export async function restoreKnowledgeVersion(workspaceId: string, versionId: string): Promise<MatterKnowledgeVersion> {
  const result = await apiRequest<{ version: MatterKnowledgeVersion }>(`/matters/${encodeURIComponent(workspaceId)}/knowledge/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ versionId }),
  })
  return result.version
}
