import { z } from 'zod'
import { config } from '../config.js'
import { isKnownChoice, isKnownClassificationField, isUnclearMatterType } from './classificationFields.js'
import type { ClassificationFieldId } from './classificationFields.js'
import type { ClassificationStatus } from './types.js'

/**
 * Maps a Decisions API confidence to a UI review status. Provisional
 * thresholds (see config.ts / .env.example) -- not statistically validated
 * accuracy thresholds, and should be calibrated against human-labelled
 * matters over time. matter_type's internal "Unclear / Other" fallback
 * always needs review regardless of how confidently the model selected it;
 * no other field has an equivalent fallback value.
 */
export function statusForChoice(fieldId: ClassificationFieldId, valueId: string, confidence: number): ClassificationStatus {
  if (isUnclearMatterType(fieldId, valueId)) return 'needs_review'
  if (confidence >= config.classificationHighConfidence) return 'classified'
  if (confidence >= config.classificationReviewThreshold) return 'review_recommended'
  return 'needs_review'
}

export const ManualCorrectionInputSchema = z.object({
  fieldId: z.string().min(1).refine(isKnownClassificationField, { message: 'Unrecognized classification field id.' }),
  valueId: z.string().min(1),
  correctedBy: z.string().min(1),
}).refine((input) => isKnownChoice(input.fieldId, input.valueId), {
  message: 'Unrecognized value for this classification field.',
  path: ['valueId'],
})
