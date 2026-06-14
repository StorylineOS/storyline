/**
 * The ComfyUI bridge. All ComfyUI knowledge lives here (CLAUDE.md engine-isolation
 * rule). Slice B is an embed + bridge: we don't drive workflows via the API yet —
 * we upload a frame's input so it's available in Comfy, and pull the latest output
 * back as a take. Uses Comfy's HTTP API: /system_stats, /upload/image, /history, /view.
 */
import { join, extname } from 'node:path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { Take, ComfyStatus, AssetKind, Frame, ComfyOutput, ComfyRun } from '@shared/types'
import { getSettings } from '../settings/store'
import { getOpenProjectFolder } from '../db'
import {
  addTake,
  getFrameById,
  linkWorkflow,
  frameInputFileNames,
  frameInputAssetPaths,
} from '../frames/store'
import { getCurrentProject } from '../project/store'

function baseUrl(): string {
  return getSettings().comfyUrl.replace(/\/+$/, '')
}

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.mkv', '.gif', '.avi', '.m4v'])

function kindForExt(ext: string): AssetKind {
  return VIDEO_EXTS.has(ext.toLowerCase()) ? 'video' : 'image'
}

/** Is the configured ComfyUI reachable? */
export async function ping(): Promise<ComfyStatus> {
  const url = baseUrl()
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2500)
    const res = await fetch(`${url}/system_stats`, { signal: ctrl.signal })
    clearTimeout(timer)
    return { running: res.ok, url }
  } catch {
    return { running: false, url }
  }
}

