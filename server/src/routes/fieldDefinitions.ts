import { Router } from 'express'
import { listFieldDefinitions } from '../database/repositories/fieldDefinitionRepository.js'

export const fieldDefinitionsRouter = Router()

fieldDefinitionsRouter.get('/', async (_req, res, next) => {
  try {
    const definitions = await listFieldDefinitions()
    res.json({ fieldDefinitions: definitions })
  } catch (error) {
    next(error)
  }
})
