import { apiRequest } from './api'
import type { FieldDefinition } from '@/types/fieldDefinitions'
import type { MatterFieldDataType } from '@/types/matterProfile'

export async function fetchFieldDefinitions(): Promise<FieldDefinition[]> {
  const result = await apiRequest<{ fieldDefinitions: FieldDefinition[] }>('/field-definitions')
  return result.fieldDefinitions
}

export interface CreateFieldDefinitionInput {
  fieldKey: string
  displayName: string
  description?: string
  dataType: MatterFieldDataType
  allowedValues?: Array<{ id: string; label: string }> | null
  required?: boolean
  editable?: boolean
  displayOrder?: number
}

export async function createFieldDefinition(input: CreateFieldDefinitionInput): Promise<FieldDefinition> {
  const result = await apiRequest<{ fieldDefinition: FieldDefinition }>('/field-definitions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return result.fieldDefinition
}

export interface UpdateFieldDefinitionInput {
  displayName?: string
  description?: string
  allowedValues?: Array<{ id: string; label: string }> | null
  required?: boolean
  editable?: boolean
  displayOrder?: number
  expectedVersion: number
}

export async function updateFieldDefinition(id: string, input: UpdateFieldDefinitionInput): Promise<FieldDefinition> {
  const result = await apiRequest<{ fieldDefinition: FieldDefinition }>(`/field-definitions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return result.fieldDefinition
}

export async function deleteFieldDefinition(id: string): Promise<void> {
  await apiRequest<void>(`/field-definitions/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
