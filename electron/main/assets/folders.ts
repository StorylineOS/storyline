/**
 * Asset library folders — a logical tree stored in the DB. Physical files stay
 * flat under the project's `assets/` folder; folders only organise them.
 */
import { randomUUID } from 'node:crypto'
import type { AssetFolder } from '@shared/types'
import type { CreateFolderInput } from '@shared/ipc'
import { getDb } from '../db'

interface FolderRow {
  id: string
  project_id: string
  name: string
  parent_id: string | null
  created_at: number
}

function rowToFolder(row: FolderRow): AssetFolder {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    parentId: row.parent_id,
    createdAt: row.created_at,
  }
}

function projectId(): string {
  const row = getDb().prepare('SELECT id FROM project LIMIT 1').get() as { id: string } | undefined
  if (!row) throw new Error('No project is open.')
  return row.id
}

function getFolder(id: string): AssetFolder {
  const row = getDb().prepare('SELECT * FROM asset_folders WHERE id = ?').get(id) as
    | FolderRow
    | undefined
  if (!row) throw new Error('Folder not found.')
  return rowToFolder(row)
}

export function listFolders(): AssetFolder[] {
  const rows = getDb()
    .prepare('SELECT * FROM asset_folders ORDER BY name COLLATE NOCASE')
    .all() as FolderRow[]
  return rows.map(rowToFolder)
}

export function createFolder(input: CreateFolderInput): AssetFolder {
  const name = input.name.trim()
  if (!name) throw new Error('Folder name is required.')
  if (input.parentId) getFolder(input.parentId) // validate parent exists

  const folder: AssetFolder = {
    id: randomUUID(),
    projectId: projectId(),
    name,
    parentId: input.parentId,
    createdAt: Date.now(),
  }
  getDb()
    .prepare(
      `INSERT INTO asset_folders (id, project_id, name, parent_id, created_at)
       VALUES (@id, @projectId, @name, @parentId, @createdAt)`,
    )
    .run(folder)
  return folder
}

export function renameFolder(id: string, name: string): AssetFolder {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Folder name is required.')
  getFolder(id)
  getDb().prepare('UPDATE asset_folders SET name = ? WHERE id = ?').run(trimmed, id)
  return getFolder(id)
}

/** Delete a folder; its assets and subfolders are reparented to its parent. */
export function deleteFolder(id: string): void {
  const folder = getFolder(id)
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare('UPDATE assets SET folder_id = ? WHERE folder_id = ?').run(folder.parentId, id)
    db.prepare('UPDATE asset_folders SET parent_id = ? WHERE parent_id = ?').run(
      folder.parentId,
      id,
    )
    db.prepare('DELETE FROM asset_folders WHERE id = ?').run(id)
  })
  tx()
}
