import type { CandidateDocument, CitationRegistryEntry } from './types.js'

/**
 * Assigns stable D01, D02, ... markers once, in first-selected order, before
 * any section is written. Every writeMarkdown call shares this one registry
 * so the same document always gets the same marker throughout the document.
 */
export function buildCitationRegistry(selected: CandidateDocument[]): CitationRegistryEntry[] {
  return selected.map((doc, index) => ({
    marker: `D${String(index + 1).padStart(2, '0')}`,
    documentId: doc.documentId,
    documentName: doc.name,
  }))
}

export interface CitationValidationResult {
  valid: boolean
  unknownMarkers: string[]
  unusedEntries: string[]
}

const CITATION_PATTERN = /\[D(\d{2,})\]/g

/**
 * Deterministic scan: never trusts the LLM's self-report of correct
 * citations. unknownMarkers are references to a document that isn't in the
 * registry (hallucinated or stale); unusedEntries are registry documents the
 * markdown never actually cited.
 */
export function validateCitations(markdown: string, registry: CitationRegistryEntry[]): CitationValidationResult {
  const knownMarkers = new Set(registry.map((entry) => entry.marker))
  const usedMarkers = new Set<string>()
  const unknownMarkers = new Set<string>()

  for (const match of markdown.matchAll(CITATION_PATTERN)) {
    const marker = `D${match[1]}`
    if (knownMarkers.has(marker)) {
      usedMarkers.add(marker)
    } else {
      unknownMarkers.add(marker)
    }
  }

  const unusedEntries = registry.map((entry) => entry.marker).filter((marker) => !usedMarkers.has(marker))

  return {
    valid: unknownMarkers.size === 0,
    unknownMarkers: [...unknownMarkers],
    unusedEntries,
  }
}

/**
 * Deterministic fallback once LLM-based repair is exhausted: replace any
 * still-unknown citation marker with a plain, honest [uncited] tag rather
 * than failing the run or leaving a dangling reference to nothing.
 */
export function stripUnknownCitations(markdown: string, unknownMarkers: string[]): string {
  let result = markdown
  for (const marker of unknownMarkers) {
    result = result.replaceAll(`[${marker}]`, '[uncited]')
  }
  return result
}

/**
 * The one section guaranteed correct by construction: built directly from
 * the registry, never LLM-authored.
 */
export function renderSourcesSection(registry: CitationRegistryEntry[]): string {
  if (registry.length === 0) {
    return '## 14. Evidence and Source References\n\nNo documents were used as evidence for this summary.\n'
  }
  const lines = registry.map((entry) => {
    const label = entry.documentName ?? entry.documentId
    const version = entry.version ? `, v${entry.version}` : ''
    const link = entry.link ? ` — [Open in iManage](${entry.link})` : ''
    return `- **[${entry.marker}]** ${label} (iManage ID: \`${entry.documentId}\`${version})${link}`
  })
  return `## 14. Evidence and Source References\n\n${lines.join('\n')}\n`
}
