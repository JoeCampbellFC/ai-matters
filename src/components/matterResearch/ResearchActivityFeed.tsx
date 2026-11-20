import { ScrollArea } from '@/components/ui/scroll-area'
import type { ResearchActivityItem } from '@/types/research'

export function ResearchActivityFeed({ items }: { items: ResearchActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        No activity yet.
      </div>
    )
  }

  return (
    <ScrollArea className="h-64 rounded-md border border-border">
      <ol className="flex flex-col gap-1.5 p-3">
        {items.map((item) => (
          <li key={item.seq} className="text-sm text-foreground">
            {item.message}
          </li>
        ))}
      </ol>
    </ScrollArea>
  )
}
