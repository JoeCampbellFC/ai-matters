import { createHash } from 'node:crypto'
import { config } from '../config.js'

export interface ClassificationInput {
  text: string
  mode: 'full' | 'reduced'
}

/**
 * Headings (by their numeric prefix, matching buildOutline.ts's
 * SECTION_DEFINITIONS and finalize.ts's deterministic sections) kept when the
 * full Markdown exceeds the configured budget: matter overview, scope and
 * objectives, legal/commercial context, activities, deliverables, legal
 * issues, outcomes, and source references -- the sections most relevant to
 * identifying the principal legal engagement.
 */
const REDUCED_SECTION_PREFIXES = [
  '1. Matter Overview',
  '3. Matter Scope and Objectives',
  '4. Legal and Commercial Context',
  '5. Key Activities and Work Performed',
  '7. Important Agreements and Deliverables',
  '8. Key Legal Issues and Considerations',
  '9. Outcomes and Current Position',
  '14. Evidence and Source References',
]

function extractTitle(markdown: string): string | undefined {
  return /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim()
}

function splitSections(markdown: string): Array<{ heading: string; body: string }> {
  const lines = markdown.split('\n')
  const sections: Array<{ heading: string; body: string[] }> = []
  let current: { heading: string; body: string[] } | undefined

  for (const line of lines) {
    const match = /^##\s+(.+?)\s*$/.exec(line)
    if (match) {
      current = { heading: match[1]!, body: [] }
      sections.push(current)
    } else if (current) {
      current.body.push(line)
    }
  }
  return sections.map((s) => ({ heading: s.heading, body: s.body.join('\n').trim() }))
}

/**
 * Prepares the completed Matter Knowledge Markdown for the Decisions API.
 * Uses the complete Markdown where it fits the configured input budget; the
 * Phase 2 output is already structured for AI readability. Otherwise builds a
 * deterministic, classification-focused extract from the existing sections
 * -- never a second speculative summary call.
 */
export function buildClassificationInput(
  markdown: string,
  maxChars: number = config.classificationMaxInputChars,
): ClassificationInput {
  if (markdown.length <= maxChars) {
    return { text: markdown, mode: 'full' }
  }

  const title = extractTitle(markdown)
  const sections = splitSections(markdown)
  const kept = sections.filter((section) => REDUCED_SECTION_PREFIXES.some((prefix) => section.heading.startsWith(prefix)))

  const titleText = title ? `# ${title}` : ''
  // Gives every kept section a fair, roughly equal share of the remaining
  // budget -- without this, one oversized section (e.g. a long activities
  // narrative) could consume the entire budget and silently drop later
  // sections (e.g. source references) instead of just trimming them.
  const headingOverhead = kept.reduce((sum, section) => sum + `## ${section.heading}\n\n`.length, 0)
  const bodyBudget = Math.max(0, maxChars - titleText.length - headingOverhead)
  const perSectionBudget = kept.length > 0 ? Math.floor(bodyBudget / kept.length) : 0

  const parts = [
    titleText || undefined,
    ...kept.map((section) => `## ${section.heading}\n\n${section.body.slice(0, perSectionBudget)}`),
  ].filter((part): part is string => Boolean(part))

  let text = parts.join('\n\n')
  if (text.length > maxChars) {
    text = text.slice(0, maxChars)
  }
  return { text, mode: 'reduced' }
}

export function hashMarkdown(markdown: string): string {
  return createHash('sha256').update(markdown).digest('hex')
}
