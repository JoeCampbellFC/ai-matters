import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ResearchRunStatus } from '@/types/research'

export function GenerateSummaryButton({
  status,
  onStart,
}: {
  status: ResearchRunStatus | 'idle'
  onStart: () => void
}) {
  const isRunning = status === 'running'
  const label = isRunning ? 'Generating…' : status === 'idle' ? 'Generate Matter Summary' : 'Regenerate Summary'

  return (
    <Button onClick={onStart} disabled={isRunning}>
      {isRunning ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
      {label}
    </Button>
  )
}
