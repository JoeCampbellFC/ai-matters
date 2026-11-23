import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { MatterKnowledgeVersion } from '@/types/matterKnowledge'

const SOURCE_LABEL: Record<MatterKnowledgeVersion['source'], string> = {
  ai_generated: 'AI Generated',
  user_edited: 'Manually Edited',
}

export function MarkdownVersionHistory({
  versions,
  onOpen,
  onRestore,
  restoring,
}: {
  versions: MatterKnowledgeVersion[]
  onOpen: (version: MatterKnowledgeVersion) => void
  onRestore: (versionId: string) => void
  restoring: boolean
}) {
  if (versions.length === 0) {
    return <p className="text-sm text-muted-foreground">No versions yet.</p>
  }

  return (
    <ScrollArea className="h-[28rem]">
      <ul className="flex flex-col gap-2">
        {versions.map((version, index) => (
          <li key={version.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">Version {version.versionNumber}</span>
                {index === 0 && (
                  <Badge variant="outline" className="h-4 px-1 text-[10px] font-normal">
                    Current
                  </Badge>
                )}
                <Badge variant="outline" className="h-4 px-1 text-[10px] font-normal">
                  {SOURCE_LABEL[version.source]}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(version.createdAt).toLocaleString()} · {version.createdBy}
              </span>
              {version.changeSummary && <span className="text-xs text-muted-foreground">{version.changeSummary}</span>}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" onClick={() => onOpen(version)}>
                View
              </Button>
              {index !== 0 && (
                <Button size="sm" variant="outline" disabled={restoring} onClick={() => onRestore(version.id)}>
                  Restore
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </ScrollArea>
  )
}
