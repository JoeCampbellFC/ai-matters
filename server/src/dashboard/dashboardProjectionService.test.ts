import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invoke, withStructuredOutput, getAzureChatModel, classifyAzureError } = vi.hoisted(() => {
  const invoke = vi.fn()
  const withStructuredOutput = vi.fn(() => ({ invoke }))
  const getAzureChatModel = vi.fn(() => ({ withStructuredOutput }))
  const classifyAzureError = vi.fn((error: unknown) => (error instanceof Error ? error : new Error(String(error))))
  return { invoke, withStructuredOutput, getAzureChatModel, classifyAzureError }
})
vi.mock('../llm/azureOpenAI.js', () => ({ getAzureChatModel, classifyAzureError }))

const knowledgeServiceMocks = vi.hoisted(() => ({ getCurrentVersionOrThrow: vi.fn() }))
vi.mock('../services/matterKnowledgeService.js', () => knowledgeServiceMocks)

const repoMocks = vi.hoisted(() => ({
  getProjection: vi.fn(),
  saveProjectionReady: vi.fn(),
  saveProjectionFailed: vi.fn(),
  PROJECTION_SCHEMA_VERSION: 'v1',
}))
vi.mock('../database/repositories/dashboardRepository.js', () => repoMocks)

const { getExistingDashboardProjection, getOrCreateDashboardProjection } = await import('./dashboardProjectionService.js')

function version(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'v1',
    matterId: 'matter-1',
    content: '# Matter Knowledge\n\nSome content referencing [D01].',
    contentHash: 'hash-1',
    citationRegistry: [{ marker: 'D01', documentId: 'doc-1', documentName: 'Agreement.pdf' }],
    ...overrides,
  }
}

function emptyExtraction(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    overview: null,
    timelineEvents: [],
    parties: [],
    issues: [],
    outcomeItems: [],
    customItems: [],
    ...overrides,
  }
}

beforeEach(() => {
  invoke.mockReset()
  withStructuredOutput.mockClear()
  getAzureChatModel.mockClear()
  classifyAzureError.mockClear()
  for (const mockFn of Object.values(knowledgeServiceMocks)) mockFn.mockReset()
  for (const mockFn of Object.values(repoMocks)) {
    if (typeof mockFn === 'function' && 'mockReset' in mockFn) mockFn.mockReset()
  }
  knowledgeServiceMocks.getCurrentVersionOrThrow.mockResolvedValue(version())
})

describe('getOrCreateDashboardProjection', () => {
  it('returns the cached projection without calling the LLM when one already exists', async () => {
    const cached = { schemaVersion: 'v1', widgets: [], generatedAt: '2026-01-01T00:00:00.000Z' }
    repoMocks.getProjection.mockResolvedValue({ status: 'ready', projectionJson: cached })

    const result = await getOrCreateDashboardProjection('matter-1')

    expect(result.wasCached).toBe(true)
    expect(result.projection).toEqual(cached)
    expect(getAzureChatModel).not.toHaveBeenCalled()
  })

  it('generates, assembles widgets, and persists on a cache miss', async () => {
    repoMocks.getProjection.mockResolvedValue(undefined)
    invoke.mockResolvedValue(
      emptyExtraction({
        overview: { summary: 'This matter concerns a share purchase dispute.', sourceRefs: ['D01'] },
        timelineEvents: [{ id: 't1', date: '2026-01-01', title: 'Filing', description: 'Claim filed.', status: 'completed', sourceRefs: ['D01'] }],
      }),
    )
    repoMocks.saveProjectionReady.mockResolvedValue({})

    const result = await getOrCreateDashboardProjection('matter-1')

    expect(result.wasCached).toBe(false)
    expect(result.projection.widgets).toHaveLength(2)
    expect(result.projection.widgets.map((w: { type: string }) => w.type)).toEqual(['overview', 'timeline'])
    expect(repoMocks.saveProjectionReady).toHaveBeenCalledWith(
      expect.objectContaining({ matterId: 'matter-1', markdownVersionId: 'v1' }),
    )
  })

  it('omits a widget category entirely when the extraction has nothing for it', async () => {
    repoMocks.getProjection.mockResolvedValue(undefined)
    invoke.mockResolvedValue(emptyExtraction())
    repoMocks.saveProjectionReady.mockResolvedValue({})

    const result = await getOrCreateDashboardProjection('matter-1')

    expect(result.projection.widgets).toEqual([])
  })

  it('drops a sourceRef that does not match a known citation marker, keeping the rest of the item', async () => {
    repoMocks.getProjection.mockResolvedValue(undefined)
    invoke.mockResolvedValue(
      emptyExtraction({
        overview: { summary: 'Summary text.', sourceRefs: ['D01', 'D99'] },
      }),
    )
    repoMocks.saveProjectionReady.mockResolvedValue({})

    const result = await getOrCreateDashboardProjection('matter-1')

    const overviewWidget = result.projection.widgets.find((w: { type: string }) => w.type === 'overview') as { sourceRefs: string[] }
    expect(overviewWidget.sourceRefs).toEqual(['D01'])
  })

  it('persists a failure and rethrows when the LLM call errors', async () => {
    repoMocks.getProjection.mockResolvedValue(undefined)
    invoke.mockRejectedValue(new Error('rate limited'))
    repoMocks.saveProjectionFailed.mockResolvedValue({})

    await expect(getOrCreateDashboardProjection('matter-1')).rejects.toThrow('rate limited')
    expect(repoMocks.saveProjectionFailed).toHaveBeenCalledWith(
      expect.objectContaining({ matterId: 'matter-1', markdownVersionId: 'v1', errorMessage: 'rate limited' }),
    )
  })
})

describe('getExistingDashboardProjection', () => {
  it('returns undefined without ever calling the LLM when nothing is cached', async () => {
    repoMocks.getProjection.mockResolvedValue(undefined)

    const result = await getExistingDashboardProjection('matter-1')

    expect(result).toBeUndefined()
    expect(getAzureChatModel).not.toHaveBeenCalled()
  })

  it('returns the cached projection when one is ready', async () => {
    const cached = { schemaVersion: 'v1', widgets: [], generatedAt: '2026-01-01T00:00:00.000Z' }
    repoMocks.getProjection.mockResolvedValue({ status: 'ready', projectionJson: cached })

    const result = await getExistingDashboardProjection('matter-1')

    expect(result?.projection).toEqual(cached)
  })
})
