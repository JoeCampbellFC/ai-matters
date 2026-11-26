import { FolderOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDocumentFocus } from '@/context/DocumentFocusContext'
import { MatterDocumentsPanel } from '../MatterDocumentsPanel'
import type { CitationRegistryEntry } from '@/types/research'

/**
 * The live iManage Documents panel, always on-page near the top of the
 * dashboard (not gated behind the LLM projection) -- Browse/Search work off
 * iManage directly, independent of whether a dashboard has been generated.
 */
export function DocumentsWidget({ workspaceId, citationRegistry }: { workspaceId: string; citationRegistry: CitationRegistryEntry[] }) {
  const { documentsRef } = useDocumentFocus()

  return (
    <Card ref={documentsRef}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderOpen className="size-4" />
          Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[28rem]">
        <MatterDocumentsPanel workspaceId={workspaceId} citationRegistry={citationRegistry} />
      </CardContent>
    </Card>
  )
}
