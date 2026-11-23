import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { ResearchActivityItem } from '@/types/research'

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour12: false })
}

/**
 * Renders the same activity log as a terminal-style scrollback rather than a
 * plain list -- a dark monospace box that always auto-scrolls to the latest
 * line, like watching a real process's console output.
 */
export function ResearchTerminal({
  items,
  className,
  scrollClassName = 'h-64',
}: {
  items: ResearchActivityItem[]
  className?: string
  /** Sizes the scrollable log area -- defaults to a fixed height, pass e.g. "flex-1" when the parent controls the height instead (e.g. inside a full-height sheet). */
  scrollClassName?: string
}) {
  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [items])

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950', className)}>
      <div className="flex items-center gap-1.5 border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        <span className="size-2.5 rounded-full bg-red-500/70" />
        <span className="size-2.5 rounded-full bg-amber-500/70" />
        <span className="size-2.5 rounded-full bg-emerald-500/70" />
      </div>
      <div ref={viewportRef} className={cn('overflow-y-auto px-3 py-2 font-mono text-xs leading-relaxed', scrollClassName)}>
        {items.length === 0 ? (
          <p className="text-zinc-500">Waiting for activity…</p>
        ) : (
          items.map((item) => (
            <p key={item.seq} className="whitespace-pre-wrap break-words text-zinc-200">
              <span className="text-zinc-500">[{formatTimestamp(item.ts)}]</span>{' '}
              <span className="text-emerald-400">$</span> {item.message}
            </p>
          ))
        )}
      </div>
    </div>
  )
}
