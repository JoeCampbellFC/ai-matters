import { z } from 'zod'
import { FETCH_TOOL, buildFetchArgs } from '../../../mcp/tools.js'
import { mapToolResultToFetchedDocument } from '../../../mcp/matterMapper.js'
import { getAzureChatModel } from '../../../llm/azureOpenAI.js'
import { incrementBudget } from '../../budget.js'
import type { CandidateDocument, EvidenceItem } from '../../types.js'
import type { ResearchState, ResearchStateUpdate } from '../state.js'
import { callTool, emit, requireContext, type NodeConfig } from './shared.js'

// Azure/OpenAI structured outputs require every property in `required`;
// optionality must be expressed as nullable, not .optional(), or the API
// rejects the schema outright.
const EvidenceSchema = z.object({
  claims: z.array(
    z.object({
      claim: z.string().min(1),
      quote: z.string().nullable(),
      topic: z.string().min(1),
      confidence: z.enum(['high', 'medium', 'low']),
    }),
  ),
})

/** Keeps each extraction prompt within a reasonable context budget; long documents are chunked and merged. */
const MAX_CHARS_PER_SECTION = 20_000
const MAX_SECTIONS_PER_DOCUMENT = 5

function splitIntoSections(text: string): string[] {
  if (text.length <= MAX_CHARS_PER_SECTION) return [text]
  const sections: string[] = []
  for (let i = 0; i < text.length && sections.length < MAX_SECTIONS_PER_DOCUMENT; i += MAX_CHARS_PER_SECTION) {
    sections.push(text.slice(i, i + MAX_CHARS_PER_SECTION))
  }
  return sections
}

/**
 * Reads selected documents strictly serially (predictable cost/budget, clean
 * progress UI) and extracts attributable evidence per document. Large
 * documents are split into sections so no part of a lengthy document is
 * silently dropped from consideration.
 */
export async function readAndExtract(state: ResearchState, config: NodeConfig): Promise<ResearchStateUpdate> {
  const toRead = state.selectedDocumentIds
    .map((id) => state.candidates[id])
    .filter((c): c is CandidateDocument => Boolean(c) && c.status === 'selected')

  if (toRead.length === 0) {
    return {}
  }

  const { limits } = requireContext(config)
  const model = getAzureChatModel().withStructuredOutput(EvidenceSchema)

  const candidates: Record<string, CandidateDocument> = {}
  const evidence: EvidenceItem[] = []
  let mcpCalls = 0
  let llmCalls = 0
  let documentsFetched = 0
  let evidenceCounter = state.evidence.length

  for (const doc of toRead) {
    if (
      state.budget.mcpCalls + mcpCalls >= limits.maxMcpCalls ||
      state.budget.llmCalls + llmCalls >= limits.maxLlmCalls ||
      state.budget.documentsFetched + documentsFetched >= limits.maxDocuments
    ) {
      break
    }

    emit(config, { type: 'document_status_changed', documentId: doc.documentId, status: 'reading' })
    emit(config, {
      type: 'activity',
      stage: 'reading_documents',
      message: `Reading ${doc.name ?? doc.documentId}…`,
    })

    const result = await callTool(config, FETCH_TOOL, (tool) => buildFetchArgs(tool, { documentId: doc.documentId }))
    mcpCalls += 1
    documentsFetched += 1
    const fetched = mapToolResultToFetchedDocument(result, doc.documentId)

    const sections = splitIntoSections(fetched.text)
    const documentClaims: Array<{
      claim: string
      quote: string | null
      topic: string
      confidence: 'high' | 'medium' | 'low'
    }> = []
    for (const [index, section] of sections.entries()) {
      const prompt = [
        `Extract key factual claims from this excerpt of "${doc.name ?? doc.documentId}"` +
          (sections.length > 1 ? ` (section ${index + 1} of ${sections.length})` : '') +
          '.',
        'Only extract what the text actually states -- do not infer beyond it. Each claim should be a short',
        'factual statement with an associated topic (e.g. parties, dates, scope, obligations, outcome) and a',
        'confidence level. Include a short supporting quote where practical.',
        '---',
        section,
      ].join('\n')
      const extraction = await model.invoke(prompt, { signal: config.signal })
      llmCalls += 1
      documentClaims.push(...extraction.claims)
    }

    for (const claim of documentClaims) {
      evidenceCounter += 1
      evidence.push({
        id: `E${String(evidenceCounter).padStart(3, '0')}`,
        documentId: doc.documentId,
        claim: claim.claim,
        quote: claim.quote ?? undefined,
        topic: claim.topic,
        confidence: claim.confidence,
      })
    }

    candidates[doc.documentId] = { ...doc, status: 'reviewed', truncated: fetched.truncated }
    emit(config, { type: 'document_status_changed', documentId: doc.documentId, status: 'reviewed' })
    emit(config, {
      type: 'activity',
      stage: 'reading_documents',
      message: `Reviewed ${doc.name ?? doc.documentId}${fetched.truncated ? ' (truncated at the MCP fetch limit)' : ''}`,
    })
  }

  return {
    candidates,
    evidence,
    budget: incrementBudget(state.budget, { mcpCalls, llmCalls, documentsFetched }),
  }
}
