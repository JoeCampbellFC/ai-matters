import { z } from 'zod'
import { getAzureChatModel } from '../../../llm/azureOpenAI.js'
import { incrementBudget } from '../../budget.js'
import { getFallbackSkill, getSkill, listSkillSummaries } from '../../skills.js'
import type { SelectedSkill } from '../../types.js'
import type { ResearchState, ResearchStateUpdate } from '../state.js'
import { emit, emitStage, type NodeConfig } from './shared.js'

const SearchPlanSchema = z.object({
  searches: z
    .array(z.object({ query: z.string().min(1), rationale: z.string().min(1) }))
    .min(1)
    .max(6),
})

const SkillSelectionSchema = z.object({
  skillName: z.string(),
  rationale: z.string().min(1),
})

/**
 * One-time (per run) skill selection: shows the model only the cheap
 * name/description catalog (stage-1 disclosure), has it pick the best-fit
 * research playbook, then resolves the full body separately so later prompts
 * (here and in rankCandidates/writeMarkdown) can use it. Costs exactly one
 * extra LLM call per run, not per refine pass.
 */
async function selectSkill(state: ResearchState, config: NodeConfig): Promise<SelectedSkill> {
  const summaries = await listSkillSummaries()
  const prompt = [
    "Choose the research playbook that best matches this matter, based on its name and description only -- you haven't read any documents yet.",
    `Matter: ${state.workspace?.name ?? state.workspaceId}`,
    state.workspace?.client ? `Client: ${state.workspace.client}` : undefined,
    state.workspace?.matter ? `Matter description: ${state.workspace.matter}` : undefined,
    'Available playbooks:',
    ...summaries.map((summary) => `- ${summary.name}: ${summary.description}`),
    'If nothing fits clearly, choose "general-matter-research".',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')

  const model = getAzureChatModel().withStructuredOutput(SkillSelectionSchema)
  const response = await model.invoke(prompt, { signal: config.signal })
  const matched = (await getSkill(response.skillName)) ?? (await getFallbackSkill())
  return { name: matched.name, description: matched.description, rationale: response.rationale }
}

export async function planSearches(state: ResearchState, config: NodeConfig): Promise<ResearchStateUpdate> {
  const isRefinement = state.coverage !== undefined
  const iteration = isRefinement ? state.budget.iterationCount + 1 : state.budget.iterationCount

  emitStage(config, state, 'planning_searches', iteration)
  emit(config, {
    type: 'activity',
    stage: 'planning_searches',
    message: isRefinement
      ? `Planning additional searches to close evidence gaps (pass ${iteration + 1})…`
      : 'Planning document searches…',
  })

  let skillLlmCalls = 0
  let skill = state.skill
  if (!skill) {
    skill = await selectSkill(state, config)
    skillLlmCalls = 1
    emit(config, {
      type: 'skill_selected',
      skillName: skill.name,
      description: skill.description,
      rationale: skill.rationale,
    })
    emit(config, {
      type: 'activity',
      stage: 'planning_searches',
      message: `Using the "${skill.name}" research playbook`,
    })
  }
  const skillBody = (await getSkill(skill.name))?.body

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

  const queryStyle =
    'Phrase each query the way you would ask a librarian to locate an item: describe the ' +
    'document or email you need -- its type, parties, and any identifying detail (status, date, ' +
    'subject) -- not a list of keywords, and not the information you want to extract from it. ' +
    'For example, write "the executed share purchase agreement between Acme Corp and Globex, ' +
    'including signed copies and amendments" or "emails between outside counsel and the deal team ' +
    'about the settlement agreement in March 2026", not "share purchase agreement" and not ' +
    '"what are the termination terms of the agreement".'

  const prompt = [
    'You are planning document searches for an iManage Work matter-research agent.',
    `Matter: ${state.workspace?.name ?? state.workspaceId}`,
    state.workspace?.client ? `Client: ${state.workspace.client}` : undefined,
    state.workspace?.matter ? `Matter description: ${state.workspace.matter}` : undefined,
    skillBody ? `Research playbook guidance for this matter type:\n${skillBody}` : undefined,
    ...instructions,
    queryStyle,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')

  const model = getAzureChatModel().withStructuredOutput(SearchPlanSchema)
  const response = await model.invoke(prompt, { signal: config.signal })

  for (const plan of response.searches) {
    emit(config, { type: 'search_planned', query: plan.query, rationale: plan.rationale, iteration })
  }
  emit(config, {
    type: 'activity',
    stage: 'planning_searches',
    message: `Created ${response.searches.length} research ${response.searches.length === 1 ? 'query' : 'queries'}`,
  })

  return {
    skill,
    searchPlans: response.searches.map((plan) => ({ ...plan, iteration })),
    budget: incrementBudget(state.budget, { llmCalls: 1 + skillLlmCalls, iterationCount: isRefinement ? 1 : 0 }),
  }
}
