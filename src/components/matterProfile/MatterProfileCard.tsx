import { useMemo } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ClassificationFieldLiveSignal, ClassificationLiveSignal } from '@/hooks/useMatterResearch'
import { useMatterProfile } from '@/hooks/useMatterProfile'
import type { ResearchRunStatus } from '@/types/research'
import { ClassificationFieldsTable, buildClassificationRows } from './ClassificationFieldsTable'

/**
 * The first, full-width panel on a workspace's matter page: iManage-sourced
 * fields (always available) plus all 16 Decisions API classification
 * dimensions, each of which stays blank -- field name shown, value empty --
 * until its own independent classification call completes. One row per
 * field doubles as both the live "agent status" (updates as each field's
 * call starts/finishes) and the final result.
 */
export function MatterProfileCard({
  workspaceId,
  workspaceName,
  client,
  matter,
  owner,
  lastModified,
  researchStatus,
  classificationLive,
  classificationFieldsLive,
}: {
  workspaceId: string
  workspaceName: string
  client?: string
  matter?: string
  owner?: string
  lastModified?: string
  researchStatus: ResearchRunStatus | 'idle'
  classificationLive?: ClassificationLiveSignal
  classificationFieldsLive: Record<string, ClassificationFieldLiveSignal>
}) {
  const { profile, fieldOptions, isClassifying, actionPending, actionError, conflict, reclassify, correct, refresh } = useMatterProfile(
    workspaceId,
    { researchStatus, classificationLive },
  )

  const rows = useMemo(
    () => buildClassificationRows(fieldOptions, profile?.fields, classificationFieldsLive),
    [fieldOptions, profile?.fields, classificationFieldsLive],
  )

  const METADATA: Array<{ label: string; value?: string }> = [
    { label: 'Workspace Name', value: workspaceName },
    { label: 'Client', value: client },
    { label: 'Matter', value: matter },
    { label: 'Owner', value: owner },
    { label: 'Last Modified', value: lastModified },
    { label: 'Workspace ID', value: workspaceId },
    { label: 'Source', value: 'iManage Work' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Matter Profile</CardTitle>
        <CardDescription>Workspace details and AI-classified matter fields.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {METADATA.filter((field) => field.value).map((field) => (
            <div key={field.label}>
              <dt className="text-xs text-muted-foreground">{field.label}</dt>
              <dd className="text-sm font-medium text-foreground">{field.value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          {isClassifying && (
            <p className="text-sm text-muted-foreground">Classifying this matter using GPT-6 Luna — one call per field below…</p>
          )}

          {profile?.outdated && (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertDescription>
                The Matter Knowledge File has been regenerated since this classification ran. Reclassify to bring it up to date.
              </AlertDescription>
            </Alert>
          )}

          <ClassificationFieldsTable
            rows={rows}
            fieldOptions={fieldOptions}
            onCorrect={(fieldId, valueId, expectedVersion) => void correct(fieldId, valueId, expectedVersion)}
            correcting={actionPending}
          />

          {profile && (
            <div>
              <Button size="sm" variant="outline" disabled={actionPending} onClick={() => void reclassify()}>
                <RotateCcw className="size-3.5" />
                Reclassify
              </Button>
            </div>
          )}

          {actionError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>
                {actionError}
                {conflict && (
                  <>
                    {' '}
                    <Button variant="link" className="h-auto p-0" onClick={refresh}>
                      Reload
                    </Button>
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
