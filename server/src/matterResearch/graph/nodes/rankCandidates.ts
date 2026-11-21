import { z } from 'zod'
import { getAzureChatModel } from '../../../llm/azureOpenAI.js'
import { incrementBudget } from '../../budget.js'
import { getSkill } from '../../skills.js'
import type { CandidateDocument } from '../../types.js'
import type { ResearchState, ResearchStateUpdate } from '../state.js'
import { emit, type NodeConfig } from './shared.js'

const RankingSchema = z.object({
  rankings: z.array(
    z.object({
      documentId: z.string(),
      relevanceScore: z.number().min(0).max(1),
      rationale: z.string().min(1),
    }),
  ),
})

/**
 * Scores verified candidates from metadata only (titles, folder context,
 * search evidence) -- documents are not fetched until after selection.
 * Relevance scores are heuristic, not calibrated probabilities.
 */
export async function rankCandidates(state: ResearchState, config: NodeConfig): Promise<ResearchStateUpdate> {
  const verified = Object.values(state.candidates).filter(
    (c) => c.verifiedBy && c.status !== 'excluded' && c.relevanceScore === undefined,
  )
  if (verified.length === 0) {
    return {}
  }

  emit(config, { type: 'activity', stage: 'ranking_candidates', message: 'Evaluating relevance…' })

  const listing = verified
    .map(
      (c) =>
        `id=${c.documentId} name=${c.name ?? 'unknown'} type=${c.docType ?? 'unknown'} ` +
        `author=${c.author ?? 'unknown'} date=${c.date ?? 'unknown'} description=${c.description ?? 'none'}`,
    )
    .join('\n')

  const skillBody = state.skill ? getSkill(state.skill.name)?.body : undefined

  const prompt = [
    'Assess how useful each candidate document is likely to be for understanding this iManage matter, using only',
    'the metadata below (the documents have not been read yet).',
    `Matter: ${state.workspace?.name ?? state.workspaceId}`,
    'Consider: relevance to the overall matter, likelihood of containing substantive facts, authoritativeness and',
    'finality, coverage of important activities, uniqueness versus other candidates, and currency/version status.',
    "Don't let recency alone dominate -- a final signed agreement from years ago may matter more than a routine",
    'recent email.',
    skillBody ? `Research playbook guidance for this matter type:\n${skillBody}` : undefined,
    'Candidates:',
    listing,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')

  const model = getAzureChatModel().withStructuredOutput(RankingSchema)
  const response = await model.invoke(prompt, { signal: config.signal })

  const candidates: Record<string, CandidateDocument> = {}
  for (const ranking of response.rankings) {
    if (!state.candidates[ranking.documentId]) continue
    candidates[ranking.documentId] = {
      ...state.candidates[ranking.documentId],
      relevanceScore: ranking.relevanceScore,
      selectionReason: ranking.rationale,
    }
  }

  emit(config, {
    type: 'activity',
    stage: 'ranking_candidates',
    message: `Assessed relevance for ${response.rankings.length} ${response.rankings.length === 1 ? 'document' : 'documents'}`,
  })

  return {
    candidates,
    budget: incrementBudget(state.budget, { llmCalls: 1 }),
  }
}
