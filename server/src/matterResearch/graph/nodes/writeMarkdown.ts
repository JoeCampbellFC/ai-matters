import { getAzureChatModel } from '../../../llm/azureOpenAI.js'
import { buildCitationRegistry } from '../../synthesis.js'
import { incrementBudget } from '../../budget.js'
import { getSkill } from '../../skills.js'
import type { ResearchState, ResearchStateUpdate } from '../state.js'
import { emit, emitStage, type NodeConfig } from './shared.js'

/**
 * Writes one LLM call per outline section (never one giant summarisation
 * call) so each section's prompt stays small and attributable. The citation
 * registry is assigned once here, before any section is written, and shared
 * by every section so the same document always gets the same marker.
 */
export async function writeMarkdown(state: ResearchState, config: NodeConfig): Promise<ResearchStateUpdate> {
  emitStage(config, state, 'synthesizing')
  emit(config, { type: 'activity', stage: 'synthesizing', message: 'Drafting report sections…' })

  const reviewedDocs = state.selectedDocumentIds
    .map((id) => state.candidates[id])
    .filter((doc) => doc?.status === 'reviewed')
  const citationRegistry =
    state.citationRegistry.length > 0 ? state.citationRegistry : buildCitationRegistry(reviewedDocs)
  const markerByDocumentId = new Map(citationRegistry.map((entry) => [entry.documentId, entry.marker]))

  const outline = state.outline ?? []
  const model = getAzureChatModel()
  const sectionMarkdown: string[] = []
  let llmCalls = 0

  const skillBody = state.skill ? getSkill(state.skill.name)?.body : undefined

  for (const section of outline) {
    const sectionEvidence = state.evidence.filter((item) => section.evidenceIds.includes(item.id))
    const evidenceListing = sectionEvidence
      .map((item) => {
        const marker = markerByDocumentId.get(item.documentId) ?? 'uncited'
        return `[${marker}] ${item.claim}${item.quote ? ` ("${item.quote}")` : ''}`
      })
      .join('\n')

    const prompt = [
      `Write the "${section.heading}" section of a Matter Knowledge File for an iManage matter.`,
      `Suggested topics to cover: ${section.topics.join(', ') || '(use your judgement based on the evidence below)'}`,
      skillBody ? `Research playbook guidance for this matter type:\n${skillBody}` : undefined,
      'Evidence available for this section (already attributed to a citation marker):',
      evidenceListing || '(no directly supporting evidence was found for this section)',
      'Write clear, substantive Markdown prose (paragraphs and, where useful, lists or tables). Cite every',
      'material factual statement with its [Dxx] marker exactly as given above. If there is no evidence, say so',
      'plainly rather than inventing content. Do not repeat the section heading in your response.',
    ]
      .filter((line): line is string => Boolean(line))
      .join('\n')

    const response = await model.invoke(prompt, { signal: config.signal })
    llmCalls += 1
    const body = typeof response.content === 'string' ? response.content : String(response.content)
    sectionMarkdown.push(`## ${section.heading}\n\n${body.trim()}\n`)
  }

  emit(config, { type: 'activity', stage: 'synthesizing', message: `Drafted ${outline.length} report sections` })

  return {
    citationRegistry,
    sectionMarkdown,
    budget: incrementBudget(state.budget, { llmCalls }),
  }
}
