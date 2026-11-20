import { checkBudget } from '../../budget.js'
import { renderSourcesSection } from '../../synthesis.js'
import type { CandidateDocument, CitationRegistryEntry } from '../../types.js'
import type { ResearchState, ResearchStateUpdate } from '../state.js'
import { emit, requireContext, type NodeConfig } from './shared.js'

function renderDocumentRegister(
  citationRegistry: CitationRegistryEntry[],
  candidates: Record<string, CandidateDocument>,
): string {
  if (citationRegistry.length === 0) {
    return '## 13. Key Document Register\n\nNo documents were used as evidence for this summary.\n'
  }
  const rows = citationRegistry.map((entry) => {
    const candidate = candidates[entry.documentId]
    return (
      `| ${entry.marker} | ${entry.documentName ?? entry.documentId} | \`${entry.documentId}\` | ` +
      `${candidate?.docType ?? '—'} | ${candidate?.date ?? '—'} | ${candidate?.author ?? '—'} | ` +
      `${candidate?.selectionReason ?? '—'} |`
    )
  })
  return [
    '## 13. Key Document Register',
    '',
    '| Marker | Name | Document ID | Type | Date | Author | Why it matters |',
    '|---|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n')
}

function renderResearchCoverage(state: ResearchState): string {
  const candidates = Object.values(state.candidates)
  const usedCount = state.selectedDocumentIds.filter((id) => state.candidates[id]?.status === 'reviewed').length
  const excludedCount = candidates.filter((c) => c.status === 'excluded').length
  const lines = [
    '## 16. Research Coverage',
    '',
    `- Search queries executed: ${state.searchPlans.length}`,
    `- Document candidates discovered: ${candidates.length}`,
    `- Documents selected: ${state.selectedDocumentIds.length}`,
    `- Documents successfully read: ${usedCount}`,
    `- Documents excluded (workspace membership could not be verified, or did not match): ${excludedCount}`,
    `- Remaining evidence gaps: ${state.coverage?.gaps.map((g) => g.topic).join('; ') || 'none identified'}`,
  ]
  if (state.budget.exceeded) {
    lines.push(
      `- **Note:** this run stopped early due to the \`${state.budget.exceeded}\` budget limit; coverage may be incomplete.`,
    )
  }
  return `${lines.join('\n')}\n`
}

/**
 * Assembles the final Markdown: frontmatter + title + the LLM-authored
 * narrative sections, followed by the document register, sources, and
 * coverage-stats sections -- all three of the latter built directly from
 * structured state, never LLM-authored, since they're what a reader would
 * most want to fact-check.
 */
export async function finalize(state: ResearchState, config: NodeConfig): Promise<ResearchStateUpdate> {
  const { limits } = requireContext(config)
  const budget = { ...state.budget, exceeded: checkBudget(state.budget, limits) }
  state = { ...state, budget }

  const title = state.workspace?.name ?? state.workspaceId
  const frontmatter = [
    '---',
    `title: "${title.replace(/"/g, "'")}"`,
    `workspace_id: "${state.workspaceId}"`,
    state.workspace?.client ? `client: "${state.workspace.client.replace(/"/g, "'")}"` : undefined,
    `generated_at: "${new Date().toISOString()}"`,
    'source_system: "iManage Work"',
    `evidence_documents: ${state.citationRegistry.length}`,
    '---',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')

  const markdown = [
    frontmatter,
    '',
    `# Matter Knowledge File: ${title}`,
    '',
    state.markdown ?? '',
    renderDocumentRegister(state.citationRegistry, state.candidates),
    renderSourcesSection(state.citationRegistry),
    renderResearchCoverage(state),
  ].join('\n')

  emit(config, { type: 'activity', stage: 'synthesizing', message: 'Matter summary complete' })

  return {
    markdown,
    budget,
    status: 'succeeded',
  }
}
