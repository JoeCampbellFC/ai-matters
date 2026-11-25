import { Router } from 'express'
import { z } from 'zod'
import { createCustomSkill, deleteSkill, listSkillsForAdmin, updateSkill } from '../services/skillsService.js'

export const skillsRouter = Router()

skillsRouter.get('/', async (_req, res, next) => {
  try {
    res.json({ skills: await listSkillsForAdmin() })
  } catch (error) {
    next(error)
  }
})

const CreateSkillSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9-]*$/, 'Playbook name must be lowercase letters, numbers, and hyphens only (e.g. "real-estate-matter-research").'),
  description: z.string().min(1),
  body: z.string().min(1),
})

skillsRouter.post('/', async (req, res, next) => {
  try {
    const body = CreateSkillSchema.parse(req.body)
    const skill = await createCustomSkill(body)
    res.status(201).json({ skill })
  } catch (error) {
    next(error)
  }
})

const UpdateSkillSchema = z.object({
  description: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  expectedVersion: z.number().int().min(0),
})

skillsRouter.patch('/:id', async (req, res, next) => {
  try {
    const body = UpdateSkillSchema.parse(req.body)
    const skill = await updateSkill(req.params.id!, body)
    res.json({ skill })
  } catch (error) {
    next(error)
  }
})

skillsRouter.delete('/:id', async (req, res, next) => {
  try {
    await deleteSkill(req.params.id!)
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})
