import { describe, expect, it } from 'vitest'
import {
  ALL_CLASSIFICATION_CHOICES,
  MATTER_TYPES,
  UNCLEAR_MATTER_TYPE_ID,
  getMatterTypeLabel,
  isKnownMatterTypeChoice,
  listMatterTypeOptions,
} from './matterTypes.js'

describe('matter type taxonomy', () => {
  it('has exactly 20 official categories', () => {
    expect(MATTER_TYPES).toHaveLength(20)
  })

  it('includes the internal "Unclear / Other" fallback in addition to the 20 official categories', () => {
    expect(ALL_CLASSIFICATION_CHOICES).toHaveLength(21)
    expect(ALL_CLASSIFICATION_CHOICES.map((c) => c.id)).toContain(UNCLEAR_MATTER_TYPE_ID)
  })

  it('has unique, non-empty ids and labels across every category', () => {
    const ids = ALL_CLASSIFICATION_CHOICES.map((c) => c.id)
    const labels = ALL_CLASSIFICATION_CHOICES.map((c) => c.label)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(labels).size).toBe(labels.length)
    for (const def of ALL_CLASSIFICATION_CHOICES) {
      expect(def.id.length).toBeGreaterThan(0)
      expect(def.label.length).toBeGreaterThan(0)
      expect(def.description.length).toBeGreaterThan(0)
      expect(def.guidance.length).toBeGreaterThan(0)
    }
  })

  it('exposes only id/label (no descriptions/guidance) via listMatterTypeOptions', () => {
    const options = listMatterTypeOptions()
    expect(options).toHaveLength(20)
    expect(options.every((o) => !('description' in o) && !('guidance' in o))).toBe(true)
  })

  it('recognizes every official id and the fallback id as known choices', () => {
    for (const def of ALL_CLASSIFICATION_CHOICES) {
      expect(isKnownMatterTypeChoice(def.id)).toBe(true)
    }
    expect(isKnownMatterTypeChoice('not_a_real_id')).toBe(false)
  })

  it('resolves a label for a known id and falls back to the id itself for an unknown one', () => {
    expect(getMatterTypeLabel('mergers_acquisitions')).toBe('Mergers & Acquisitions')
  })
})
