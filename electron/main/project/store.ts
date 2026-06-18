/**
 * Project lifecycle: create/open a `.inlinestudio` folder and load its DB.
 *
 * A project on disk is a portable folder:
 *   MyFilm.inlinestudio/
 *     project.db   assets/   takes/   thumbs/
 */
import { join } from 'node:path'
import { mkdirSync, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { Project } from '@shared/types'
import { openProjectDb, getDb } from '../db'
import { recordRecent } from './recents'
import { backfillVideoAssets } from '../assets/store'

/** Extension for newly-created projects. */
const PROJECT_EXT = '.inlinestudio'
/** Also openable for backward compatibility (projects from when the app was "Storyline"). */
const LEGACY_PROJECT_EXTS = ['.storyline']
/** All folder extensions recognised as a project (new + legacy). */
const PROJECT_EXTS = [PROJECT_EXT, ...LEGACY_PROJECT_EXTS]

const isProjectExt = (folder: string): boolean => PROJECT_EXTS.some((ext) => folder.endsWith(ext))

const SUBDIRS = ['assets', 'takes', 'thumbs']

let currentProject: Project | null = null

function sanitizeFolderName(name: string): string {
  const base = name
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base.length > 0 ? base : 'untitled'
}

interface ProjectRow {
  id: string
  name: string
  created_at: number
  updated_at: number
}

function loadProjectRow(folder: string): Project {
  const db = getDb()
  const row = db.prepare('SELECT id, name, created_at, updated_at FROM project LIMIT 1').get() as
    | ProjectRow
    | undefined
  if (!row) throw new Error('project.db is missing its project record.')
  return {
    id: row.id,
    name: row.name,
    path: folder,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function createProject(input: { name: string; parentDir: string }): Project {
  const folderName = `${sanitizeFolderName(input.name)}${PROJECT_EXT}`
  const folder = join(input.parentDir, folderName)
  if (existsSync(folder)) {
    throw new Error(`A project already exists at ${folder}`)
  }
  mkdirSync(folder, { recursive: true })
  for (const sub of SUBDIRS) mkdirSync(join(folder, sub), { recursive: true })

  const db = openProjectDb(folder)
  const now = Date.now()
  const id = randomUUID()
  db.prepare('INSERT INTO project (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
    id,
    input.name,
    now,
    now,
  )

  const project: Project = { id, name: input.name, path: folder, createdAt: now, updatedAt: now }
  currentProject = project
  recordRecent({ name: project.name, path: folder })
  return project
}

export function openProject(folder: string): Project {
  // Accept legacy `.storyline` folders too, but trust a valid project.db over the
  // extension — a hand-renamed or differently-named folder with a project.db still opens.
  if (!isProjectExt(folder) && !existsSync(join(folder, 'project.db'))) {
    throw new Error('Not an Inline Studio project folder.')
  }
  if (!existsSync(join(folder, 'project.db'))) {
    throw new Error('That folder is not a valid Inline Studio project (no project.db).')
  }
  openProjectDb(folder)
  // Make sure media subdirs exist even for hand-copied projects.
  for (const sub of SUBDIRS) {
    const p = join(folder, sub)
    if (!existsSync(p)) mkdirSync(p, { recursive: true })
  }
  const project = loadProjectRow(folder)
  currentProject = project
  recordRecent({ name: project.name, path: folder })
  // Catch up videos imported before posters/transcodes existed (background, best-effort).
  backfillVideoAssets()
  return project
}

/**
 * Heuristic for the open dialog: is this dir an Inline Studio project? A valid
 * `project.db` is the real signal, so this also accepts legacy `.storyline` folders and
 * folders renamed away from the `.inlinestudio` extension.
 */
export function isProjectFolder(folder: string): boolean {
  try {
    return existsSync(join(folder, 'project.db'))
  } catch {
    return false
  }
}

export function getCurrentProject(): Project | null {
  return currentProject
}
