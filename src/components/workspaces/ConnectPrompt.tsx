import { Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { startMcpConnect } from '@/services/mcpService'

export function ConnectPrompt() {
  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Link2 className="size-6" />
        </div>
        <CardTitle>Connect to iManage Work</CardTitle>
        <CardDescription>Connect your iManage account to find and browse your workspaces.</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button size="lg" onClick={() => startMcpConnect()}>
          Connect iManage
        </Button>
      </CardContent>
    </Card>
  )
}
