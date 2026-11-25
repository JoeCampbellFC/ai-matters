import { Router } from 'express'
import { z } from 'zod'
import {
  createCustomFieldDefinition,
  deleteFieldDefinition,
  listFieldDefinitionsForAdmin,
  updateFieldDefinition,
} from '../services/fieldDefinitionService.js'

export const fieldDefinitionsRouter = Router()

fieldDefinitionsRouter.get('/', async (_req, res, next) => {
  try {
    res.json({ fieldDefinitions: await listFieldDefinitionsForAdmin() })
  } catch (error) {
    next(error)
  }
})

const DataTypeSchema = z.enum(['text', 'multiline_text', 'number', 'decimal', 'date', 'boolean', 'single_select', 'multi_select'])
const AllowedValuesSchema = z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).nullable()

const CreateFieldDefinitionSchema = z.object({
  fieldKey: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, 'Field key must be lowercase letters, numbers, and underscores only (e.g. "referral_source").'),
  displayName: z.string().min(1),
  description: z.string().optional(),
  dataType: DataTypeSchema,
  allowedValues: AllowedValuesSchema.optional(),
  required: z.boolean().optional(),
  editable: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
})

fieldDefinitionsRouter.post('/', async (req, res, next) => {
  try {
    const body = CreateFieldDefinitionSchema.parse(req.body)
    const fieldDefinition = await createCustomFieldDefinition(body)
    res.status(201).json({ fieldDefinition })
  } catch (error) {
    next(error)
  }
})

const UpdateFieldDefinitionSchema = z.object({
  displayName: z.string().min(1).optional(),
  description: z.string().optional(),
  allowedValues: AllowedValuesSchema.optional(),
  required: z.boolean().optional(),
  editable: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
  expectedVersion: z.number().int().min(0),
})

fieldDefinitionsRouter.patch('/:id', async (req, res, next) => {
  try {
    const body = UpdateFieldDefinitionSchema.parse(req.body)
    const fieldDefinition = await updateFieldDefinition(req.params.id!, body)
    res.json({ fieldDefinition })
  } catch (error) {
    next(error)
  }
})

fieldDefinitionsRouter.delete('/:id', async (req, res, next) => {
  try {
    await deleteFieldDefinition(req.params.id!)
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})
