import { useEffect, useState } from 'react'
import {
  ArrowLeftRight,
  Factory,
  Flag,
  Gavel,
  Globe,
  Handshake,
  Hash,
  Landmark,
  Layers,
  Loader2,
  MapPin,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  Target,
  UserCog,
  Workflow,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchMatterProfile } from '@/services/matterProfileApi'
import type { MatterProfile } from '@/types/matterProfile'
import type { Workspace } from '@/types/workspace'

interface MetadataItem {
  label: string
  value: string
  icon: LucideIcon
}

/** All 16 Phase 3 classification dimensions, in their canonical order (see server/src/classification/classificationFields.ts). */
const HERO_CLASSIFICATION_FIELDS: Array<{ fieldId: string; icon: LucideIcon }> = [
  { fieldId: 'matter_type', icon: Scale },
  { fieldId: 'practice_area', icon: Landmark },
  { fieldId: 'industry_sector', icon: Factory },
  { fieldId: 'matter_subtype', icon: Tag },
  { fieldId: 'jurisdiction', icon: MapPin },
  { fieldId: 'client_role', icon: UserCog },
  { fieldId: 'transaction_type', icon: ArrowLeftRight },
  { fieldId: 'dispute_type', icon: Gavel },
  { fieldId: 'matter_complexity', icon: Layers },
  { fieldId: 'matter_stage', icon: Workflow },
  { fieldId: 'risk_level', icon: ShieldAlert },
  { fieldId: 'cross_border', icon: Globe },
  { fieldId: 'counterparty_type', icon: Handshake },
  { fieldId: 'regulatory_involvement', icon: ShieldCheck },
  { fieldId: 'commercial_objective', icon: Target },
  { fieldId: 'matter_outcome', icon: Flag },
]

function classifiedMetadata(profile: MatterProfile | undefined): MetadataItem[] {
  if (!profile) return []
  return HERO_CLASSIFICATION_FIELDS.flatMap(({ fieldId, icon }) => {
    const field = profile.fields.find((f) => f.fieldId === fieldId)
    return field?.label ? [{ label: field.fieldLabel, value: field.label, icon }] : []
  })
}

/**
 * Read-only header for the Matter Dashboard: name and classification
 * metadata only -- deliberately not the interactive MatterProfileCard used on
 * the Matter Knowledge page (no reclassify/correction controls here, and no
 * live classification streaming). Classified fields are fetched once,
 * read-only, and simply omitted if not yet classified. The matter's
 * description lives in the Matter Overview widget instead, alongside the
 * AI-generated summary, rather than being duplicated here too.
 */
export function DashboardHero({
  workspace,
  onRegenerate,
  regenerating,
}: {
  workspace: Workspace
  onRegenerate?: () => void
  regenerating?: boolean
}) {
  const [profile, setProfile] = useState<MatterProfile | undefined>()

  useEffect(() => {
    fetchMatterProfile(workspace.id)
      .then(setProfile)
      .catch(() => undefined)
  }, [workspace.id])

  const metadata: MetadataItem[] = [
    { label: 'Workspace ID', value: workspace.id, icon: Hash },
    ...classifiedMetadata(profile),
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-2xl font-semibold">{workspace.name}</CardTitle>
        {onRegenerate && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={onRegenerate} disabled={regenerating}>
              {regenerating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Regenerate
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          {metadata.map((item) => (
            <div key={item.label} className="flex items-start gap-2">
              <item.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
                <dd className="text-sm text-foreground">{item.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
