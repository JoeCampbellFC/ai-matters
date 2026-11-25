import { beforeEach, describe, expect, it, vi } from 'vitest'

const repoMocks = vi.hoisted(() => ({
  listFieldDefinitions: vi.fn(),
  getFieldDefinitionByKey: vi.fn(),
  getFieldDefinitionsByKeys: vi.fn(),
  getFieldDefinitionById: vi.fn(),
  createFieldDefinition: vi.fn(),
  updateFieldDefinitionWithConcurrencyCheck: vi.fn(),
  deleteFieldDefinition: vi.fn(),
  seedFieldDefinitions: vi.fn(),
}))
vi.mock('../database/repositories/fieldDefinitionRepository.js', () => repoMocks)

const { createCustomFieldDefinition, deleteFieldDefinition, listFieldDefinitionsForAdmin, updateFieldDefinition } = await import(
  './fieldDefinitionService.js'
)
const { FieldDefinitionNotFoundError, SystemDefaultImmutableError, ValidationError } = await import('../database/errors.js')

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'fd-1',
    fieldKey: 'referral_source',
    displayName: 'Referral Source',
    description: '',
    dataType: 'text',
    allowedValues: null,
    required: false,
    editable: true,
    systemField: false,
    displayOrder: 20,
    version: 1,
    ...overrides,
  }
}

beforeEach(() => {
  for (const mockFn of Object.values(repoMocks)) mockFn.mockReset()
})

describe('listFieldDefinitionsForAdmin', () => {
  it('flags the 16 AI-classified fields', async () => {
    repoMocks.listFieldDefinitions.mockResolvedValue([row(), row({ id: 'fd-2', fieldKey: 'matter_type' })])
    const result = await listFieldDefinitionsForAdmin()
    expect(result.find((r) => r.fieldKey === 'referral_source')?.isAiClassified).toBe(false)
    expect(result.find((r) => r.fieldKey === 'matter_type')?.isAiClassified).toBe(true)
  })
})

describe('createCustomFieldDefinition', () => {
  it('rejects a reserved (AI-classified) field key', async () => {
    await expect(
      createCustomFieldDefinition({ fieldKey: 'matter_type', displayName: 'x', dataType: 'text' }),
    ).rejects.toThrow(ValidationError)
    expect(repoMocks.createFieldDefinition).not.toHaveBeenCalled()
  })

  it('rejects a field key already in use', async () => {
    repoMocks.getFieldDefinitionByKey.mockResolvedValue(row())
    await expect(
      createCustomFieldDefinition({ fieldKey: 'referral_source', displayName: 'x', dataType: 'text' }),
    ).rejects.toThrow(ValidationError)
  })

  it('requires allowed values for a single_select field', async () => {
    repoMocks.getFieldDefinitionByKey.mockResolvedValue(undefined)
    await expect(
      createCustomFieldDefinition({ fieldKey: 'referral_source', displayName: 'x', dataType: 'single_select' }),
    ).rejects.toThrow(ValidationError)
  })

  it('creates a well-formed custom field', async () => {
    repoMocks.getFieldDefinitionByKey.mockResolvedValue(undefined)
    repoMocks.createFieldDefinition.mockResolvedValue(row())
    const result = await createCustomFieldDefinition({ fieldKey: 'referral_source', displayName: 'Referral Source', dataType: 'text' })
    expect(result.fieldKey).toBe('referral_source')
    expect(result.isAiClassified).toBe(false)
  })
})

describe('updateFieldDefinition', () => {
  it('throws FieldDefinitionNotFoundError for an unknown id', async () => {
    repoMocks.getFieldDefinitionById.mockResolvedValue(undefined)
    await expect(updateFieldDefinition('missing', { expectedVersion: 1 })).rejects.toThrow(FieldDefinitionNotFoundError)
  })

  it('allows editing a system field', async () => {
    repoMocks.getFieldDefinitionById.mockResolvedValue(row({ systemField: true }))
    repoMocks.updateFieldDefinitionWithConcurrencyCheck.mockResolvedValue(row({ systemField: true, displayName: 'New Label' }))
    const result = await updateFieldDefinition('fd-1', { displayName: 'New Label', expectedVersion: 1 })
    expect(result.displayName).toBe('New Label')
  })
})

describe('deleteFieldDefinition', () => {
  it('throws SystemDefaultImmutableError for a system field', async () => {
    repoMocks.getFieldDefinitionById.mockResolvedValue(row({ systemField: true }))
    await expect(deleteFieldDefinition('fd-1')).rejects.toThrow(SystemDefaultImmutableError)
    expect(repoMocks.deleteFieldDefinition).not.toHaveBeenCalled()
  })

  it('deletes a custom field', async () => {
    repoMocks.getFieldDefinitionById.mockResolvedValue(row({ systemField: false }))
    await deleteFieldDefinition('fd-1')
    expect(repoMocks.deleteFieldDefinition).toHaveBeenCalledWith('fd-1')
  })
})
