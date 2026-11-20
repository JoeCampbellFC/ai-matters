import { z } from 'zod'
import { getAzureChatModel } from '../../../llm/azureOpenAI.js'
import { incrementBudget } from '../../budget.js'
import type { ResearchState, ResearchStateUpdate } from '../state.js'
import { emit, type NodeConfig } from './shared.js'

const COVERAGE_TOPICS = [
  'matter overview and purpose',
  'client and counterparties',
  'scope of engagement',
  'key agreements and deliverables',
  'important dates and milestones',
  'current status and outcome',
]

const CoverageSchema = z.object({
  coveredTopics: z.array(z.string()),
  gaps: z.array(
    z.object({
      topic: z.string().min(1),
      reason: z.string().min(1),
      suggestedQueries: z.array(z.string()).optional(),
    }),
  ),
})

/**
 * Compares accumulated evidence against a fixed matter-knowledge topic
 * checklist. A topic with no supporting evidence is a gap to report, never
 * something to assume or fill in with invented information.
 */
export async function assessCoverage(state: ResearchState, config: NodeConfig): Promise<ResearchStateUpdate> {
  emit(config, { type: 'activity', stage: 'assessing_coverage', message: 'Checking research coverage…' })

  const evidenceSummary = state.evidence
    .map((item) => `[${item.id}] (${item.topic}, ${item.confidence}) ${item.claim}`)
    .join('\n')

  const prompt = [
    `Matter: ${state.workspace?.name ?? state.workspaceId}`,
    'Checklist of topics a complete matter summary should cover:',
    ...COVERAGE_TOPICS.map((topic) => `- ${topic}`),
    'Evidence gathered so far:',
    evidenceSummary || '(no evidence gathered yet)',
    'For each checklist topic, decide whether the evidence adequately covers it. List covered topics, and for any',
    'gap explain why and (if useful) suggest 1-3 specific follow-up search queries. A topic with no supporting',
    'evidence is a gap -- do not assume it is covered.',
  ].join('\n')

  const model = getAzureChatModel().withStructuredOutput(CoverageSchema)
  const response = await model.invoke(prompt, { signal: config.signal })

  emit(config, {
    type: 'coverage_assessed',
    coveredTopics: response.coveredTopics,
    gaps: response.gaps,
    iteration: state.budget.iterationCount,
  })
  emit(config, {
    type: 'activity',
    stage: 'assessing_coverage',
    message:
      response.gaps.length > 0
        ? `Identified ${response.gaps.length} missing ${response.gaps.length === 1 ? 'area' : 'areas'}`
        : 'Coverage looks complete',
  })

  return {
    coverage: { coveredTopics: response.coveredTopics, gaps: response.gaps },
    budget: incrementBudget(state.budget, { llmCalls: 1 }),
  }
}
