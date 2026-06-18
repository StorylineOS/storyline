/**
 * Usage memory: a bounded log of ComfyUI workflows that actually WORKED for a frame, so
 * Claude can recall and adapt them for similar intents instead of authoring from scratch.
 * Stored per-project (portable `.inlinestudio` folder), newest-first. The success signal is
 * "the frame's workflow became built/ready" (see saveLiveWorkflow), recorded here.
 */
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { getOpenProjectFolder } from '../db'

export interface WorkflowMemoryEntry {
  id: string
  /** What the workflow was for (the user's request / guidance + frame name). */
  intent: string
  frameName: string
  /** Distinct node types used (compact). */
  nodeTypes: string[]
  /** Model filenames referenced (checkpoints/loras/vae/…). */
  modelsUsed: string[]
  /** Full graph, kept only for the newest few entries to bound file size. */
  graph?: unknown
  createdAt: number
}

const MAX_ENTRIES = 25
const MAX_FULL_GRAPHS = 5

function memoryFile(): string | null {
  const folder = getOpenProjectFolder()
  return folder ? join(folder, 'workflow-memory.json') : null
}

function readAll(): WorkflowMemoryEntry[] {
  const f = memoryFile()
  if (!f) return []
  try {
    if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf-8')) as WorkflowMemoryEntry[]
  } catch {
    // fall through to empty
  }
  return []
}

function writeAll(entries: WorkflowMemoryEntry[]): void {
  const f = memoryFile()
  if (!f) return
  try {
    writeFileSync(f, JSON.stringify(entries, null, 2))
  } catch {
    // best-effort
  }
}

/** Record a workflow that worked. Bounds the log and keeps full graphs only for the newest. */
export function recordWorkflowMemory(entry: Omit<WorkflowMemoryEntry, 'id' | 'createdAt'>): void {
  const entries = readAll()
  entries.unshift({ ...entry, id: randomUUID(), createdAt: Date.now() })
  const trimmed = entries
    .slice(0, MAX_ENTRIES)
    .map((e, i) => (i < MAX_FULL_GRAPHS ? e : { ...e, graph: undefined }))
  writeAll(trimmed)
}

/** Past workflows ranked by keyword overlap with `intent`, falling back to recency. */
export function recallWorkflowMemory(intent: string, limit = 3): WorkflowMemoryEntry[] {
  const entries = readAll()
  if (entries.length === 0) return []
  const words = intent
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2)
  const scored = entries.map((e) => {
    const hay = `${e.intent} ${e.frameName}`.toLowerCase()
    return { e, score: words.reduce((s, w) => (hay.includes(w) ? s + 1 : s), 0) }
  })
  const matched = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score)
  return (matched.length ? matched.map((s) => s.e) : entries).slice(0, limit)
}
