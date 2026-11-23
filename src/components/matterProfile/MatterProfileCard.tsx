import { useState } from 'react'
import { AlertCircle, Loader2, RotateCcw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ClassificationLiveSignal } from '@/hooks/useMatterResearch'
import { useMatterProfile } from '@/hooks/useMatterProfile'
import type { ResearchRunStatus } from '@/types/research'
import { AlternativeCategories } from './AlternativeCategories'
import { ClassificationSource } from './ClassificationSource'
import { ClassificationStatusBadge, ConfidenceLabel } from './ClassificationConfidence'

/**
 * Only ever rendered once research has succeeded (gated by the caller) --
 * never shows an empty/default profile before a completed Matter Knowledge
 * File exists. Classification itself is triggered automatically server-side;
 * this component is read/correct/retry only, never the thing that starts it.
 */
export function MatterProfileCard({
  workspaceId,
  client,
  researchStatus,
  classificationLive,
}: {
  workspaceId: string
  client?: string
  researchStatus: ResearchRunStatus | 'idle'
  classificationLive?: ClassificationLiveSignal
}) {
  const { profile, matterTypeOptions, isClassifying, actionPending, actionError, retryClassification, reclassify, correct } =
    useMatterProfile(workspaceId, { researchStatus, classificationLive })
  const [correctionValue, setCorrectionValue] = useState<string | undefined>()

  if (researchStatus !== 'succeeded') return null
  if (!profile && !isClassifying) return null

  const aiSuggestion = profile?.classification?.probabilities.reduce<{ id: string; label: string; probability: number } | undefined>(
    (best, p) => (!best || p.probability > best.probability ? p : best),
    undefined,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Matter Profile</CardTitle>
        <CardDescription>
          {profile?.workspaceName ?? workspaceId}
          {client ? ` · ${client}` : ''} · Workspace ID: {workspaceId} · Source: iManage Work
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isClassifying && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Classifying matter using GPT-6 Luna…
          </div>
        )}

        {profile && (
          <>
            {profile.outdated && (
              <Alert>
                <AlertCircle className="size-4" />
                <AlertDescription>
                  The Matter Knowledge File has been regenerated since this classification ran. Reclassify to bring it up to date.
                </AlertDescription>
              </Alert>
            )}

            {profile.matterType.status === 'failed' ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>
                  Classification failed{profile.error ? `: ${profile.error.message}` : '.'} The Matter Knowledge File is still available.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold text-foreground">{profile.matterType.label ?? 'Unclear / Other'}</span>
                  <ClassificationStatusBadge status={profile.matterType.status} />
                  {profile.override && <Badge variant="outline">User-confirmed</Badge>}
                </div>
                <div className="text-sm text-muted-foreground">
                  Confidence: <ConfidenceLabel confidence={profile.matterType.confidence} />
                </div>
                {profile.override && aiSuggestion && (
                  <p className="text-xs text-muted-foreground">
                    AI originally suggested <span className="font-medium text-foreground">{aiSuggestion.label}</span> (
                    {Math.round(aiSuggestion.probability * 100)}%); confirmed as{' '}
                    <span className="font-medium text-foreground">{profile.override.label}</span> by {profile.override.correctedBy} on{' '}
                    {new Date(profile.override.correctedAt).toLocaleDateString()}.
                  </p>
                )}
              </div>
            )}

            {profile.classification && (
              <AlternativeCategories probabilities={profile.classification.probabilities} selectedId={profile.matterType.id} />
            )}

            <ClassificationSource profile={profile} />

            <div className="flex flex-wrap items-center gap-2">
              {profile.matterType.status === 'failed' ? (
                <Button size="sm" variant="outline" disabled={actionPending} onClick={() => void retryClassification()}>
                  <RotateCcw className="size-3.5" />
                  Retry Classification
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled={actionPending} onClick={() => void reclassify()}>
                  <RotateCcw className="size-3.5" />
                  Reclassify
                </Button>
              )}

              <Select value={correctionValue} onValueChange={setCorrectionValue}>
                <SelectTrigger size="sm" className="w-56">
                  <SelectValue placeholder="Correct matter type…" />
                </SelectTrigger>
                <SelectContent>
                  {matterTypeOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!correctionValue || actionPending}
                onClick={() => {
                  if (correctionValue) void correct(correctionValue)
                  setCorrectionValue(undefined)
                }}
              >
                Save Correction
              </Button>
            </div>

            {actionError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
