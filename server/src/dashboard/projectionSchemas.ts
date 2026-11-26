import { z } from 'zod'

/** Markers into the matter's citation registry (e.g. "D02") -- resolved to real document ids client-side, never guessed. */
const SourceRefsSchema = z.array(z.string())

export const TimelineEventSchema = z.object({
  id: z.string().min(1),
  date: z.string().nullable(),
  title: z.string().min(1),
  description: z.string(),
  status: z.enum(['completed', 'planned', 'expected', 'unknown']),
  sourceRefs: SourceRefsSchema,
})
export type TimelineEvent = z.infer<typeof TimelineEventSchema>

export const MatterPartySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  organisation: z.string().nullable(),
  description: z.string().nullable(),
  sourceRefs: SourceRefsSchema,
})
export type MatterParty = z.infer<typeof MatterPartySchema>

export const MatterIssueSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  status: z.string().nullable(),
  sourceRefs: SourceRefsSchema,
})
export type MatterIssue = z.infer<typeof MatterIssueSchema>

export const OutcomeItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  kind: z.enum(['outcome', 'next_step', 'uncertainty']),
  dueDate: z.string().nullable(),
  sourceRefs: SourceRefsSchema,
})
export type OutcomeItem = z.infer<typeof OutcomeItemSchema>

export const CustomItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  sourceRefs: SourceRefsSchema,
})
export type CustomItem = z.infer<typeof CustomItemSchema>

/**
 * What the LLM itself is asked to produce -- deliberately flat (no
 * discriminated union / oneOf), matching every other structured-output
 * schema already used against this Azure deployment (planSearches.ts's
 * SearchPlanSchema, readAndExtract.ts's EvidenceSchema, etc.): every
 * property is required, optionality is expressed as an empty array or a
 * nullable object, never `.optional()`.
 */
export const ProjectionExtractionSchema = z.object({
  overview: z
    .object({
      summary: z.string().min(1),
      sourceRefs: SourceRefsSchema,
    })
    .nullable(),
  timelineEvents: z.array(TimelineEventSchema),
  parties: z.array(MatterPartySchema),
  issues: z.array(MatterIssueSchema),
  outcomeItems: z.array(OutcomeItemSchema),
  customItems: z.array(CustomItemSchema),
})
export type ProjectionExtraction = z.infer<typeof ProjectionExtractionSchema>

const WidgetBaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  order: z.number().int(),
})

/**
 * The assembled, storage/frontend-facing shape -- built in code from
 * ProjectionExtraction (see dashboardProjectionService.ts), never sent
 * directly to the LLM. A discriminated union here is safe: it's validated
 * with zod on our own side, not asked of the model.
 */
export const DashboardWidgetSchema = z.discriminatedUnion('type', [
  WidgetBaseSchema.extend({ type: z.literal('overview'), summary: z.string().min(1), sourceRefs: SourceRefsSchema }),
  WidgetBaseSchema.extend({ type: z.literal('timeline'), events: z.array(TimelineEventSchema) }),
  WidgetBaseSchema.extend({ type: z.literal('parties'), parties: z.array(MatterPartySchema) }),
  WidgetBaseSchema.extend({ type: z.literal('issues'), issues: z.array(MatterIssueSchema) }),
  WidgetBaseSchema.extend({ type: z.literal('outcomes'), items: z.array(OutcomeItemSchema) }),
  WidgetBaseSchema.extend({ type: z.literal('custom'), items: z.array(CustomItemSchema) }),
])
export type DashboardWidget = z.infer<typeof DashboardWidgetSchema>

export const MatterDashboardProjectionSchema = z.object({
  schemaVersion: z.string().min(1),
  widgets: z.array(DashboardWidgetSchema),
  generatedAt: z.string(),
})
export type MatterDashboardProjectionData = z.infer<typeof MatterDashboardProjectionSchema>
