import { AlertTriangle, CheckCircle2, CircleSlash2, Loader2, ShieldAlert, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { McpConnectionState } from '@/types/workspace'

const STATE_CONFIG: Record<
  McpConnectionState,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  connected: {
    label: 'Connected',
    icon: CheckCircle2,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400',
  },
  connecting: {
    label: 'Connecting…',
    icon: Loader2,
    className: 'border-border bg-muted text-muted-foreground',
  },
  not_connected: {
    label: 'Not connected',
    icon: CircleSlash2,
    className: 'border-border text-muted-foreground',
  },
  auth_required: {
    label: 'Authentication required',
    icon: ShieldAlert,
    className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400',
  },
  permission_denied: {
    label: 'Permission denied',
    icon: XCircle,
    className: 'border-destructive/20 bg-destructive/10 text-destructive',
  },
  tool_unavailable: {
    label: 'Tool unavailable',
    icon: AlertTriangle,
    className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400',
  },
  error: {
    label: 'Connection error',
    icon: XCircle,
    className: 'border-destructive/20 bg-destructive/10 text-destructive',
  },
}

export function ConnectionStatusBadge({ state, className }: { state: McpConnectionState; className?: string }) {
  const config = STATE_CONFIG[state] ?? STATE_CONFIG.error
  const Icon = config.icon
  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      <Icon className={cn('size-3', state === 'connecting' && 'animate-spin')} />
      {config.label}
    </Badge>
  )
}
