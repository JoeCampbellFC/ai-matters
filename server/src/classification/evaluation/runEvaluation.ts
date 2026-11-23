import { ALL_CLASSIFICATION_CHOICES, type MatterTypeChoiceId } from '../matterTypes.js'
import { statusForChoice } from '../classificationValidator.js'
import type { ChoiceDecisionAnswer, RefusalDecisionAnswer } from '../decisionsClient.js'
import { EVAL_CASES, type EvalCase } from './fixtures.js'

export interface EvalResult {
  name: string
  pair: string
  expected: MatterTypeChoiceId
  predicted: MatterTypeChoiceId | null
  confidence: number | null
  correct: boolean
  reviewTriggered: boolean
  /** Flags the specific failure mode the spec calls out as worth tracking separately: a wrong answer the model was nonetheless confident about. */
  incorrectButHighConfidence: boolean
}

export interface EvalSummary {
  results: EvalResult[]
  total: number
  correct: number
  accuracy: number
  reviewTriggeredCount: number
  incorrectHighConfidenceCount: number
}

export type ClassifyFn = (evalCase: EvalCase) => Promise<ChoiceDecisionAnswer | RefusalDecisionAnswer>

const CHOICE_IDS = new Set(ALL_CLASSIFICATION_CHOICES.map((c) => c.id))

/**
 * Runs the taxonomy-overlap evaluation cases through a supplied classify
 * function (either a scripted mock or the real Decisions API -- see
 * matterClassification.eval.test.ts for both) and reports expected vs
 * predicted, confidence, correctness, and whether review would have been
 * triggered. This is an initial evaluation process, not a statistically
 * validated accuracy benchmark -- see module docs.
 */
export async function runEvaluation(classify: ClassifyFn, cases: EvalCase[] = EVAL_CASES): Promise<EvalSummary> {
  const results: EvalResult[] = []

  for (const evalCase of cases) {
    const answer = await classify(evalCase)
    if (answer.type === 'refusal') {
      results.push({
        name: evalCase.name,
        pair: evalCase.pair,
        expected: evalCase.expected,
        predicted: null,
        confidence: null,
        correct: false,
        reviewTriggered: true,
        incorrectButHighConfidence: false,
      })
      continue
    }

    const predicted = CHOICE_IDS.has(answer.choice as MatterTypeChoiceId) ? (answer.choice as MatterTypeChoiceId) : null
    const correct = predicted === evalCase.expected
    const status = predicted ? statusForChoice('matter_type', predicted, answer.confidence) : 'needs_review'
    const reviewTriggered = status !== 'classified'

    results.push({
      name: evalCase.name,
      pair: evalCase.pair,
      expected: evalCase.expected,
      predicted,
      confidence: answer.confidence,
      correct,
      reviewTriggered,
      incorrectButHighConfidence: !correct && !reviewTriggered,
    })
  }

  const correct = results.filter((r) => r.correct).length
  return {
    results,
    total: results.length,
    correct,
    accuracy: results.length > 0 ? correct / results.length : 0,
    reviewTriggeredCount: results.filter((r) => r.reviewTriggered).length,
    incorrectHighConfidenceCount: results.filter((r) => r.incorrectButHighConfidence).length,
  }
}

export function formatEvalReport(summary: EvalSummary): string {
  const rows = summary.results.map((r) => {
    const mark = r.correct ? 'OK  ' : 'FAIL'
    const confidence = r.confidence !== null ? r.confidence.toFixed(2) : 'n/a'
    return `${mark}  ${r.pair.padEnd(55)} expected=${r.expected.padEnd(28)} predicted=${String(r.predicted).padEnd(28)} confidence=${confidence} review=${r.reviewTriggered}`
  })
  const summaryLine = `\n${summary.correct}/${summary.total} correct (${(summary.accuracy * 100).toFixed(1)}%), ${summary.reviewTriggeredCount} flagged for review, ${summary.incorrectHighConfidenceCount} incorrect despite high confidence`
  return [...rows, summaryLine].join('\n')
}
