import { Loader2 } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ClassificationFieldLiveSignal } from '@/hooks/useMatterResearch'
import type { ClassificationFieldOption, ClassificationStatus, MatterProfileField } from '@/types/matterProfile'
import { ClassificationStatusBadge, ConfidenceLabel } from './ClassificationConfidence'

export interface ClassificationRow {
  fieldId: string
  fieldLabel: string
  valueId: string | null
  label: string | null
  confidence: number | null
  status: ClassificationStatus | 'classifying'
  probabilities: MatterProfileField['probabilities']
  override?: MatterProfileField['override']
  error?: { code: string; message: string }
}

/**
 * One row per classification dimension, always derived from the full field
 * list (so every field shows, blank/pending, even before it's ever been
 * attempted) -- merges the durable profile (authoritative once fetched)
 * with the live per-field signal streaming in while a batch is in progress.
 * A "classifying" live status always wins, even over a stale stored value,
 * so the row visibly updates the moment that field starts its own call.
 */
export function buildClassificationRows(
  fieldOptions: ClassificationFieldOption[],
  fields: MatterProfileField[] | undefined,
  fieldsLive: Record<string, ClassificationFieldLiveSignal>,
): ClassificationRow[] {
  return fieldOptions.map((option) => {
    const live = fieldsLive[option.fieldId]

    if (live?.status === 'classifying') {
      return {
        fieldId: option.fieldId,
        fieldLabel: option.label,
        valueId: null,
        label: null,
        confidence: null,
        status: 'classifying',
        probabilities: [],
      }
    }

    const stored = fields?.find((f) => f.fieldId === option.fieldId)
    if (stored) return { ...stored, fieldLabel: option.label }

    if (live) {
      return {
        fieldId: option.fieldId,
        fieldLabel: option.label,
        valueId: live.valueId ?? null,
        label: live.label ?? null,
        confidence: live.confidence ?? null,
        status: live.status === 'failed' ? 'failed' : ((live.reviewStatus as ClassificationStatus) ?? 'classified'),
        probabilities: [],
        error: live.error,
      }
    }

    return {
      fieldId: option.fieldId,
      fieldLabel: option.label,
      valueId: null,
      label: null,
      confidence: null,
      status: 'pending',
      probabilities: [],
    }
  })
}

export function ClassificationFieldsTable({ rows }: { rows: ClassificationRow[] }) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Field</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const topAlternative = [...row.probabilities]
              .filter((p) => p.id !== row.valueId)
              .sort((a, b) => b.probability - a.probability)[0]
            const isClassifying = row.status === 'classifying'

            return (
              <TableRow key={row.fieldId}>
                <TableCell className="font-medium text-foreground">{row.fieldLabel}</TableCell>
                <TableCell>
                  {isClassifying ? (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      Classifying…
                    </span>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <span className={row.label ? 'text-foreground' : 'text-muted-foreground'}>
                        {row.label ?? '—'}
                        {row.override && <span className="ml-1.5 text-xs text-muted-foreground">(corrected)</span>}
                      </span>
                      {topAlternative && (
                        <span className="text-xs text-muted-foreground">
                          Also considered: {topAlternative.label} ({Math.round(topAlternative.probability * 100)}%)
                        </span>
                      )}
                      {row.error && <span className="text-xs text-destructive">{row.error.message}</span>}
                    </div>
                  )}
                </TableCell>
                <TableCell>{isClassifying ? '—' : <ConfidenceLabel confidence={row.confidence} />}</TableCell>
                <TableCell>
                  {row.status === 'classifying' ? (
                    <span className="text-xs text-muted-foreground">Classifying</span>
                  ) : (
                    <ClassificationStatusBadge status={row.status} />
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
