import { describe, expect, it } from 'vitest'
import { config } from '../config.js'
import { UNCLEAR_MATTER_TYPE_ID } from './matterTypes.js'
import { ManualCorrectionInputSchema, statusForChoice } from './classificationValidator.js'

describe('statusForChoice', () => {
  it('is "classified" at or above the high-confidence threshold', () => {
    expect(statusForChoice('matter_type', 'mergers_acquisitions', config.classificationHighConfidence)).toBe('classified')
    expect(statusForChoice('matter_type', 'mergers_acquisitions', 0.99)).toBe('classified')
  })

  it('is "review_recommended" between the review and high-confidence thresholds', () => {
    expect(statusForChoice('matter_type', 'mergers_acquisitions', config.classificationReviewThreshold)).toBe('review_recommended')
    expect(statusForChoice('matter_type', 'mergers_acquisitions', config.classificationHighConfidence - 0.01)).toBe('review_recommended')
  })

  it('is "needs_review" below the review threshold', () => {
    expect(statusForChoice('matter_type', 'mergers_acquisitions', config.classificationReviewThreshold - 0.01)).toBe('needs_review')
    expect(statusForChoice('matter_type', 'mergers_acquisitions', 0)).toBe('needs_review')
  })

  it('is always "needs_review" for matter_type\'s Unclear / Other fallback, regardless of confidence', () => {
    expect(statusForChoice('matter_type', UNCLEAR_MATTER_TYPE_ID, 0.99)).toBe('needs_review')
  })

  it('applies plain confidence thresholds for fields with no "unclear" fallback', () => {
    expect(statusForChoice('practice_area', 'tax', config.classificationHighConfidence)).toBe('classified')
    expect(statusForChoice('practice_area', 'tax', 0)).toBe('needs_review')
  })
})

describe('ManualCorrectionInputSchema', () => {
  it('accepts a known field id, a known value for that field, and a non-empty correctedBy', () => {
    const result = ManualCorrectionInputSchema.parse({ fieldId: 'matter_type', valueId: 'tax', correctedBy: 'alice' })
    expect(result).toEqual({ fieldId: 'matter_type', valueId: 'tax', correctedBy: 'alice' })
  })

  it('rejects an unrecognized field id', () => {
    expect(() => ManualCorrectionInputSchema.parse({ fieldId: 'not_real', valueId: 'tax', correctedBy: 'alice' })).toThrow()
  })

  it('rejects a value that is not one of the field\'s choices', () => {
    expect(() => ManualCorrectionInputSchema.parse({ fieldId: 'matter_type', valueId: 'not_real', correctedBy: 'alice' })).toThrow()
  })

  it('rejects a value that belongs to a different field', () => {
    expect(() => ManualCorrectionInputSchema.parse({ fieldId: 'matter_type', valueId: 'low', correctedBy: 'alice' })).toThrow()
  })

  it('rejects an empty correctedBy', () => {
    expect(() => ManualCorrectionInputSchema.parse({ fieldId: 'matter_type', valueId: 'tax', correctedBy: '' })).toThrow()
  })
})
