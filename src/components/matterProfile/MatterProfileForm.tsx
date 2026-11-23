import { useState } from 'react'
import { AlertCircle, Pencil } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { MatterProfileFieldView, ProfileFieldUpdate } from '@/types/matterProfile'
import { MatterFieldEditor } from './MatterFieldEditor'

/** A select field's stored value is {valueId,label}; every other data type stores its raw value directly. */
function draftValueFor(field: MatterProfileFieldView): unknown {
  if (field.dataType === 'single_select') {
    return (field.value as { valueId: string } | null)?.valueId ?? null
  }
  return field.value
}

function displayValue(field: MatterProfileFieldView): string {
  if (field.value === null || field.value === undefined) return '—'
  if (field.dataType === 'single_select') return (field.value as { label: string }).label
  if (field.dataType === 'boolean') return field.value ? 'Yes' : 'No'
  return String(field.value)
}

const SOURCE_LABEL: Record<string, string> = { iManage: 'iManage', ai: 'AI', user: 'User Edited', system: 'System' }

/**
 * The editable business-metadata section of the Matter Profile (Matter
 * Name, Client Name, Status, dates, etc. -- the Phase 4 fields with no AI
 * classifier). The 16 AI-classified dimensions are a separate table/
 * correction flow elsewhere on the same card.
 */
export function MatterProfileForm({
  profileFields,
  onSave,
  saving,
  conflict,
  onReload,
}: {
  profileFields: MatterProfileFieldView[]
  onSave: (updates: ProfileFieldUpdate[]) => Promise<boolean>
  saving: boolean
  conflict: boolean
  onReload: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, unknown>>({})

  function startEditing() {
    const initial: Record<string, unknown> = {}
    for (const field of profileFields) initial[field.fieldKey] = draftValueFor(field)
    setDraft(initial)
    setEditing(true)
  }

  function cancel() {
    setEditing(false)
    setDraft({})
  }

  function isDirty(field: MatterProfileFieldView): boolean {
    return JSON.stringify(draft[field.fieldKey] ?? null) !== JSON.stringify(draftValueFor(field) ?? null)
  }

  const dirty = profileFields.some(isDirty)

  async function handleSave() {
    const updates: ProfileFieldUpdate[] = profileFields
      .filter((field) => field.editable && isDirty(field))
      .map((field) => ({ fieldKey: field.fieldKey, value: draft[field.fieldKey], expectedVersion: field.version }))

    if (updates.length === 0) {
      setEditing(false)
      return
    }
    const ok = await onSave(updates)
    if (ok) setEditing(false)
  }

  if (profileFields.length === 0) return null

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Matter Profile Fields</h3>
        {!editing && (
          <Button size="sm" variant="outline" onClick={startEditing}>
            <Pencil className="size-3.5" />
            Edit Profile
          </Button>
        )}
      </div>

      {conflict && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            This profile changed since you loaded it.{' '}
            <Button variant="link" className="h-auto p-0" onClick={onReload}>
              Reload
            </Button>{' '}
            to see the latest values before saving again.
          </AlertDescription>
        </Alert>
      )}

      {editing ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {profileFields.map((field) => (
              <MatterFieldEditor
                key={field.fieldKey}
                field={field}
                value={draft[field.fieldKey]}
                onChange={(value) => setDraft((prev) => ({ ...prev, [field.fieldKey]: value }))}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
              {dirty ? 'Save Changes' : 'Done'}
            </Button>
            <Button size="sm" variant="outline" disabled={saving} onClick={cancel}>
              Cancel
            </Button>
            {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
          </div>
        </>
      ) : (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {profileFields.map((field) => (
            <div key={field.fieldKey}>
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {field.displayName}
                {field.valueSource && (
                  <Badge variant="outline" className="h-4 px-1 text-[10px] font-normal">
                    {SOURCE_LABEL[field.valueSource] ?? field.valueSource}
                  </Badge>
                )}
              </dt>
              <dd className="text-sm font-medium text-foreground">{displayValue(field)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
