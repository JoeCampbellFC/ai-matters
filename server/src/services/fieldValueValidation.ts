import { z } from 'zod'
import type { MatterFieldDefinition } from '../database/repositories/fieldDefinitionRepository.js'

/** Validates a raw client-supplied value against a field definition's data_type before it's ever written to matter_field_values.value (jsonb). */
export function validateFieldValue(field: MatterFieldDefinition, raw: unknown): unknown {
  switch (field.dataType) {
    case 'text':
      return z.string().max(500).parse(raw)
    case 'multiline_text':
      return z.string().max(20_000).parse(raw)
    case 'number':
      return z.number().finite().parse(raw)
    case 'decimal':
      return z.number().finite().parse(raw)
    case 'boolean':
      return z.boolean().parse(raw)
    case 'date':
      return z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date (YYYY-MM-DD).')
        .parse(raw)
    case 'single_select': {
      const valueId = z.string().min(1).parse(raw)
      const allowed = field.allowedValues ?? []
      const option = allowed.find((o) => o.id === valueId)
      if (!option) throw new z.ZodError([{ code: 'custom', message: `"${valueId}" is not a valid option for ${field.displayName}.`, path: [] }])
      return { valueId: option.id, label: option.label }
    }
    case 'multi_select': {
      const valueIds = z.array(z.string().min(1)).parse(raw)
      const allowed = field.allowedValues ?? []
      const options = valueIds.map((id) => {
        const option = allowed.find((o) => o.id === id)
        if (!option) throw new z.ZodError([{ code: 'custom', message: `"${id}" is not a valid option for ${field.displayName}.`, path: [] }])
        return option
      })
      return options
    }
    default:
      return raw
  }
}
