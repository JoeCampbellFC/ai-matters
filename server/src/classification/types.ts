export type { ClassificationFieldId } from './classificationFields.js'

export type ClassificationStatus = 'pending' | 'classified' | 'review_recommended' | 'needs_review' | 'failed'

export interface ClassificationProbability {
  id: string
  label: string
  probability: number
}
