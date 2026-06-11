/**
 * Moodboard persistence: items (assets + text) and connectors for the open
 * project. The board shares the project's asset library — placing or importing
 * media here references/creates rows in the same `assets` table.
 */
import { randomUUID } from 'node:crypto'
import type {
  MoodboardItem,
  MoodboardConnector,
  MoodboardSnapshot,
  MoodboardItemData,
  TextItemData,
} from '@shared/types'
import type { MoodboardItemPatch } from '@shared/ipc'
import { getDb } from '../db'
import { importViaDialog } from '../assets/store'

const DEFAULT_SIZE: Record<'image' | 'video' | 'audio', { w: number; h: number }> = {
  image: { w: 320, h: 180 },
  video: { w: 360, h: 203 },
  audio: { w: 320, h: 80 },
}

const DEFAULT_TEXT: TextItemData = {
  text: 'Text',
  fontSize: 18,
  bold: false,
  italic: false,
  underline: false,
  color: '#e4e4e7',
  align: 'left',
}

interface ItemRow {
  id: string
  project_id: string
  type: 'asset' | 'text'
  asset_id: string | null
  data: string | null
  x: number
  y: number
  width: number
  height: number
  rotation: number
  z_index: number
  created_at: number
  updated_at: number
}

interface ConnectorRow {
  id: string
  project_id: string
  from_item_id: string
  to_item_id: string
  label: string | null
  data: string | null
  created_at: number
}

function rowToItem(row: ItemRow): MoodboardItem {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    assetId: row.asset_id,
    data: row.data ? (JSON.parse(row.data) as MoodboardItemData) : {},
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    rotation: row.rotation,
    zIndex: row.z_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToConnector(row: ConnectorRow): MoodboardConnector {
  return {
    id: row.id,
    projectId: row.project_id,
    fromItemId: row.from_item_id,
    toItemId: row.to_item_id,
    label: row.label,
    data: row.data ? (JSON.parse(row.data) as Record<string, unknown>) : {},
    createdAt: row.created_at,
  }
}

function projectId(): string {
  const row = getDb().prepare('SELECT id FROM project LIMIT 1').get() as { id: string } | undefined
  if (!row) throw new Error('No project is open.')
  return row.id
}

function getItem(id: string): MoodboardItem {
  const row = getDb().prepare('SELECT * FROM moodboard_items WHERE id = ?').get(id) as
    | ItemRow
    | undefined
  if (!row) throw new Error('Moodboard item not found.')
  return rowToItem(row)
}

function nextZIndex(): number {
  const row = getDb().prepare('SELECT MAX(z_index) AS z FROM moodboard_items').get() as {
    z: number | null
  }
  return (row.z ?? 0) + 1
}

function insertItem(item: MoodboardItem): MoodboardItem {
  getDb()
    .prepare(
      `INSERT INTO moodboard_items
         (id, project_id, type, asset_id, data, x, y, width, height, rotation, z_index, created_at, updated_at)
       VALUES (@id, @projectId, @type, @assetId, @data, @x, @y, @width, @height, @rotation, @zIndex, @createdAt, @updatedAt)`,
    )
    .run({ ...item, data: JSON.stringify(item.data) })
  return item
}

export function listBoard(): MoodboardSnapshot {
  const db = getDb()
  const items = (db.prepare('SELECT * FROM moodboard_items').all() as ItemRow[]).map(rowToItem)
  const connectors = (db.prepare('SELECT * FROM moodboard_connectors').all() as ConnectorRow[]).map(
    rowToConnector,
  )
  return { items, connectors }
}

export function addAssetItem(assetId: string, x: number, y: number): MoodboardItem {
  const asset = getDb().prepare('SELECT id, kind FROM assets WHERE id = ?').get(assetId) as
    | { id: string; kind: 'image' | 'video' | 'audio' }
    | undefined
  if (!asset) throw new Error('Asset not found.')

  const size = DEFAULT_SIZE[asset.kind]
  const now = Date.now()
  return insertItem({
    id: randomUUID(),
    projectId: projectId(),
    type: 'asset',
    assetId,
    data: {},
    x,
    y,
    width: size.w,
    height: size.h,
    rotation: 0,
    zIndex: nextZIndex(),
    createdAt: now,
    updatedAt: now,
  })
}

export function addTextItem(x: number, y: number): MoodboardItem {
  const now = Date.now()
  return insertItem({
    id: randomUUID(),
    projectId: projectId(),
    type: 'text',
    assetId: null,
    data: { text: { ...DEFAULT_TEXT } },
    x,
    y,
    width: 200,
    height: 60,
    rotation: 0,
    zIndex: nextZIndex(),
    createdAt: now,
    updatedAt: now,
  })
}

export function updateItem(id: string, patch: MoodboardItemPatch): MoodboardItem {
  getItem(id) // ensure exists
  const sets: string[] = []
  const params: Record<string, unknown> = { id, updatedAt: Date.now() }
  const map: Record<string, string> = {
    x: 'x',
    y: 'y',
    width: 'width',
    height: 'height',
    rotation: 'rotation',
    zIndex: 'z_index',
  }
  for (const [key, column] of Object.entries(map)) {
    const value = patch[key as keyof MoodboardItemPatch]
    if (typeof value === 'number') {
      sets.push(`${column} = @${key}`)
      params[key] = value
    }
  }
  if (patch.data !== undefined) {
    sets.push('data = @data')
    params.data = JSON.stringify(patch.data)
  }
  sets.push('updated_at = @updatedAt')
  getDb()
    .prepare(`UPDATE moodboard_items SET ${sets.join(', ')} WHERE id = @id`)
    .run(params)
  return getItem(id)
}

export function deleteItem(id: string): void {
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM moodboard_connectors WHERE from_item_id = ? OR to_item_id = ?').run(
      id,
      id,
    )
    db.prepare('DELETE FROM moodboard_items WHERE id = ?').run(id)
  })
  tx()
}

export async function importAndPlace(x: number, y: number): Promise<MoodboardItem[]> {
  // Import into the shared library root, then place each on the board in a cascade.
  const assets = await importViaDialog(null)
  return assets.map((asset, i) => addAssetItem(asset.id, x + i * 28, y + i * 28))
}

export function createConnector(fromItemId: string, toItemId: string): MoodboardConnector {
  getItem(fromItemId)
  getItem(toItemId)
  const connector: MoodboardConnector = {
    id: randomUUID(),
    projectId: projectId(),
    fromItemId,
    toItemId,
    label: null,
    data: {},
    createdAt: Date.now(),
  }
  getDb()
    .prepare(
      `INSERT INTO moodboard_connectors (id, project_id, from_item_id, to_item_id, label, data, created_at)
       VALUES (@id, @projectId, @fromItemId, @toItemId, @label, @data, @createdAt)`,
    )
    .run({ ...connector, data: JSON.stringify(connector.data) })
  return connector
}

export function deleteConnector(id: string): void {
  getDb().prepare('DELETE FROM moodboard_connectors WHERE id = ?').run(id)
}
