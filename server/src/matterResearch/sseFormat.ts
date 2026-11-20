import type { ResearchEvent } from './types.js'

export function formatSseEvent(event: ResearchEvent): string {
  return `id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}
