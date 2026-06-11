/**
 * The ComfyUI bridge. All ComfyUI knowledge lives here (CLAUDE.md engine-isolation
 * rule). Slice B is an embed + bridge: we don't drive workflows via the API yet —
 * we upload a shot's input so it's available in Comfy, and pull the latest output
 * back as a take. Uses Comfy's HTTP API: /system_stats, /upload/image, /history, /view.
 */
import { join, extname } from 'node:path'
import { writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { Take, ComfyStatus, AssetKind, Shot } from '@shared/types'
import { getSettings } from '../settings/store'
import { getOpenProjectFolder } from '../db'
import { addTake, getShotById, linkWorkflow, shotInputAsset } from '../shots/store'
import { getCurrentProject } from '../project/store'

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

function sanitizeSegment(name: string): string {
  return (
    name
      .replace(/[\\/]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim() || 'untitled'
  )
}

/** A minimal, guaranteed-to-load LiteGraph workflow with a Note titled after the shot. */
function buildSeedWorkflow(shotName: string, inputFileName: string | null): unknown {
  const noteText =
    `Storyline shot: ${shotName}` +
    (inputFileName ? `\nInput file: ${inputFileName}` : '') +
    `\n\nBuild this shot's workflow here, then Save (the link persists).`
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
        title: shotName,
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

/**
 * Link a shot to a ComfyUI workflow: create a workflow named after the shot (seeded
 * with a Note) via Comfy's userdata API, and remember the name on the shot. If the
 * shot is already linked, just return it (don't clobber the user's edits).
 */
export async function linkShotWorkflow(shotId: string): Promise<Shot> {
  const shot = getShotById(shotId)
  if (shot.comfyWorkflowName) return shot

  const project = getCurrentProject()
  const projectSeg = sanitizeSegment(project?.name ?? 'Project')
  const shotSeg = sanitizeSegment(shot.name)
  const name = `Storyline/${projectSeg}/${shotSeg} (${shot.id.slice(0, 6)})`

  const input = shotInputAsset(shotId)
  const workflow = buildSeedWorkflow(shot.name, input?.fileName ?? null)

  const file = encodeURIComponent(`workflows/${name}.json`)
  const res = await fetch(`${baseUrl()}/userdata/${file}?overwrite=false`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  })
  // 409 = already exists (fine — reuse it). Other failures are real.
  if (!res.ok && res.status !== 409) {
    throw new Error(
      `Could not save the workflow to ComfyUI (${res.status}). Make sure it's running and recent enough to support the userdata API.`,
    )
  }
  return linkWorkflow(shotId, name)
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
