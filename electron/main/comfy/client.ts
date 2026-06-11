/**
 * The ComfyUI bridge. All ComfyUI knowledge lives here (CLAUDE.md engine-isolation
 * rule). Slice B is an embed + bridge: we don't drive workflows via the API yet —
 * we upload a shot's input so it's available in Comfy, and pull the latest output
 * back as a take. Uses Comfy's HTTP API: /system_stats, /upload/image, /history, /view.
 */
import { join, extname, basename } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { Take, ComfyStatus, AssetKind } from '@shared/types'
import { getSettings } from '../settings/store'
import { getOpenProjectFolder } from '../db'
import { addTake, shotInputAbsPath } from '../shots/store'

function baseUrl(): string {
  return getSettings().comfyUrl.replace(/\/+$/, '')
}

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

/** Upload a shot's input file into ComfyUI's input folder so it can be used there. */
export async function sendShotInput(shotId: string): Promise<string> {
  const absPath = shotInputAbsPath(shotId)
  const buf = readFileSync(absPath)
  const form = new FormData()
  form.append('image', new Blob([buf]), basename(absPath))
  form.append('overwrite', 'true')
  const res = await fetch(`${baseUrl()}/upload/image`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`ComfyUI upload failed (${res.status}). Is it running?`)
  const json = (await res.json()) as { name?: string }
  return json.name ?? basename(absPath)
}

interface OutputFile {
  filename: string
  subfolder?: string
  type?: string
}

interface HistoryEntry {
  outputs: Record<string, Record<string, OutputFile[]>>
}

/** Find the first downloadable file across a history entry's node outputs. */
function findOutputFile(outputs: HistoryEntry['outputs']): OutputFile | null {
  for (const node of Object.values(outputs)) {
    for (const value of Object.values(node)) {
      if (Array.isArray(value) && value.length > 0 && typeof value[0]?.filename === 'string') {
        return value[0]
      }
    }
  }
  return null
}

/**
 * Pull the most recent ComfyUI output and attach it to the shot as a take.
 * Heuristic: the last entry in /history is the latest run.
 */
export async function pullLatestToShot(shotId: string): Promise<Take> {
  const url = baseUrl()
  const res = await fetch(`${url}/history`)
  if (!res.ok) throw new Error(`Could not read ComfyUI history (${res.status}). Is it running?`)
  const history = (await res.json()) as Record<string, HistoryEntry>
  const ids = Object.keys(history)
  if (ids.length === 0) {
    throw new Error('No ComfyUI output found yet — generate something in ComfyUI first.')
  }
  const promptId = ids[ids.length - 1]
  const file = findOutputFile(history[promptId].outputs)
  if (!file) throw new Error('The latest ComfyUI run produced no downloadable output.')

  const viewUrl =
    `${url}/view?filename=${encodeURIComponent(file.filename)}` +
    `&subfolder=${encodeURIComponent(file.subfolder ?? '')}` +
    `&type=${encodeURIComponent(file.type ?? 'output')}`
  const bin = await fetch(viewUrl)
  if (!bin.ok) throw new Error(`Could not download ComfyUI output (${bin.status}).`)

  const folder = getOpenProjectFolder()
  if (!folder) throw new Error('No project is open.')
  const ext = extname(file.filename) || '.png'
  const relPath = `takes/${randomUUID()}${ext}`
  writeFileSync(join(folder, relPath), Buffer.from(await bin.arrayBuffer()))

  return addTake({
    shotId,
    filePath: relPath,
    kind: kindForExt(ext),
    comfyPromptId: promptId,
    params: {},
  })
}
