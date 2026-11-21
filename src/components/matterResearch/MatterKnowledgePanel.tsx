import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useIsMobile } from '@/hooks/use-mobile'
import { useMatterResearch } from '@/hooks/useMatterResearch'
import { fetchResearchMarkdown } from '@/services/matterResearchApi'
import { CoverageSummary } from './CoverageSummary'
import { GenerateSummaryButton } from './GenerateSummaryButton'
import { MarkdownViewer } from './MarkdownViewer'
import { ResearchActivityFeed } from './ResearchActivityFeed'
import { ResearchDocumentTable } from './ResearchDocumentTable'
import { ResearchQueryList } from './ResearchQueryList'
import { ResearchSkillCard } from './ResearchSkillCard'
import { ResearchStageTimeline } from './ResearchStageTimeline'

export function MatterKnowledgePanel({ workspaceId }: { workspaceId: string }) {
  const { runId, status, stage, documents, searchQueries, activity, coverage, skill, error, start, cancel } =
    useMatterResearch(workspaceId)
  const isMobile = useIsMobile()
  const [markdown, setMarkdown] = useState<string | undefined>()
  const [markdownError, setMarkdownError] = useState<string | undefined>()

  useEffect(() => {
    // Deliberately doesn't clear markdown/markdownError when status isn't
    // 'succeeded' (e.g. while regenerating) -- the previous summary stays
    // visible until a new one actually arrives, rather than flashing empty.
    if (status !== 'succeeded' || !runId) return
    let active = true
    fetchResearchMarkdown(runId)
      .then((result) => {
        if (active) setMarkdown(result.markdown)
      })
      .catch(() => {
        if (active) setMarkdownError("The summary finished but couldn't be loaded. Try regenerating it.")
      })
    return () => {
      active = false
    }
  }, [status, runId])

  const researchPanel = (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Research activity</CardTitle>
          <CardDescription>Live progress as the agent explores the workspace.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ResearchSkillCard skill={skill} />
          <ResearchStageTimeline stage={stage} status={status} />
          <ResearchActivityFeed items={activity} />
        </CardContent>
      </Card>
      {searchQueries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Search queries</CardTitle>
            <CardDescription>What the agent is searching for, and what it found.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResearchQueryList queries={searchQueries} />
          </CardContent>
        </Card>
      )}
      {coverage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <CoverageSummary coverage={coverage} />
          </CardContent>
        </Card>
      )}
    </div>
  )

  const knowledgePanel = (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents</CardTitle>
          <CardDescription>Discovered, selected and reviewed as research progresses.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResearchDocumentTable documents={documents} />
        </CardContent>
      </Card>
      {markdownError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{markdownError}</AlertDescription>
        </Alert>
      )}
      {markdown && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Matter Knowledge File</CardTitle>
          </CardHeader>
          <CardContent>
            <MarkdownViewer markdown={markdown} workspaceId={workspaceId} />
          </CardContent>
        </Card>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <GenerateSummaryButton status={status} onStart={() => void start()} />
        {status === 'running' && (
          <Button variant="outline" onClick={cancel}>
            Cancel
          </Button>
        )}
      </div>

      {status === 'failed' && error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Research failed</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
      {status === 'cancelled' && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Research cancelled</AlertTitle>
          <AlertDescription>The research run was cancelled before it finished.</AlertDescription>
        </Alert>
      )}

      {status !== 'idle' &&
        (isMobile ? (
          <Tabs defaultValue="research">
            <TabsList>
              <TabsTrigger value="research">Research</TabsTrigger>
              <TabsTrigger value="knowledge">Matter Knowledge</TabsTrigger>
            </TabsList>
            <TabsContent value="research" className="mt-4">
              {researchPanel}
            </TabsContent>
            <TabsContent value="knowledge" className="mt-4">
              {knowledgePanel}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {researchPanel}
            {knowledgePanel}
          </div>
        ))}
    </div>
  )
}
