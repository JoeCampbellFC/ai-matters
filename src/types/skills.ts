/** Mirrors server/src/database/repositories/skillsRepository.ts's ResearchSkill row. */
export interface AdminSkill {
  id: string
  name: string
  description: string
  body: string
  isSystemDefault: boolean
  displayOrder: number
  version: number
  createdAt: string
  updatedAt: string
}
