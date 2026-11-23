import { useState } from 'react'
import { AlertCircle, TerminalIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useIsMobile } from '@/hooks/use-mobile'
import { useMatterKnowledge } from '@/hooks/useMatterKnowledge'
import { useMatterResearch } from '@/hooks/useMatterResearch'
import { MatterProfileCard } from '@/components/matterProfile/MatterProfileCard'
import { MarkdownEditor } from '@/components/matterKnowledge/MarkdownEditor'
import { MarkdownVersionHistory } from '@/components/matterKnowledge/MarkdownVersionHistory'
import type { MatterKnowledgeVersion } from '@/types/matterKnowledge'
import type { Workspace } from '@/types/workspace'
import { CoverageSummary } from './CoverageSummary'
import { GenerateSummaryButton } from './GenerateSummaryButton'
import { MarkdownViewer } from './MarkdownViewer'
import { ResearchDocumentTable } from './ResearchDocumentTable'
import { ResearchSkillCard } from './ResearchSkillCard'
import { ResearchStageTimeline } from './ResearchStageTimeline'
import { ResearchTerminal } from './ResearchTerminal'

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
  const isMobile = useIsMobile()
  const [viewingVersion, setViewingVersion] = useState<MatterKnowledgeVersion | undefined>()
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
          <ResearchSkillCard skill={skill} />
          <ResearchStageTimeline
            stage={stage}
            status={status}
            stageDurationsMs={stageDurationsMs}
            currentStageStartedAt={currentStageStartedAt}
            searchQueries={searchQueries}
            iteration={iteration}
            maxStageIndexReached={maxStageIndexReached}
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
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">
                <TerminalIcon className="size-4" />
                View Terminal
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[60vh]">
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

      {(status !== 'idle' || currentVersion) &&
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
