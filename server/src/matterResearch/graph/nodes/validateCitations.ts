import { z } from 'zod'
import { getAzureChatModel } from '../../../llm/azureOpenAI.js'
import { stripUnknownCitations, validateCitations } from '../../synthesis.js'
import { incrementBudget } from '../../budget.js'
import type { ResearchState, ResearchStateUpdate } from '../state.js'
import { emit, type NodeConfig } from './shared.js'

const MAX_REPAIR_ATTEMPTS = 2

const RepairSchema = z.object({ markdown: z.string() })

/**
 * Never trusts the LLM's self-report of correct citations: runs the
 * deterministic regex-based check first, attempts a bounded LLM repair only
 * for unknown markers, and falls back to a deterministic [uncited] strip if
 * repair still leaves something invalid -- this node never fails the run
 * over citation formatting.
 */
export async function validateCitationsNode(state: ResearchState, config: NodeConfig): Promise<ResearchStateUpdate> {
  let markdown = state.sectionMarkdown.join('\n')
  let llmCalls = 0

  for (let attempt = 0; attempt < MAX_REPAIR_ATTEMPTS; attempt += 1) {
    const result = validateCitations(markdown, state.citationRegistry)
    if (result.valid) break

    emit(config, {
      type: 'activity',
      stage: 'synthesizing',
      message: `Repairing ${result.unknownMarkers.length} unrecognized citation ${result.unknownMarkers.length === 1 ? 'marker' : 'markers'}…`,
    })

    const prompt = [
      'The Markdown below cites document markers that do not exist in the citation registry:',
      result.unknownMarkers.join(', '),
      'Valid markers are:',
      state.citationRegistry.map((entry) => entry.marker).join(', ') || '(none)',
      'Rewrite the Markdown, replacing or removing each invalid marker so every citation refers to a valid one.',
      'Do not change anything else about the content.',
      '---',
      markdown,
    ].join('\n')

    const model = getAzureChatModel().withStructuredOutput(RepairSchema)
    const response = await model.invoke(prompt, { signal: config.signal })
    llmCalls += 1
    markdown = response.markdown
  }

  const finalCheck = validateCitations(markdown, state.citationRegistry)
  if (!finalCheck.valid) {
    markdown = stripUnknownCitations(markdown, finalCheck.unknownMarkers)
  }

  emit(config, { type: 'activity', stage: 'synthesizing', message: 'Validated citations' })

  return {
    markdown,
    budget: incrementBudget(state.budget, { llmCalls }),
  }
}
