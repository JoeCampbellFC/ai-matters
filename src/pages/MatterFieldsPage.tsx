import { useState } from 'react'
import { AlertTriangle, Loader2, Plus, Trash2, X } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCreateFieldDefinition, useDeleteFieldDefinition, useFieldDefinitions, useUpdateFieldDefinition } from '@/hooks/useFieldDefinitions'
import { ApiError } from '@/services/api'
import type { FieldDefinition } from '@/types/fieldDefinitions'
import type { MatterFieldDataType } from '@/types/matterProfile'

const DATA_TYPES: Array<{ value: MatterFieldDataType; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'multiline_text', label: 'Multiline text' },
  { value: 'number', label: 'Number' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'single_select', label: 'Single select' },
  { value: 'multi_select', label: 'Multi select' },
]

const DATA_TYPE_LABELS = Object.fromEntries(DATA_TYPES.map((t) => [t.value, t.label])) as Record<MatterFieldDataType, string>
const SELECT_TYPES = new Set<MatterFieldDataType>(['single_select', 'multi_select'])

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

type AllowedValue = { id: string; label: string }

function AllowedValuesEditor({ values, onChange }: { values: AllowedValue[]; onChange: (values: AllowedValue[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>Allowed values</Label>
      {values.map((value, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={value.id}
            onChange={(e) => onChange(values.map((v, i) => (i === index ? { ...v, id: e.target.value } : v)))}
            placeholder="id"
            className="w-32 font-mono text-xs"
          />
          <Input
            value={value.label}
            onChange={(e) => onChange(values.map((v, i) => (i === index ? { ...v, label: e.target.value } : v)))}
            placeholder="Label"
          />
          <Button type="button" variant="outline" size="icon" onClick={() => onChange(values.filter((_, i) => i !== index))}>
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onChange([...values, { id: '', label: '' }])}>
        <Plus className="size-4" />
        Add option
      </Button>
    </div>
  )
}

function NewFieldDefinitionDialog({ onCreated }: { onCreated: (field: FieldDefinition) => void }) {
  const [open, setOpen] = useState(false)
  const [fieldKey, setFieldKey] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [dataType, setDataType] = useState<MatterFieldDataType>('text')
  const [required, setRequired] = useState(false)
  const [allowedValues, setAllowedValues] = useState<AllowedValue[]>([])
  const createMutation = useCreateFieldDefinition()

  const isSelectType = SELECT_TYPES.has(dataType)
  const canSubmit = fieldKey.trim().length > 0 && displayName.trim().length > 0 && (!isSelectType || allowedValues.length > 0)

  const reset = () => {
    setFieldKey('')
    setDisplayName('')
    setDescription('')
    setDataType('text')
    setRequired(false)
    setAllowedValues([])
    createMutation.reset()
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  const handleCreate = () => {
    createMutation.mutate(
      {
        fieldKey: fieldKey.trim(),
        displayName: displayName.trim(),
        description: description.trim() || undefined,
        dataType,
        allowedValues: isSelectType ? allowedValues : undefined,
        required,
      },
      { onSuccess: (field) => { handleOpenChange(false); onCreated(field) } },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New Field
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] w-full flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>New Matter Field</DialogTitle>
          <DialogDescription>Field key and data type cannot be changed after creation.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-field-key">Field key</Label>
            <Input id="new-field-key" value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} placeholder="referral_source" className="font-mono text-xs" />
            <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and underscores only.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-field-display-name">Display name</Label>
            <Input id="new-field-display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Referral Source" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-field-description">Description (optional)</Label>
            <Textarea id="new-field-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Data type</Label>
            <Select value={dataType} onValueChange={(value) => setDataType(value as MatterFieldDataType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATA_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="new-field-required" checked={required} onCheckedChange={(checked) => setRequired(checked === true)} />
            <Label htmlFor="new-field-required" className="font-normal">
              Required
            </Label>
          </div>
          {isSelectType && <AllowedValuesEditor values={allowedValues} onChange={setAllowedValues} />}
          {createMutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(createMutation.error, 'Failed to create field.')}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSubmit || createMutation.isPending} onClick={handleCreate}>
            {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteFieldDefinitionDialog({ field, onOpenChange }: { field: FieldDefinition; onOpenChange: (open: boolean) => void }) {
  const deleteMutation = useDeleteFieldDefinition()
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{field.displayName}&rdquo;?</DialogTitle>
          <DialogDescription>
            This permanently deletes every matter&rsquo;s stored value for this field, not just the catalog entry. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {deleteMutation.isError && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(deleteMutation.error, 'Failed to delete field.')}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate(field, { onSuccess: () => onOpenChange(false) })}
          >
            {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditFieldDefinitionDialog({ field, onOpenChange }: { field: FieldDefinition; onOpenChange: (open: boolean) => void }) {
  const [displayName, setDisplayName] = useState(field.displayName)
  const [description, setDescription] = useState(field.description)
  const [required, setRequired] = useState(field.required)
  const [allowedValues, setAllowedValues] = useState<AllowedValue[]>(field.allowedValues ?? [])
  const updateMutation = useUpdateFieldDefinition()

  const isSelectType = SELECT_TYPES.has(field.dataType)

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>Editing &ldquo;{field.displayName}&rdquo;</DialogTitle>
          <DialogDescription>
            Field key <code className="font-mono">{field.fieldKey}</code> · {DATA_TYPE_LABELS[field.dataType]} — neither can be changed.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
          {field.isAiClassified && (
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertDescription>
                This field&rsquo;s AI-classified value and the options shown on the Matter Profile page are controlled by code, not by this
                catalog — editing the labels here only changes how this field appears in this admin list.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-field-display-name">Display name</Label>
            <Input id="edit-field-display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-field-description">Description</Label>
            <Textarea id="edit-field-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="edit-field-required" checked={required} onCheckedChange={(checked) => setRequired(checked === true)} />
            <Label htmlFor="edit-field-required" className="font-normal">
              Required
            </Label>
          </div>
          {isSelectType && <AllowedValuesEditor values={allowedValues} onChange={setAllowedValues} />}
          {updateMutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(updateMutation.error, 'Failed to save field.')}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" disabled={updateMutation.isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={updateMutation.isPending}
            onClick={() =>
              updateMutation.mutate(
                {
                  id: field.id,
                  displayName: displayName.trim(),
                  description: description.trim(),
                  required,
                  allowedValues: isSelectType ? allowedValues : undefined,
                  expectedVersion: field.version,
                },
                { onSuccess: () => onOpenChange(false) },
              )
            }
          >
            {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Save Field
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function MatterFieldsPage() {
  const { data: fields, isLoading } = useFieldDefinitions()
  const [editingId, setEditingId] = useState<string | undefined>()
  const [deletingField, setDeletingField] = useState<FieldDefinition | undefined>()

  const editingField = fields?.find((f) => f.id === editingId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Matter Fields</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The catalog of Matter Profile fields — labels, options, and requiredness. Does not change AI classification behavior.
          </p>
        </div>
        <NewFieldDefinitionDialog onCreated={(field) => setEditingId(field.id)} />
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Display name</TableHead>
                <TableHead>Field key</TableHead>
                <TableHead>Data type</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {fields?.map((field) => (
                <TableRow key={field.id}>
                  <TableCell className="font-medium">{field.displayName}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{field.fieldKey}</TableCell>
                  <TableCell className="text-muted-foreground">{DATA_TYPE_LABELS[field.dataType]}</TableCell>
                  <TableCell className="text-muted-foreground">{field.required ? 'Yes' : 'No'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={field.systemField ? 'secondary' : 'outline'}>{field.systemField ? 'System' : 'Custom'}</Badge>
                      {field.isAiClassified && <Badge variant="outline">AI-classified</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => setEditingId(field.id)}>
                        Edit
                      </Button>
                      {field.systemField ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button variant="outline" size="sm" disabled>
                                <Trash2 className="size-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>System fields cannot be deleted.</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => setDeletingField(field)}>
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editingField && (
        <EditFieldDefinitionDialog
          key={editingField.id}
          field={editingField}
          onOpenChange={(open) => {
            if (!open) setEditingId(undefined)
          }}
        />
      )}
      {deletingField && (
        <DeleteFieldDefinitionDialog
          field={deletingField}
          onOpenChange={(open) => {
            if (!open) setDeletingField(undefined)
          }}
        />
      )}
    </div>
  )
}
