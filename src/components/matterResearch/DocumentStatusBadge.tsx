import { BookOpen, CheckCircle2, CircleDot, FileSearch, Loader2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { DocumentStatus } from '@/types/research'

const STATE_CONFIG: Record<DocumentStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  candidate: {
    label: 'Candidate',
    icon: CircleDot,
    className: 'border-border text-muted-foreground',
  },
  selected: {
    label: 'Selected',
    icon: FileSearch,
    className: 'border-border bg-muted text-muted-foreground',
  },
  reading: {
    label: 'Reading…',
    icon: Loader2,
    className: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-400',
  },
  reviewed: {
    label: 'Reviewed',
    icon: BookOpen,
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400',
  },
  used: {
    label: 'Used in summary',
    icon: CheckCircle2,
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400',
  },
  excluded: {
    label: 'Excluded',
    icon: XCircle,
    className: 'border-destructive/20 bg-destructive/10 text-destructive',
  },
}

export function DocumentStatusBadge({ status, className }: { status: DocumentStatus; className?: string }) {
  const config = STATE_CONFIG[status]
  const Icon = config.icon
  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      <Icon className={cn('size-3', status === 'reading' && 'animate-spin')} />
      {config.label}
    </Badge>
  )
}
