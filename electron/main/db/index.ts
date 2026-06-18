/**
 * Owns the single open project database. The whole app works on one project at a
 * time; opening another closes the previous connection.
 */
import { join } from 'node:path'
import Database from 'better-sqlite3'
import type BetterSqlite3 from 'better-sqlite3'
import { applySchema } from './schema'

let connection: BetterSqlite3.Database | null = null
let openPath: string | null = null

/** Open (creating if needed) the `project.db` inside a `.inlinestudio` folder. */
export function openProjectDb(projectFolder: string): BetterSqlite3.Database {
  closeProjectDb()
  const dbPath = join(projectFolder, 'project.db')
  const db = new Database(dbPath)
  applySchema(db)
  connection = db
  openPath = projectFolder
  return db
}

/** The currently open project DB, or throw if none is open. */
export function getDb(): BetterSqlite3.Database {
  if (!connection) throw new Error('No project is open.')
  return connection
}

export function getOpenProjectFolder(): string | null {
  return openPath
}

export function closeProjectDb(): void {
  if (connection) {
    connection.close()
    connection = null
    openPath = null
  }
}
