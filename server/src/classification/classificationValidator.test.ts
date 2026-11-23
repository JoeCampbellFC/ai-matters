import { describe, expect, it } from 'vitest'
import { config } from '../config.js'
import { UNCLEAR_MATTER_TYPE_ID } from './matterTypes.js'
import { ManualCorrectionInputSchema, statusForChoice } from './classificationValidator.js'

describe('statusForChoice', () => {
  it('is "classified" at or above the high-confidence threshold', () => {
    expect(statusForChoice('mergers_acquisitions', config.classificationHighConfidence)).toBe('classified')
    expect(statusForChoice('mergers_acquisitions', 0.99)).toBe('classified')
  })

  it('is "review_recommended" between the review and high-confidence thresholds', () => {
    expect(statusForChoice('mergers_acquisitions', config.classificationReviewThreshold)).toBe('review_recommended')
    expect(statusForChoice('mergers_acquisitions', config.classificationHighConfidence - 0.01)).toBe('review_recommended')
  })

  it('is "needs_review" below the review threshold', () => {
    expect(statusForChoice('mergers_acquisitions', config.classificationReviewThreshold - 0.01)).toBe('needs_review')
    expect(statusForChoice('mergers_acquisitions', 0)).toBe('needs_review')
  })

  it('is always "needs_review" for the Unclear / Other fallback, regardless of confidence', () => {
    expect(statusForChoice(UNCLEAR_MATTER_TYPE_ID, 0.99)).toBe('needs_review')
  })
})

describe('ManualCorrectionInputSchema', () => {
  it('accepts a known matter type id and a non-empty correctedBy', () => {
    const result = ManualCorrectionInputSchema.parse({ matterTypeId: 'tax', correctedBy: 'alice' })
    expect(result).toEqual({ matterTypeId: 'tax', correctedBy: 'alice' })
  })

  it('rejects an unrecognized matter type id', () => {
    expect(() => ManualCorrectionInputSchema.parse({ matterTypeId: 'not_real', correctedBy: 'alice' })).toThrow()
  })

  it('rejects an empty correctedBy', () => {
    expect(() => ManualCorrectionInputSchema.parse({ matterTypeId: 'tax', correctedBy: '' })).toThrow()
  })
})
