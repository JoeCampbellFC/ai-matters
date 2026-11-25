import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createSkill, deleteSkill, fetchSkills, updateSkill } from '@/services/skillsApi'
import type { AdminSkill } from '@/types/skills'

export const SKILLS_QUERY_KEY = ['skills'] as const

export function useSkills() {
  return useQuery({ queryKey: SKILLS_QUERY_KEY, queryFn: fetchSkills })
}

export function useCreateSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createSkill,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SKILLS_QUERY_KEY }),
  })
}

export function useUpdateSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; description?: string; body?: string; expectedVersion: number }) =>
      updateSkill(input.id, { description: input.description, body: input.body, expectedVersion: input.expectedVersion }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SKILLS_QUERY_KEY }),
  })
}

export function useDeleteSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (skill: AdminSkill) => deleteSkill(skill.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SKILLS_QUERY_KEY }),
  })
}
