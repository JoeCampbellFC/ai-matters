import type { CitationRegistryEntry } from './research'

/** Mirrors server/src/dashboard/projectionSchemas.ts's extraction item shapes. */

export interface TimelineEvent {
  id: string
  date: string | null
  title: string
  description: string
  status: 'completed' | 'planned' | 'expected' | 'unknown'
  sourceRefs: string[]
}

export interface MatterParty {
  id: string
  name: string
  role: string
  organisation: string | null
  description: string | null
  sourceRefs: string[]
}

export interface MatterIssue {
  id: string
  title: string
  description: string
  status: string | null
  sourceRefs: string[]
}

export interface OutcomeItem {
  id: string
  title: string
  description: string
  kind: 'outcome' | 'next_step' | 'uncertainty'
  dueDate: string | null
  sourceRefs: string[]
}

export interface CustomItem {
  id: string
  title: string
  description: string
  sourceRefs: string[]
}

interface WidgetBase {
  id: string
  title: string
  order: number
}

export type DashboardWidget =
  | (WidgetBase & { type: 'overview'; summary: string; sourceRefs: string[] })
  | (WidgetBase & { type: 'timeline'; events: TimelineEvent[] })
  | (WidgetBase & { type: 'parties'; parties: MatterParty[] })
  | (WidgetBase & { type: 'issues'; issues: MatterIssue[] })
  | (WidgetBase & { type: 'outcomes'; items: OutcomeItem[] })
  | (WidgetBase & { type: 'custom'; items: CustomItem[] })

export interface MatterDashboardProjection {
  schemaVersion: string
  widgets: DashboardWidget[]
  generatedAt: string
}

/** GET /api/matters/:workspaceId/dashboard and POST .../dashboard/generate share this response shape. */
export interface MatterDashboardResponse {
  generated: boolean
  projection?: MatterDashboardProjection
  markdownVersionId: string
  citationRegistry: CitationRegistryEntry[]
  wasCached?: boolean
}
