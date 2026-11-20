import { z } from 'zod'
import { getAzureChatModel } from '../../../llm/azureOpenAI.js'
import { incrementBudget } from '../../budget.js'
import type { ResearchState, ResearchStateUpdate } from '../state.js'
import { emit, type NodeConfig } from './shared.js'

/**
 * The narrative sections of the Matter Knowledge File. Sections 13
 * (document register), 14 (source references) and 16 (research coverage
 * stats) are deliberately not here -- they're assembled deterministically
 * from structured data in finalize.ts, not LLM-authored, since they're what
 * a reader would most want to fact-check.
 */
export const SECTION_DEFINITIONS: Array<{ heading: string; guidance: string }> = [
  { heading: '1. Matter Overview', guidance: 'A comprehensive explanation of the matter: its purpose, background, nature and context.' },
  {
    heading: '2. Client and Parties',
    guidance: 'Identify the client, counterparties and other relevant organisations or people, and their roles and relationships. Distinguish confirmed facts from uncertainty.',
  },
  {
    heading: '3. Matter Scope and Objectives',
    guidance: 'Explain what the legal team was engaged to do: principal issues, legal services, commercial objectives and overall scope.',
  },
  {
    heading: '4. Legal and Commercial Context',
    guidance: 'Relevant legal, regulatory or commercial background; jurisdictions, industries and practice areas where supported by evidence.',
  },
  {
    heading: '5. Key Activities and Work Performed',
    guidance: 'A detailed account of the work, organised by meaningful workstreams or phases, explaining the significance of each activity.',
  },
  {
    heading: '6. Timeline and Important Events',
    guidance: 'A chronological account of the matter with dates, milestones and evidence references. Distinguish document dates from actual event dates.',
  },
  {
    heading: '7. Important Agreements and Deliverables',
    guidance: 'The most significant documents produced or reviewed: what each document does and why it matters.',
  },
  {
    heading: '8. Key Legal Issues and Considerations',
    guidance: 'Substantive legal issues identified in the source documents. Differentiate legal advice, allegations, proposals, decisions and final agreed positions.',
  },
  {
    heading: '9. Outcomes and Current Position',
    guidance: 'What was achieved or resolved, and what is still outstanding. Do not treat proposed outcomes as completed outcomes.',
  },
  {
    heading: '10. People, Teams and Responsibilities',
    guidance: 'Identified people, roles and responsibilities. Include only information supported by sources.',
  },
  {
    heading: '11. Knowledge and Expertise Demonstrated',
    guidance: 'The substantive work reflected in the matter and specialist legal capabilities where evident. Avoid unsupported promotional claims.',
  },
  {
    heading: '12. Workspace Knowledge Map',
    guidance: 'How the workspace is organised: significant folders and where different types of information can be found.',
  },
  {
    heading: '15. Information Gaps and Uncertainties',
    guidance: 'Missing documents, unresolved questions, conflicting statements and incomplete evidence, and how these limitations affect the summary.',
  },
  {
    heading: '17. Guidance for Future AI Agents',
    guidance: 'How another AI agent should use this file: authoritative sources, relevant folders/search terms, and which claims require further verification.',
  },
]

const OutlineSchema = z.object({
  sections: z.array(
    z.object({
      heading: z.string(),
      topics: z.array(z.string()),
      evidenceIds: z.array(z.string()),
    }),
  ),
})

export async function buildOutline(state: ResearchState, config: NodeConfig): Promise<ResearchStateUpdate> {
  emit(config, { type: 'activity', stage: 'synthesizing', message: 'Writing matter summary…' })

  const evidenceListing = state.evidence
    .map((item) => `[${item.id}] (doc=${item.documentId}, topic=${item.topic}) ${item.claim}`)
    .join('\n')

  const prompt = [
    `Matter: ${state.workspace?.name ?? state.workspaceId}`,
    'Assign the evidence below to whichever of the following report sections it best supports (an evidence item',
    'may support more than one section). For each section, also suggest 1-4 specific topics it should cover given',
    "what's actually available. A section with no supporting evidence should still appear, with an empty",
    'evidenceIds list -- do not force an assignment that is not justified.',
    'Sections:',
    ...SECTION_DEFINITIONS.map((s) => `- ${s.heading}: ${s.guidance}`),
    'Evidence:',
    evidenceListing || '(no evidence gathered)',
  ].join('\n')

  const model = getAzureChatModel().withStructuredOutput(OutlineSchema)
  const response = await model.invoke(prompt, { signal: config.signal })

  return {
    outline: response.sections,
    budget: incrementBudget(state.budget, { llmCalls: 1 }),
  }
}
