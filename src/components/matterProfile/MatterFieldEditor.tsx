import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { MatterProfileFieldView } from '@/types/matterProfile'

/** Renders the appropriate shadcn control for one Matter Profile field, based on its data_type -- used by MatterProfileForm's "Edit Profile" mode. */
export function MatterFieldEditor({
  field,
  value,
  onChange,
}: {
  field: MatterProfileFieldView
  value: unknown
  onChange: (value: unknown) => void
}) {
  const inputId = `field-${field.fieldKey}`

  switch (field.dataType) {
    case 'multiline_text':
      return (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={inputId}>{field.displayName}</Label>
          <Textarea id={inputId} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} rows={4} />
        </div>
      )
    case 'number':
    case 'decimal':
      return (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={inputId}>{field.displayName}</Label>
          <Input
            id={inputId}
            type="number"
            value={value === null || value === undefined ? '' : String(value)}
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          />
        </div>
      )
    case 'date':
      return (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={inputId}>{field.displayName}</Label>
          <Input id={inputId} type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} />
        </div>
      )
    case 'boolean':
      return (
        <div className="flex items-center gap-2 pt-5">
          <Checkbox id={inputId} checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked === true)} />
          <Label htmlFor={inputId}>{field.displayName}</Label>
        </div>
      )
    case 'single_select': {
      // Draft state always holds the raw choice id (a plain string) for select
      // fields, never the stored {valueId,label} shape -- see
      // MatterProfileForm's initializeDraftValue, which unwraps it once when
      // entering edit mode. This is also exactly the shape the PATCH endpoint expects.
      const selectedValueId = (value as string | null | undefined) ?? undefined
      return (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={inputId}>{field.displayName}</Label>
          <Select value={selectedValueId} onValueChange={(valueId) => onChange(valueId)}>
            <SelectTrigger id={inputId} className="w-full">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {(field.allowedValues ?? []).map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    }
    default:
      return (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={inputId}>{field.displayName}</Label>
          <Input id={inputId} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} disabled={!field.editable} />
        </div>
      )
  }
}
