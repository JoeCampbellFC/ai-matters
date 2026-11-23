import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { ClassificationRecord, ManualCorrection, MarkdownArtifact, MatterProfileRecord } from './types.js'

/**
 * Simple file-backed durable store -- the research runs it classifies are
 * only ever in-memory (TTL'd), so classification results and the Markdown
 * they were derived from must survive both that TTL and a server restart.
 * A full database platform would be overkill for this single-process app;
 * writes are synchronous (writeFileSync/renameSync don't interleave on
 * Node's single JS thread) and atomic (write-then-rename), which is enough
 * durability for this write volume (one write per completed/reclassified/
 * corrected matter, not a hot path).
 */
const DATA_DIR = path.resolve(process.cwd(), 'data')
const STORE_PATH = path.join(DATA_DIR, 'classification-store.json')

export interface StoredProfile extends MatterProfileRecord {
  lastError?: { code: string; message: string; at: string }
}

interface StoreShape {
  artifacts: MarkdownArtifact[]
  profiles: StoredProfile[]
}

function emptyStore(): StoreShape {
  return { artifacts: [], profiles: [] }
}

function loadStore(): StoreShape {
  if (!existsSync(STORE_PATH)) return emptyStore()
  try {
    const parsed = JSON.parse(readFileSync(STORE_PATH, 'utf-8')) as Partial<StoreShape>
    return { artifacts: parsed.artifacts ?? [], profiles: parsed.profiles ?? [] }
  } catch {
    // Corrupt or unreadable store -- start fresh rather than crash the server.
    return emptyStore()
  }
}

let store = loadStore()

function persist(): void {
  mkdirSync(DATA_DIR, { recursive: true })
  const tmpPath = `${STORE_PATH}.tmp-${process.pid}`
  writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8')
  renameSync(tmpPath, STORE_PATH)
}

/** Test-only: resets the in-memory store without touching disk. */
export function __resetStoreForTests(): void {
  store = emptyStore()
}

export function saveMarkdownArtifact(
  input: Omit<MarkdownArtifact, 'id' | 'version' | 'createdAt'>,
): MarkdownArtifact {
  const priorVersions = store.artifacts.filter(
    (a) => a.sessionId === input.sessionId && a.workspaceId === input.workspaceId,
  )
  const artifact: MarkdownArtifact = {
    ...input,
    id: randomUUID(),
    version: priorVersions.length + 1,
    createdAt: new Date().toISOString(),
  }
  store.artifacts.push(artifact)
  persist()
  return artifact
}

export function getMarkdownArtifact(id: string): MarkdownArtifact | undefined {
  return store.artifacts.find((a) => a.id === id)
}

export function getLatestMarkdownArtifact(sessionId: string, workspaceId: string): MarkdownArtifact | undefined {
  const matches = store.artifacts.filter((a) => a.sessionId === sessionId && a.workspaceId === workspaceId)
  return matches.at(-1)
}

export function getProfileRecord(sessionId: string, workspaceId: string): StoredProfile | undefined {
  return store.profiles.find((p) => p.sessionId === sessionId && p.workspaceId === workspaceId)
}

function findOrCreateProfile(sessionId: string, workspaceId: string, workspaceName?: string): StoredProfile {
  let profile = getProfileRecord(sessionId, workspaceId)
  if (!profile) {
    profile = { sessionId, workspaceId, workspaceName, history: [], updatedAt: new Date().toISOString() }
    store.profiles.push(profile)
  }
  return profile
}

/**
 * Records a successful classification as the new `current`, pushing the
 * prior current (if any) into history for audit, and clears any manual
 * override and last-attempt error -- both applied to the now-superseded
 * state, not this fresh result.
 */
export function upsertClassification(input: {
  sessionId: string
  workspaceId: string
  workspaceName?: string
  record: ClassificationRecord
}): MatterProfileRecord {
  const profile = findOrCreateProfile(input.sessionId, input.workspaceId, input.workspaceName)
  if (profile.current) profile.history.push(profile.current)
  profile.current = input.record
  profile.workspaceName = input.workspaceName ?? profile.workspaceName
  profile.override = undefined
  profile.lastError = undefined
  profile.updatedAt = new Date().toISOString()
  persist()
  return profile
}

/** Records a failed attempt without disturbing any existing successful `current` classification. */
export function recordClassificationFailure(
  sessionId: string,
  workspaceId: string,
  workspaceName: string | undefined,
  error: { code: string; message: string },
): MatterProfileRecord {
  const profile = findOrCreateProfile(sessionId, workspaceId, workspaceName)
  profile.lastError = { ...error, at: new Date().toISOString() }
  profile.updatedAt = new Date().toISOString()
  persist()
  return profile
}

export function recordManualCorrection(
  sessionId: string,
  workspaceId: string,
  correction: ManualCorrection,
): MatterProfileRecord | undefined {
  const profile = getProfileRecord(sessionId, workspaceId)
  if (!profile) return undefined
  profile.override = correction
  profile.updatedAt = new Date().toISOString()
  persist()
  return profile
}
