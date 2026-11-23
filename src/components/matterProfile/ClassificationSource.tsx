import type { MatterProfile } from '@/types/matterProfile'

/**
 * Traceability back to the exact Matter Knowledge artifact this
 * classification used -- the Decisions API itself only ever returns a
 * choice and scores, never an explanation, so nothing here is presented as
 * model-generated reasoning.
 */
export function ClassificationSource({ profile }: { profile: MatterProfile }) {
  if (!profile.classification || !profile.source) return null

  return (
    <div className="flex flex-col gap-1 text-sm">
      <h4 className="text-sm font-medium text-foreground">Classification Source</h4>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="text-xs">Model</dt>
          <dd className="text-foreground">GPT-6 Luna ({profile.classification.deploymentName})</dd>
        </div>
        <div>
          <dt className="text-xs">Classified</dt>
          <dd className="text-foreground">{new Date(profile.classification.classifiedAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-xs">Knowledge File version</dt>
          <dd className="text-foreground">v{profile.source.markdownVersion}</dd>
        </div>
        <div>
          <dt className="text-xs">Input used</dt>
          <dd className="text-foreground">
            {profile.classification.inputMode === 'full' ? 'Full Matter Knowledge File' : 'Reduced extract (file exceeded the input budget)'}
          </dd>
        </div>
        {profile.source.documentsUsed > 0 && (
          <div>
            <dt className="text-xs">Source documents reviewed</dt>
            <dd className="text-foreground">{profile.source.documentsUsed}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs">Taxonomy version</dt>
          <dd className="text-foreground">{profile.classification.taxonomyVersion}</dd>
        </div>
      </dl>
    </div>
  )
}
