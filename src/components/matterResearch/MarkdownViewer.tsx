import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Copy, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

/**
 * react-markdown's default AST-to-React rendering never executes raw HTML
 * from the LLM-authored content -- that's the sanitization, so no
 * rehype-raw / dangerouslySetInnerHTML is used here.
 */
export function MarkdownViewer({ markdown, workspaceId }: { markdown: string; workspaceId: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function handleDownload() {
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `matter-summary-${workspaceId}.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Tabs defaultValue="formatted" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="formatted">Formatted</TabsTrigger>
          <TabsTrigger value="raw">Raw Markdown</TabsTrigger>
        </TabsList>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? 'Copied' : 'Copy Markdown'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="size-3.5" />
            Download .md
          </Button>
        </div>
      </div>
      <TabsContent value="formatted">
        <ScrollArea className="h-[70vh] min-h-[32rem] rounded-md border border-border p-4">
          <article className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </article>
        </ScrollArea>
      </TabsContent>
      <TabsContent value="raw">
        <ScrollArea className="h-[70vh] min-h-[32rem] rounded-md border border-border p-4">
          <pre className="whitespace-pre-wrap text-xs text-foreground">{markdown}</pre>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  )
}
