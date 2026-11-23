import { describe, expect, it } from 'vitest'
import { buildClassificationInput, hashMarkdown } from './classificationInputBuilder.js'

function markdownWithSections(overrides: Partial<Record<string, string>> = {}): string {
  const sections: Record<string, string> = {
    '1. Matter Overview': 'This matter concerns an acquisition of a technology company.',
    '2. Client and Parties': 'Acme Corp (client) acquiring Widget Inc.',
    '3. Matter Scope and Objectives': 'Negotiate and close the share purchase agreement.',
    '4. Legal and Commercial Context': 'UK jurisdiction, technology sector.',
    '5. Key Activities and Work Performed': 'Due diligence, drafting, negotiation.',
    '6. Timeline and Important Events': 'Signed 2026-01-01.',
    '7. Important Agreements and Deliverables': 'Share purchase agreement, disclosure letter.',
    '8. Key Legal Issues and Considerations': 'Warranties and indemnities negotiated.',
    '9. Outcomes and Current Position': 'Deal completed.',
    '13. Key Document Register': '| D01 | SPA | DOC-1 |',
    '14. Evidence and Source References': '- [D01] Share Purchase Agreement (iManage ID: DOC-1)',
    ...overrides,
  }
  const body = Object.entries(sections)
    .map(([heading, text]) => `## ${heading}\n\n${text}\n`)
    .join('\n')
  return `# Matter Knowledge File: Acme / Widget Acquisition\n\n${body}`
}

describe('buildClassificationInput', () => {
  it('uses the full Markdown unchanged when it fits the budget', () => {
    const markdown = markdownWithSections()
    const result = buildClassificationInput(markdown, 100_000)
    expect(result.mode).toBe('full')
    expect(result.text).toBe(markdown)
  })

  it('falls back to a deterministic reduced extract when the Markdown exceeds the budget', () => {
    const markdown = markdownWithSections({ '5. Key Activities and Work Performed': 'A'.repeat(2000) })
    const result = buildClassificationInput(markdown, 500)

    expect(result.mode).toBe('reduced')
    // Preserved: sections on the keep-list.
    expect(result.text).toContain('1. Matter Overview')
    expect(result.text).toContain('3. Matter Scope and Objectives')
    expect(result.text).toContain('14. Evidence and Source References')
    // Dropped: sections not on the keep-list (timeline, document register).
    expect(result.text).not.toContain('6. Timeline and Important Events')
    expect(result.text).not.toContain('13. Key Document Register')
    expect(result.text.length).toBeLessThanOrEqual(500)
  })

  it('never invents a second speculative summary -- the reduced extract is built only from existing sections', () => {
    const markdown = markdownWithSections()
    const result = buildClassificationInput(markdown, 100_000)
    expect(result.text).toBe(markdown)
  })
})

describe('hashMarkdown', () => {
  it('is deterministic for identical content and differs for different content', () => {
    const a = hashMarkdown('# Matter Knowledge File: X\n\nSame content.')
    const b = hashMarkdown('# Matter Knowledge File: X\n\nSame content.')
    const c = hashMarkdown('# Matter Knowledge File: X\n\nDifferent content.')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
})
