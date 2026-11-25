import { apiRequest } from './api'
import type { AdminSkill } from '@/types/skills'

export async function fetchSkills(): Promise<AdminSkill[]> {
  const result = await apiRequest<{ skills: AdminSkill[] }>('/skills')
  return result.skills
}

export async function createSkill(input: { name: string; description: string; body: string }): Promise<AdminSkill> {
  const result = await apiRequest<{ skill: AdminSkill }>('/skills', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return result.skill
}

export async function updateSkill(
  id: string,
  input: { description?: string; body?: string; expectedVersion: number },
): Promise<AdminSkill> {
  const result = await apiRequest<{ skill: AdminSkill }>(`/skills/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return result.skill
}

export async function deleteSkill(id: string): Promise<void> {
  await apiRequest<void>(`/skills/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
