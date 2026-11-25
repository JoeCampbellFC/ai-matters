import { useEffect, useRef, useState } from 'react'
import { Activity, AlertCircle, AlertTriangle, Loader2, TerminalIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMatterKnowledge } from '@/hooks/useMatterKnowledge'
import { useMatterResearch } from '@/hooks/useMatterResearch'
import { MatterProfileCard } from '@/components/matterProfile/MatterProfileCard'
import { MarkdownEditor } from '@/components/matterKnowledge/MarkdownEditor'
import { MarkdownVersionHistory } from '@/components/matterKnowledge/MarkdownVersionHistory'
import type { MatterKnowledgeVersion } from '@/types/matterKnowledge'
import type { BudgetLimitReason } from '@/types/research'
import type { Workspace } from '@/types/workspace'
import { CoverageSummary } from './CoverageSummary'
import { GenerateSummaryButton } from './GenerateSummaryButton'
import { MarkdownViewer } from './MarkdownViewer'
import { ResearchDocumentTable } from './ResearchDocumentTable'
import { ResearchStageTimeline } from './ResearchStageTimeline'
import { ResearchTerminal } from './ResearchTerminal'

const BUDGET_EXCEEDED_LABELS: Record<BudgetLimitReason, string> = {
  max_iterations: 'it reached the maximum number of refine passes',
  max_documents: 'it reached the maximum number of documents it could read',
  max_duration: 'it reached the maximum run time',
  max_llm_calls: 'it reached the maximum number of AI calls',
  max_mcp_calls: 'it reached the maximum number of document-system calls',
}

export function MatterKnowledgePanel({ workspace }: { workspace: Workspace }) {
  const workspaceId = workspace.id
  const {
    status,
    stage,
    documents,
    searchQueries,
    activity,
    coverage,
    skill,
    error,
    budgetExceeded,
    stageDurationsMs,
    currentStageStartedAt,
    iteration,
    maxStageIndexReached,
    classificationLive,
    classificationFieldsLive,
    classificationStartedAt,
    classificationDurationMs,
    start,
    cancel,
  } = useMatterResearch(workspaceId)
  const [viewingVersion, setViewingVersion] = useState<MatterKnowledgeVersion | undefined>()
  const [researchPanelOpen, setResearchPanelOpen] = useState(status === 'running')
  const previousStatusRef = useRef(status)
  useEffect(() => {
    if (status === 'running' && previousStatusRef.current !== 'running') {
      setResearchPanelOpen(true)
    }
    previousStatusRef.current = status
  }, [status])
  const {
    versions,
    currentVersion,
    saving: savingEdit,
    error: knowledgeError,
    save: saveEdit,
    restore: restoreVersion,
  } = useMatterKnowledge(workspaceId, status)
  const markdown = (viewingVersion ?? currentVersion)?.content

  const researchPanel = (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Research activity</CardTitle>
          <CardDescription>Live progress as the agent explores the workspace.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ResearchStageTimeline
            stage={stage}
            status={status}
            stageDurationsMs={stageDurationsMs}
            currentStageStartedAt={currentStageStartedAt}
            searchQueries={searchQueries}
            iteration={iteration}
            maxStageIndexReached={maxStageIndexReached}
            skill={skill}
            documentCount={documents.length}
            classificationLive={classificationLive}
            classificationStartedAt={classificationStartedAt}
            classificationDurationMs={classificationDurationMs}
          />
        </CardContent>
      </Card>
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents</CardTitle>
          <CardDescription>Discovered, selected and reviewed as research progresses.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <ResearchDocumentTable documents={documents} />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )

  const [editingMarkdown, setEditingMarkdown] = useState(false)

  const knowledgePanel = (
    <div className="flex flex-col gap-4">
      {markdown && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Matter Knowledge File</CardTitle>
            <CardDescription>
              {currentVersion && `Version ${currentVersion.versionNumber} · ${currentVersion.source === 'user_edited' ? 'Manually Edited' : 'AI Generated'}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              defaultValue="view"
              onValueChange={(value) => {
                setEditingMarkdown(value === 'edit')
                if (value !== 'view') setViewingVersion(undefined)
              }}
            >
              <TabsList>
                <TabsTrigger value="view">View</TabsTrigger>
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="history">Version History</TabsTrigger>
              </TabsList>
              <TabsContent value="view" className="mt-3">
                {viewingVersion && viewingVersion.id !== currentVersion?.id && (
                  <Alert className="mb-3">
                    <AlertCircle className="size-4" />
                    <AlertDescription>
                      Viewing version {viewingVersion.versionNumber} (not current).{' '}
                      <Button variant="link" className="h-auto p-0" onClick={() => setViewingVersion(undefined)}>
                        Back to current
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
                <MarkdownViewer markdown={markdown} workspaceId={workspaceId} />
              </TabsContent>
              <TabsContent value="edit" className="mt-3">
                {editingMarkdown && currentVersion && (
                  <MarkdownEditor
                    initialContent={currentVersion.content}
                    saving={savingEdit}
                    error={knowledgeError}
                    onSave={(content, changeSummary) => void saveEdit(content, changeSummary).then((ok) => ok && setEditingMarkdown(false))}
                    onCancel={() => setEditingMarkdown(false)}
                  />
                )}
              </TabsContent>
              <TabsContent value="history" className="mt-3">
                <MarkdownVersionHistory
                  versions={versions}
                  onOpen={setViewingVersion}
                  onRestore={(versionId) => void restoreVersion(versionId)}
                  restoring={savingEdit}
                />
              </TabsContent>
            </Tabs>
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
        {status !== 'idle' && (
          <Sheet open={researchPanelOpen} onOpenChange={setResearchPanelOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="relative">
                {status === 'running' ? <Loader2 className="size-4 animate-spin" /> : <Activity className="size-4" />}
                Research Activity
                {status === 'running' && (
                  <span className="absolute -top-1 -right-1 flex size-2.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full gap-0 sm:w-[70vw] sm:max-w-none">
              <SheetHeader>
                <SheetTitle>Research Activity</SheetTitle>
                <SheetDescription>Live progress, coverage, and discovered documents as the agent researches this matter.</SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-4 pb-4">{researchPanel}</div>
            </SheetContent>
          </Sheet>
        )}
        {status !== 'idle' && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">
                <TerminalIcon className="size-4" />
                View Terminal
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[20vh]">
              <SheetHeader>
                <SheetTitle>Terminal</SheetTitle>
                <SheetDescription>Live log of what the agent is doing, in order.</SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-hidden px-4 pb-4">
                <ResearchTerminal items={activity} className="h-full" scrollClassName="flex-1" />
              </div>
            </SheetContent>
          </Sheet>
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
      {status === 'succeeded' && budgetExceeded && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>Research stopped early</AlertTitle>
          <AlertDescription>
            This run finished because {BUDGET_EXCEEDED_LABELS[budgetExceeded]}, so coverage may be incomplete.
          </AlertDescription>
        </Alert>
      )}

      <MatterProfileCard
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        client={workspace.client}
        matter={workspace.matter}
        owner={workspace.owner}
        lastModified={workspace.lastModified}
        researchStatus={status}
        classificationLive={classificationLive}
        classificationFieldsLive={classificationFieldsLive}
      />

      {(status !== 'idle' || currentVersion) && knowledgePanel}
    </div>
  )
}
