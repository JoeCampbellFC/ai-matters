import { BookOpenCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { SelectedSkill } from '@/types/research'

/**
 * Surfaces which research playbook (skill) the agent picked and why --
 * the "what skill is being read" visibility the live progress UI needs.
 */
export function ResearchSkillCard({ skill }: { skill?: SelectedSkill }) {
  if (!skill) return null

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <BookOpenCheck className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Research playbook</span>
        <Badge variant="secondary">{skill.name}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{skill.description}</p>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Why: </span>
        {skill.rationale}
      </p>
    </div>
  )
}
