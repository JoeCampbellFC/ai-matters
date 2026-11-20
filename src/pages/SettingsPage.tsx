import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ConnectionStatusBadge } from '@/components/workspaces/ConnectionStatusBadge'
import { useDisconnectMcp, useMcpStatus, useMcpTools } from '@/hooks/useMcpConnection'
import { startMcpConnect } from '@/services/mcpService'

const TOOL_LABELS: Record<string, string> = {
  searchWorkspaces: 'Search workspaces',
  getRecentWorkspaces: 'Recently accessed workspaces',
  getLibraries: 'Libraries (optional)',
}

function ToolAvailability({ available, label }: { available: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {available ? <Check className="size-4 text-emerald-600" /> : <X className="size-4 text-muted-foreground" />}
      <span className={available ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </div>
  )
}

export function SettingsPage() {
  const { data: status, isLoading } = useMcpStatus()
  const { data: tools } = useMcpTools(status?.state === 'connected')
  const disconnectMutation = useDisconnectMcp()

  const isConnected = status?.state === 'connected'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage the AI Matters integration with iManage Work.</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>iManage Work</CardTitle>
          <CardDescription>OAuth connection used to discover and search your workspaces.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Connection status</span>
                <ConnectionStatusBadge state={status?.state ?? 'not_connected'} />
              </div>

              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <span className="text-muted-foreground">Environment</span>
                <span className="font-mono text-xs text-foreground">{status?.environment}</span>

                {status?.authenticatedUser?.name || status?.authenticatedUser?.email ? (
                  <>
                    <span className="text-muted-foreground">Authenticated user</span>
                    <span className="text-foreground">
                      {status.authenticatedUser.name}
                      {status.authenticatedUser.name && status.authenticatedUser.email ? ' · ' : ''}
                      {status.authenticatedUser.email}
                    </span>
                  </>
                ) : null}

                {status?.error ? (
                  <>
                    <span className="text-muted-foreground">Details</span>
                    <span className="text-foreground">{status.error}</span>
                  </>
                ) : null}
              </div>

              {isConnected && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-2 text-sm font-medium text-foreground">Required workspace tools</p>
                    <div className="flex flex-col gap-1.5">
                      {Object.entries(TOOL_LABELS).map(([key, label]) => (
                        <ToolAvailability
                          key={key}
                          label={label}
                          available={Boolean(status?.tools?.[key as keyof typeof status.tools])}
                        />
                      ))}
                    </div>
                    {tools && tools.length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Discovered via MCP tools/list: {tools.map((tool) => tool.name).join(', ')}
                      </p>
                    )}
                  </div>
                </>
              )}

              <Separator />

              <div className="flex justify-end gap-2">
                {isConnected ? (
                  <Button variant="outline" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>
                    Disconnect
                  </Button>
                ) : (
                  <Button onClick={() => startMcpConnect()}>Connect iManage</Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
