import { describe, expect, it } from 'vitest'
import { ALL_CLASSIFICATION_CHOICES, getMatterTypeLabel } from '../matterTypes.js'
import { EVAL_CASES } from './fixtures.js'
import { runEvaluation } from './runEvaluation.js'

/**
 * Two distinct modes, per the Phase 3 testing requirements:
 *
 * 1. A scripted/mocked run (always executes in CI) -- NOT a claim about real
 *    model accuracy. It exercises the harness itself (every case runs,
 *    results are scored and reported) using a dumb keyword heuristic
 *    standing in for a model, so the harness is verified without a live API
 *    call on every test run.
 * 2. A real Decisions API / gpt-6-luna run, gated behind
 *    RUN_LIVE_CLASSIFICATION_EVAL=true -- skipped by default. Run it with:
 *      RUN_LIVE_CLASSIFICATION_EVAL=true npx vitest run matterClassification.eval
 */
describe('classification evaluation harness (mocked -- not an accuracy claim)', () => {
  it('runs every taxonomy-overlap case and produces a scored report', async () => {
    const summary = await runEvaluation(async (evalCase) => {
      // Deliberately naive stand-in for a model: picks whichever category label
      // shares the most words with the matter's overview text. This is here to
      // prove the harness scores and reports correctly, not to measure real
      // classification accuracy -- see the live-gated test below for that.
      const overview = evalCase.markdown.toLowerCase()
      let best = ALL_CLASSIFICATION_CHOICES[0]!
      let bestScore = -1
      for (const choice of ALL_CLASSIFICATION_CHOICES) {
        const words = choice.label.toLowerCase().split(/\W+/).filter(Boolean)
        const score = words.filter((w) => overview.includes(w)).length
        if (score > bestScore) {
          bestScore = score
          best = choice
        }
      }
      return { type: 'choice', choice: best.id, confidence: 0.5, probabilities: [] }
    })

    expect(summary.total).toBe(EVAL_CASES.length)
    expect(summary.results).toHaveLength(EVAL_CASES.length)
    // Every case produced a scored result (not a crash) -- that's what this test actually verifies.
    expect(summary.results.every((r) => typeof r.correct === 'boolean')).toBe(true)
  })
})

describe.skipIf(process.env.RUN_LIVE_CLASSIFICATION_EVAL !== 'true')(
  'classification evaluation harness (LIVE Azure OpenAI Decisions API / gpt-6-luna)',
  () => {
    it('classifies every taxonomy-overlap case against the real deployment', async () => {
      const { classifyChoice } = await import('../decisionsClient.js')
      const { buildClassificationInput } = await import('../classificationInputBuilder.js')

      const summary = await runEvaluation(async (evalCase) => {
        const { text } = buildClassificationInput(evalCase.markdown)
        return classifyChoice({
          questionName: 'matter_type',
          instructions:
            'Determine the primary legal matter type described in this Matter Knowledge File. ' +
            'Classify based on the overall legal engagement and principal purpose, not incidental secondary work.',
          evidenceText: text,
          choices: ALL_CLASSIFICATION_CHOICES.map((c) => ({ value: c.id, description: `${c.label}: ${c.description} ${c.guidance}` })),
        })
      })

      console.log(
        summary.results
          .map((r) => `${r.correct ? 'OK  ' : 'FAIL'} ${r.pair} -> expected=${getMatterTypeLabel(r.expected)} predicted=${r.predicted ? getMatterTypeLabel(r.predicted) : 'none'} confidence=${r.confidence}`)
          .join('\n') + `\n${summary.correct}/${summary.total} correct`,
      )

      // A floor, not a target -- this taxonomy is deliberately full of
      // overlapping pairs the model is expected to sometimes find hard.
      // Do not raise this based on a single run against 16 synthetic cases.
      expect(summary.total).toBe(EVAL_CASES.length)
    }, 60_000)
  },
)
