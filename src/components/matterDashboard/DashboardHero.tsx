import { useEffect, useState } from 'react'
import { Building2, Clock, Database, Hash, Landmark, Scale, ShieldAlert, User, Workflow } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchMatterProfile } from '@/services/matterProfileApi'
import type { MatterProfile } from '@/types/matterProfile'
import type { Workspace } from '@/types/workspace'

interface MetadataItem {
  label: string
  value: string
  icon: LucideIcon
}

/** A curated "at a glance" subset of the 16 classified dimensions -- showing all 16 here would overwhelm the hero; the rest stay on the Matter Knowledge page. */
const HERO_CLASSIFICATION_FIELDS: Array<{ fieldId: string; icon: LucideIcon }> = [
  { fieldId: 'matter_type', icon: Scale },
  { fieldId: 'practice_area', icon: Landmark },
  { fieldId: 'matter_stage', icon: Workflow },
  { fieldId: 'risk_level', icon: ShieldAlert },
]

function classifiedMetadata(profile: MatterProfile | undefined): MetadataItem[] {
  if (!profile) return []
  return HERO_CLASSIFICATION_FIELDS.flatMap(({ fieldId, icon }) => {
    const field = profile.fields.find((f) => f.fieldId === fieldId)
    return field?.label ? [{ label: field.fieldLabel, value: field.label, icon }] : []
  })
}

/**
 * Read-only header for the Matter Dashboard: name and iManage/classified
 * metadata only -- deliberately not the interactive MatterProfileCard used on
 * the Matter Knowledge page (no reclassify/correction controls here, and no
 * live classification streaming). Classified fields are fetched once,
 * read-only, and simply omitted if not yet classified. The matter's
 * description lives in the Matter Overview widget instead, alongside the
 * AI-generated summary, rather than being duplicated here too.
 */
export function DashboardHero({ workspace }: { workspace: Workspace }) {
  const [profile, setProfile] = useState<MatterProfile | undefined>()

  useEffect(() => {
    fetchMatterProfile(workspace.id)
      .then(setProfile)
      .catch(() => undefined)
  }, [workspace.id])

  const metadata: MetadataItem[] = [
    { label: 'Client', value: workspace.client ?? '—', icon: Building2 },
    { label: 'Owner', value: workspace.owner ?? '—', icon: User },
    { label: 'Last Modified', value: workspace.lastModified ?? '—', icon: Clock },
    ...classifiedMetadata(profile),
    { label: 'Workspace ID', value: workspace.id, icon: Hash },
    { label: 'Source', value: 'iManage Work', icon: Database },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-2xl font-semibold">{workspace.name}</CardTitle>
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
