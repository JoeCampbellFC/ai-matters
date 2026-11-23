import { z } from 'zod'
import { config } from '../config.js'
import { UNCLEAR_MATTER_TYPE_ID, isKnownMatterTypeChoice } from './matterTypes.js'
import type { ClassificationStatus, MatterTypeChoiceId } from './types.js'

/**
 * Maps a Decisions API confidence to a UI review status. Provisional
 * thresholds (see config.ts / .env.example) -- not statistically validated
 * accuracy thresholds, and should be calibrated against human-labelled
 * matters over time. The internal "Unclear / Other" fallback always needs
 * review regardless of how confidently the model selected it.
 */
export function statusForChoice(choiceId: MatterTypeChoiceId, confidence: number): ClassificationStatus {
  if (choiceId === UNCLEAR_MATTER_TYPE_ID) return 'needs_review'
  if (confidence >= config.classificationHighConfidence) return 'classified'
  if (confidence >= config.classificationReviewThreshold) return 'review_recommended'
  return 'needs_review'
}

export const ManualCorrectionInputSchema = z.object({
  matterTypeId: z.string().min(1).refine(isKnownMatterTypeChoice, { message: 'Unrecognized matter type id.' }),
  correctedBy: z.string().min(1),
})