function sanitizeSegment(name: string): string {
  // Keep only characters that survive ComfyUI's userdata path + workflow-store lookup
  // unchanged. Apostrophes, parentheses, slashes, etc. get encoded differently and
  // break the "open the saved workflow" match → it opens an Unsaved copy and Save
  // then conflicts (409). Allow letters, digits, space, dash, underscore.
  return (
    name
      .replace(/[^A-Za-z0-9 _-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'untitled'
  )
}

/** A minimal, guaranteed-to-load LiteGraph workflow with a Note titled after the frame. */
function buildSeedWorkflow(frameName: string, inputFileNames: string[]): unknown {
  const inputsLine = inputFileNames.length > 0 ? `\nInputs:\n  ${inputFileNames.join('\n  ')}` : ''
  const noteText =
    `Storyline frame: ${frameName}` +
    inputsLine +
    `\n\nBuild this frame's workflow here, then Save (the link persists).`
  return {
    last_node_id: 1,
    last_link_id: 0,
    nodes: [
      {
        id: 1,
        type: 'Note',
        pos: [80, 80],
        size: [380, 160],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [],
        outputs: [],
        title: frameName,
        properties: {},
        widgets_values: [noteText],
        color: '#432',
        bgcolor: '#653',
      },
    ],
    links: [],
    groups: [],
    config: {},
    extra: {},
    version: 0.4,
  }
}

// ── Durable workflow storage ────────────────────────────────────────────────
// Storyline owns the canonical copy of each frame's workflow at
// <project>/workflows/<frameId>.json, so switching ComfyUI installs (e.g. an
// ephemeral cloud box) never loses it. ComfyUI holds a working copy under
// /userdata/workflows/<name>.json; we push our copy to it and pull edits back.

function workflowNameFor(frame: Frame): string {
  const project = getCurrentProject()
  const projectSeg = sanitizeSegment(project?.name ?? 'Project')
  const frameSeg = sanitizeSegment(frame.name)
  return `Storyline/${projectSeg}/${frameSeg} ${frame.id.slice(0, 6)}`
}

function localWorkflowPath(frameId: string): string {
  const folder = getOpenProjectFolder()
  if (!folder) throw new Error('No project is open.')
  return join(folder, 'workflows', `${frameId}.json`)
}

function readLocalWorkflow(frameId: string): unknown | null {
  const path = localWorkflowPath(frameId)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

function writeLocalWorkflow(frameId: string, json: unknown): void {
  const folder = getOpenProjectFolder()
  if (!folder) throw new Error('No project is open.')
  mkdirSync(join(folder, 'workflows'), { recursive: true })
  writeFileSync(localWorkflowPath(frameId), JSON.stringify(json), 'utf-8')
}

function userdataUrl(name: string): string {
  return `${baseUrl()}/userdata/${encodeURIComponent(`workflows/${name}.json`)}`
}

/** Fetch a workflow from ComfyUI's userdata (null if it doesn't exist there). */
async function getRemoteWorkflow(name: string): Promise<unknown | null> {
  const res = await fetch(userdataUrl(name))
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Could not read the workflow from ComfyUI (${res.status}).`)
  return res.json()
}

/**
 * Store a workflow into ComfyUI's userdata, overwriting any existing copy. Retries
 * transient failures (network drop, 5xx, or an unexpected 409) with a short backoff
 * and a per-attempt timeout — the connected ComfyUI may be a remote/cloud box that
 * briefly hiccups. Clear client errors (e.g. 400/404) fail fast.
 */
async function pushWorkflowToComfy(name: string, json: unknown): Promise<void> {
  const url = `${userdataUrl(name)}?overwrite=true`
  const body = JSON.stringify(json)
  const ATTEMPTS = 3
  let lastError = 'no response'

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    let status: number | null = null
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 10_000)
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (res.ok) return
      status = res.status
      lastError = `ComfyUI returned ${res.status}`
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
    // A clear client error (bad request, not found, …) won't fix itself — stop. The
    // exception is 409: with overwrite=true it signals a stale lock, so retry it.
    if (status !== null && status < 500 && status !== 409) break
    if (attempt < ATTEMPTS) await delay(300 * attempt)
  }

  throw new Error(
    `Could not save the workflow to ComfyUI (${lastError}). Make sure it's running and recent enough to support the userdata API.`,
  )
}

/**
 * Link/open a frame's ComfyUI workflow, with Storyline as the durable source of
 * truth: if we have a local copy, push it to the connected ComfyUI (restores it
 * after an install switch); else adopt ComfyUI's copy if present; else seed a new
 * one. The frame's workflow name is persisted on first link.
 */
export async function linkFrameWorkflow(frameId: string): Promise<Frame> {
  const frame = getFrameById(frameId)
  const name = frame.comfyWorkflowName ?? workflowNameFor(frame)
  const linked = frame.comfyWorkflowName ? frame : linkWorkflow(frameId, name)

  const local = readLocalWorkflow(frameId)
  if (local) {
    await pushWorkflowToComfy(name, local)
  } else {
    const remote = await getRemoteWorkflow(name)
    if (remote != null) {
      writeLocalWorkflow(frameId, remote)
    } else {
      const seed = buildSeedWorkflow(frame.name, frameInputFileNames(frameId))
      await pushWorkflowToComfy(name, seed)
      writeLocalWorkflow(frameId, seed)
    }
  }
  return linked
}

/** Pull the frame's workflow from ComfyUI into the project copy. Returns true if it changed. */
export async function pullWorkflowToProject(frameId: string): Promise<boolean> {
  const frame = getFrameById(frameId)
  if (!frame.comfyWorkflowName) return false
  const remote = await getRemoteWorkflow(frame.comfyWorkflowName)
  if (remote == null) return false
  const prev = readLocalWorkflow(frameId)
  if (JSON.stringify(prev) === JSON.stringify(remote)) return false
  writeLocalWorkflow(frameId, remote)
  return true
}

/** Push the project's copy of the frame's workflow to ComfyUI. */
export async function pushWorkflowFromProject(frameId: string): Promise<void> {
  const frame = getFrameById(frameId)
  if (!frame.comfyWorkflowName) return
  const local = readLocalWorkflow(frameId)
  if (local == null) return
  await pushWorkflowToComfy(frame.comfyWorkflowName, local)
}

/**
 * Upload a frame's input assets to ComfyUI via /upload/image so they're available in
 * the LoadImage picker — the cloud-safe alternative to sharing a local input folder.
 * Returns the filenames ComfyUI stored them under. No-op if the frame has no inputs.
 */
export async function uploadFrameInputs(frameId: string): Promise<string[]> {
  const folder = getOpenProjectFolder()
  if (!folder) throw new Error('No project is open.')
  const inputs = frameInputAssetPaths(frameId)
  const uploaded: string[] = []
  for (const { filePath, name } of inputs) {
    const bytes = readFileSync(join(folder, filePath))
    const form = new FormData()
    form.append('image', new Blob([new Uint8Array(bytes)]), name)
    form.append('overwrite', 'true')
    const res = await fetch(`${baseUrl()}/upload/image`, { method: 'POST', body: form })
    if (!res.ok) {
      throw new Error(`Could not upload "${name}" to ComfyUI (${res.status}). Is it reachable?`)
    }
    const json = (await res.json().catch(() => ({}))) as { name?: string }
    uploaded.push(json.name ?? name)
  }
  return uploaded
}

interface OutputFile {
  filename: string
  subfolder?: string
  type?: string
}

interface HistoryEntry {
  outputs: Record<string, Record<string, OutputFile[]>>
}

/** All downloadable files across a history entry's node outputs, in node order. */
function collectOutputs(outputs: HistoryEntry['outputs']): OutputFile[] {
  const files: OutputFile[] = []
  for (const node of Object.values(outputs)) {
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item.filename === 'string') files.push(item)
        }
      }
    }
  }
  return files
}

