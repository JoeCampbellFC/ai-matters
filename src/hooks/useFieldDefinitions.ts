import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type CreateFieldDefinitionInput,
  type UpdateFieldDefinitionInput,
  createFieldDefinition,
  deleteFieldDefinition,
  fetchFieldDefinitions,
  updateFieldDefinition,
} from '@/services/fieldDefinitionsApi'
import type { FieldDefinition } from '@/types/fieldDefinitions'

export const FIELD_DEFINITIONS_QUERY_KEY = ['field-definitions'] as const

export function useFieldDefinitions() {
  return useQuery({ queryKey: FIELD_DEFINITIONS_QUERY_KEY, queryFn: fetchFieldDefinitions })
}

export function useCreateFieldDefinition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateFieldDefinitionInput) => createFieldDefinition(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FIELD_DEFINITIONS_QUERY_KEY }),
  })
}

export function useUpdateFieldDefinition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string } & UpdateFieldDefinitionInput) => updateFieldDefinition(input.id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FIELD_DEFINITIONS_QUERY_KEY }),
  })
}

export function useDeleteFieldDefinition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (fieldDefinition: FieldDefinition) => deleteFieldDefinition(fieldDefinition.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FIELD_DEFINITIONS_QUERY_KEY }),
  })
}
