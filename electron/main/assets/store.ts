/**
 * Asset library: import media into the open project and list it. Imported files
 * are copied into the project's `assets/` folder (by id) so the project stays a
 * self-contained, portable folder.
 */
import { dialog } from 'electron'
import { join, extname, basename } from 'node:path'
import { copyFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { Asset, AssetKind } from '@shared/types'
import { getDb, getOpenProjectFolder } from '../db'

const KIND_BY_EXT: Record<string, AssetKind> = {
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
  '.gif': 'image',
  '.bmp': 'image',
  '.tiff': 'image',
  '.mp4': 'video',
  '.mov': 'video',
  '.webm': 'video',
  '.mkv': 'video',
  '.avi': 'video',
  '.m4v': 'video',
  '.mp3': 'audio',
  '.wav': 'audio',
  '.aac': 'audio',
  '.flac': 'audio',
  '.ogg': 'audio',
  '.m4a': 'audio',
}

function kindForFile(filePath: string): AssetKind | null {
  return KIND_BY_EXT[extname(filePath).toLowerCase()] ?? null
}

interface AssetRow {
  id: string
  project_id: string
  folder_id: string | null
  name: string
  file_path: string
  kind: AssetKind
  thumb_path: string | null
  created_at: number
}

function rowToAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    projectId: row.project_id,
    folderId: row.folder_id,
    name: row.name,
    filePath: row.file_path,
    kind: row.kind,
    thumbPath: row.thumb_path,
    createdAt: row.created_at,
  }
}

function projectId(): string {
  const row = getDb().prepare('SELECT id FROM project LIMIT 1').get() as { id: string } | undefined
  if (!row) throw new Error('No project is open.')
  return row.id
}

/** Copy a single file into the project (under `folderId`) and insert its row. */
function importFile(absPath: string, folderId: string | null): Asset | null {
  const kind = kindForFile(absPath)
  if (!kind) return null

  const folder = getOpenProjectFolder()
  if (!folder) throw new Error('No project is open.')

  const id = randomUUID()
  const ext = extname(absPath).toLowerCase()
  const relative = `assets/${id}${ext}`
  copyFileSync(absPath, join(folder, relative))

  const asset: Asset = {
    id,
    projectId: projectId(),
    folderId,
    name: basename(absPath),
    filePath: relative,
    kind,
    thumbPath: null,
    createdAt: Date.now(),
  }
  getDb()
    .prepare(
      `INSERT INTO assets (id, project_id, folder_id, name, file_path, kind, thumb_path, created_at)
       VALUES (@id, @projectId, @folderId, @name, @filePath, @kind, @thumbPath, @createdAt)`,
    )
    .run(asset)
  return asset
}

export async function importViaDialog(folderId: string | null): Promise<Asset[]> {
  if (!getOpenProjectFolder()) throw new Error('Open a project first.')

  const result = await dialog.showOpenDialog({
    title: 'Import media',
    buttonLabel: 'Import',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Media', extensions: Object.keys(KIND_BY_EXT).map((e) => e.slice(1)) },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  if (result.canceled || result.filePaths.length === 0) return []

  const imported: Asset[] = []
  for (const filePath of result.filePaths) {
    const asset = importFile(filePath, folderId)
    if (asset) imported.push(asset)
  }
  return imported
}

export function listAssets(): Asset[] {
  const rows = getDb().prepare('SELECT * FROM assets ORDER BY created_at DESC').all() as AssetRow[]
  return rows.map(rowToAsset)
}
