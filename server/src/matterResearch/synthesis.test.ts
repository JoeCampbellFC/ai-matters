import { describe, expect, it } from 'vitest'
import { buildCitationRegistry, renderSourcesSection, stripUnknownCitations, validateCitations } from './synthesis.js'
import type { CandidateDocument } from './types.js'

function candidate(overrides: Partial<CandidateDocument> = {}): CandidateDocument {
  return { documentId: 'DOC-1', discoveredVia: ['global_search'], status: 'selected', ...overrides }
}

describe('buildCitationRegistry', () => {
  it('assigns stable, zero-padded markers in selection order', () => {
    const registry = buildCitationRegistry([
      candidate({ documentId: 'DOC-1', name: 'Engagement Letter' }),
      candidate({ documentId: 'DOC-2', name: 'Share Purchase Agreement' }),
    ])
    expect(registry).toEqual([
      { marker: 'D01', documentId: 'DOC-1', documentName: 'Engagement Letter' },
      { marker: 'D02', documentId: 'DOC-2', documentName: 'Share Purchase Agreement' },
    ])
  })
})

describe('validateCitations', () => {
  const registry = [
    { marker: 'D01', documentId: 'DOC-1' },
    { marker: 'D02', documentId: 'DOC-2' },
  ]

  it('is valid when every citation marker is in the registry', () => {
    const result = validateCitations('The matter concerns [D01] and a related filing [D02].', registry)
    expect(result).toEqual({ valid: true, unknownMarkers: [], unusedEntries: [] })
  })

  it('flags a citation marker the registry does not recognize', () => {
    const result = validateCitations('As shown in [D01] and [D99].', registry)
    expect(result.valid).toBe(false)
    expect(result.unknownMarkers).toEqual(['D99'])
  })

  it('reports registry entries the markdown never cited', () => {
    const result = validateCitations('Only [D01] is cited here.', registry)
    expect(result.unusedEntries).toEqual(['D02'])
  })
})

describe('stripUnknownCitations', () => {
  it('replaces unknown markers with a plain [uncited] tag', () => {
    expect(stripUnknownCitations('See [D01] and [D99] for details.', ['D99'])).toBe(
      'See [D01] and [uncited] for details.',
    )
  })
})

describe('renderSourcesSection', () => {
  it('renders a bullet per registry entry with id, version, and link when present', () => {
    const section = renderSourcesSection([
      { marker: 'D01', documentId: 'DOC-1', documentName: 'Engagement Letter', version: '2', link: 'https://example.test/doc1' },
    ])
    expect(section).toContain('**[D01]** Engagement Letter')
    expect(section).toContain('`DOC-1`')
    expect(section).toContain(', v2')
    expect(section).toContain('[Open in iManage](https://example.test/doc1)')
  })

  it('reports no documents used when the registry is empty', () => {
    expect(renderSourcesSection([])).toContain('No documents were used as evidence')
  })
})
