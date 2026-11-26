import { FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDocumentFocus } from '@/context/DocumentFocusContext'
import type { CitationRegistryEntry } from '@/types/research'

/** Renders a widget item's sourceRefs as clickable citation badges that focus the matching entry in the Documents panel's Sources tab. */
export function CitationBadgeList({ sourceRefs, citationRegistry }: { sourceRefs: string[]; citationRegistry: CitationRegistryEntry[] }) {
  const { focusCitation } = useDocumentFocus()
  if (sourceRefs.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1">
      {sourceRefs.map((marker) => {
        const entry = citationRegistry.find((c) => c.marker === marker)
        return (
          <Tooltip key={marker}>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                asChild
                className="cursor-pointer gap-1 hover:bg-muted"
              >
                <button type="button" onClick={() => focusCitation(marker)}>
                  <FileText className="size-3" />
                  {marker}
                </button>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{entry?.documentName ?? 'Source document'}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
