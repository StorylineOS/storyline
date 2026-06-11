/**
 * Shots: the timeline's atomic unit. Each shot has an Input (an imported asset)
 * and a history of generated Takes; its hero take is the Output. For now all shots
 * live in a single auto-created default sequence (sequences aren't exposed in the UI yet).
 */
import { randomUUID } from 'node:crypto'
import type { Shot, Take, ShotKind, AssetKind } from '@shared/types'
import { getDb } from '../db'
import { importViaDialog } from '../assets/store'

interface ShotRow {
  id: string
  sequence_id: string
  name: string
  kind: ShotKind
  position: number
  input_asset_id: string | null
  hero_take_id: string | null
  workflow_template_id: string | null
  created_at: number
  updated_at: number
}

interface TakeRow {
  id: string
  shot_id: string
  file_path: string
  kind: AssetKind
  params: string
  comfy_prompt_id: string | null
  created_at: number
}

function rowToShot(row: ShotRow): Shot {
  return {
    id: row.id,
    sequenceId: row.sequence_id,
    name: row.name,
    kind: row.kind,
    position: row.position,
    inputAssetId: row.input_asset_id,
    heroTakeId: row.hero_take_id,
    workflowTemplateId: row.workflow_template_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToTake(row: TakeRow): Take {
  return {
    id: row.id,
    shotId: row.shot_id,
    filePath: row.file_path,
    kind: row.kind,
    params: JSON.parse(row.params) as Record<string, unknown>,
    comfyPromptId: row.comfy_prompt_id,
    createdAt: row.created_at,
  }
}

function projectId(): string {
  const row = getDb().prepare('SELECT id FROM project LIMIT 1').get() as { id: string } | undefined
  if (!row) throw new Error('No project is open.')
  return row.id
}

/** The single default sequence shots are created in; created on first use. */
function defaultSequenceId(): string {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM sequences ORDER BY position LIMIT 1').get() as
    | { id: string }
    | undefined
  if (existing) return existing.id
  const id = randomUUID()
  db.prepare('INSERT INTO sequences (id, project_id, name, position) VALUES (?, ?, ?, ?)').run(
    id,
    projectId(),
    'Main',
    0,
  )
  return id
}

function getShot(id: string): Shot {
  const row = getDb().prepare('SELECT * FROM shots WHERE id = ?').get(id) as ShotRow | undefined
  if (!row) throw new Error('Shot not found.')
  return rowToShot(row)
}

export function listShots(): Shot[] {
  const seqId = defaultSequenceId()
  const rows = getDb()
    .prepare('SELECT * FROM shots WHERE sequence_id = ? ORDER BY position')
    .all(seqId) as ShotRow[]
  return rows.map(rowToShot)
}

function createShot(asset: { id: string; kind: AssetKind }): Shot {
  if (asset.kind === 'audio') throw new Error('A shot must be an image or video, not audio.')
  const db = getDb()
  const seqId = defaultSequenceId()
  const count = (
    db.prepare('SELECT COUNT(*) AS n FROM shots WHERE sequence_id = ?').get(seqId) as { n: number }
  ).n
  const now = Date.now()
  const shot: Shot = {
    id: randomUUID(),
    sequenceId: seqId,
    name: String(count + 1),
    kind: asset.kind,
    position: count,
    inputAssetId: asset.id,
    heroTakeId: null,
    workflowTemplateId: null,
    createdAt: now,
    updatedAt: now,
  }
  db.prepare(
    `INSERT INTO shots
       (id, sequence_id, name, kind, position, input_asset_id, hero_take_id, workflow_template_id, created_at, updated_at)
     VALUES (@id, @sequenceId, @name, @kind, @position, @inputAssetId, @heroTakeId, @workflowTemplateId, @createdAt, @updatedAt)`,
  ).run(shot)
  return shot
}

function assetById(id: string): { id: string; kind: AssetKind } {
  const row = getDb().prepare('SELECT id, kind FROM assets WHERE id = ?').get(id) as
    | { id: string; kind: AssetKind }
    | undefined
  if (!row) throw new Error('Asset not found.')
  return row
}

export function addFromAsset(assetId: string): Shot {
  return createShot(assetById(assetId))
}

export async function importAsShots(): Promise<Shot[]> {
  const assets = await importViaDialog(null)
  return assets.filter((a) => a.kind !== 'audio').map((a) => createShot({ id: a.id, kind: a.kind }))
}

export function renameShot(id: string, name: string): Shot {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Shot name is required.')
  getShot(id)
  getDb()
    .prepare('UPDATE shots SET name = ?, updated_at = ? WHERE id = ?')
    .run(trimmed, Date.now(), id)
  return getShot(id)
}

export function reorderShots(orderedIds: string[]): void {
  const db = getDb()
  const now = Date.now()
  const stmt = db.prepare('UPDATE shots SET position = ?, updated_at = ? WHERE id = ?')
  const tx = db.transaction(() => {
    orderedIds.forEach((id, index) => stmt.run(index, now, id))
  })
  tx()
}

export function deleteShot(id: string): void {
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM takes WHERE shot_id = ?').run(id)
    db.prepare('DELETE FROM shots WHERE id = ?').run(id)
  })
  tx()
}

export function setHero(id: string, takeId: string | null): Shot {
  getShot(id)
  getDb()
    .prepare('UPDATE shots SET hero_take_id = ?, updated_at = ? WHERE id = ?')
    .run(takeId, Date.now(), id)
  return getShot(id)
}

export function listTakes(shotId: string): Take[] {
  const rows = getDb()
    .prepare('SELECT * FROM takes WHERE shot_id = ? ORDER BY created_at DESC')
    .all(shotId) as TakeRow[]
  return rows.map(rowToTake)
}
