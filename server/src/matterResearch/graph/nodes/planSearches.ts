import { z } from 'zod'
import { getAzureChatModel } from '../../../llm/azureOpenAI.js'
import { incrementBudget } from '../../budget.js'
import type { ResearchState, ResearchStateUpdate } from '../state.js'
import { emit, type NodeConfig } from './shared.js'

const SearchPlanSchema = z.object({
  searches: z
    .array(z.object({ query: z.string().min(1), rationale: z.string().min(1) }))
    .min(1)
    .max(6),
})

export async function planSearches(state: ResearchState, config: NodeConfig): Promise<ResearchStateUpdate> {
  emit(config, { type: 'activity', stage: 'planning_searches', message: 'Planning document searches…' })

  const isRefinement = state.coverage !== undefined
  const iteration = isRefinement ? state.budget.iterationCount + 1 : state.budget.iterationCount

  const instructions = isRefinement
    ? [
        'Previous research left these evidence gaps:',
        ...(state.coverage?.gaps.map((gap) => `- ${gap.topic}: ${gap.reason}`) ?? []),
        'Propose 2-4 targeted searches to close these specific gaps.',
      ]
    : [
        "Propose 3-6 focused searches likely to surface this matter's most important documents " +
          '(for example: engagement letters, key agreements, principal correspondence, due diligence, ' +
          'closing/completion documents, status reports -- adapt these examples to what the matter appears ' +
          'to actually be about). Prefer several focused queries over one broad one.',
      ]

  const prompt = [
    'You are planning document searches for an iManage Work matter-research agent.',
    `Matter: ${state.workspace?.name ?? state.workspaceId}`,
    state.workspace?.client ? `Client: ${state.workspace.client}` : undefined,
    state.workspace?.matter ? `Matter description: ${state.workspace.matter}` : undefined,
    ...instructions,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')

  const model = getAzureChatModel().withStructuredOutput(SearchPlanSchema)
  const response = await model.invoke(prompt, { signal: config.signal })

  emit(config, {
    type: 'activity',
    stage: 'planning_searches',
    message: `Created ${response.searches.length} research ${response.searches.length === 1 ? 'query' : 'queries'}`,
  })

  return {
    searchPlans: response.searches.map((plan) => ({ ...plan, iteration })),
    budget: incrementBudget(state.budget, { llmCalls: 1, iterationCount: isRefinement ? 1 : 0 }),
  }
}