function viewUrl(file: OutputFile): string {
  return (
    `${baseUrl()}/view?filename=${encodeURIComponent(file.filename)}` +
    `&subfolder=${encodeURIComponent(file.subfolder ?? '')}` +
    `&type=${encodeURIComponent(file.type ?? 'output')}`
  )
}

/** Download a ComfyUI output file into the project's takes/ and attach it as a take. */
async function saveOutputAsTake(
  frameId: string,
  file: OutputFile,
  promptId: string | null,
): Promise<Take> {
  const bin = await fetch(viewUrl(file))
  if (!bin.ok) throw new Error(`Could not download ComfyUI output (${bin.status}).`)
  const folder = getOpenProjectFolder()
  if (!folder) throw new Error('No project is open.')
  const ext = extname(file.filename) || '.png'
  const relPath = `takes/${randomUUID()}${ext}`
  writeFileSync(join(folder, relPath), Buffer.from(await bin.arrayBuffer()))
  return addTake({
    frameId,
    filePath: relPath,
    kind: kindForExt(ext),
    comfyPromptId: promptId,
    params: {},
  })
}

/**
 * Pull the most recent ComfyUI output and attach it to the frame as a take.
 * Heuristic: the last entry in /history is the latest run.
 */
export async function pullLatestToFrame(frameId: string): Promise<Take> {
  const res = await fetch(`${baseUrl()}/history`)
  if (!res.ok) throw new Error(`Could not read ComfyUI history (${res.status}). Is it running?`)
  const history = (await res.json()) as Record<string, HistoryEntry>
  const ids = Object.keys(history)
  if (ids.length === 0) {
    throw new Error('No ComfyUI output found yet — generate something in ComfyUI first.')
  }
  const promptId = ids[ids.length - 1]
  const file = collectOutputs(history[promptId].outputs)[0]
  if (!file) throw new Error('The latest ComfyUI run produced no downloadable output.')
  return saveOutputAsTake(frameId, file, promptId)
}

/** The most recent ComfyUI run and all its output files (for the capture strip). */
export async function latestRun(): Promise<ComfyRun | null> {
  const res = await fetch(`${baseUrl()}/history`)
  if (!res.ok) return null
  const history = (await res.json()) as Record<string, HistoryEntry>
  const ids = Object.keys(history)
  if (ids.length === 0) return null
  const promptId = ids[ids.length - 1]
  const outputs: ComfyOutput[] = collectOutputs(history[promptId].outputs).map((f) => ({
    filename: f.filename,
    subfolder: f.subfolder ?? '',
    type: f.type ?? 'output',
    kind: kindForExt(extname(f.filename)),
    url: viewUrl(f),
  }))
  return { promptId, outputs }
}

/** Download a specific ComfyUI output (from the capture strip) into the frame. */
export async function captureOutput(frameId: string, output: ComfyOutput): Promise<Take> {
  return saveOutputAsTake(
    frameId,
    { filename: output.filename, subfolder: output.subfolder, type: output.type },
    null,
  )
}
