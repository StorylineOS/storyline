/**
 * SQLite schema for a project's `project.db`. The DB is the source of truth for
 * a project — "save" is implicit. Bumping SCHEMA_VERSION + adding a migration is
 * how the schema evolves (see runMigrations).
 */
import type BetterSqlite3 from 'better-sqlite3'

export const SCHEMA_VERSION = 4

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS project (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sequences (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS shots (
  id                   TEXT PRIMARY KEY,
  sequence_id          TEXT NOT NULL,
  name                 TEXT NOT NULL,
  kind                 TEXT NOT NULL,
  position             INTEGER NOT NULL,
  input_asset_id       TEXT,
  hero_take_id         TEXT,
  workflow_template_id TEXT,
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS takes (
  id              TEXT PRIMARY KEY,
  shot_id         TEXT NOT NULL,
  file_path       TEXT NOT NULL,
  kind            TEXT NOT NULL,
  params          TEXT NOT NULL,
  comfy_prompt_id TEXT,
  created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS asset_folders (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  parent_id   TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  folder_id   TEXT,
  name        TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  kind        TEXT NOT NULL,
  thumb_path  TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS moodboard_items (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'asset',
  asset_id    TEXT,
  data        TEXT,
  x           REAL NOT NULL,
  y           REAL NOT NULL,
  width       REAL NOT NULL,
  height      REAL NOT NULL,
  rotation    REAL NOT NULL DEFAULT 0,
  z_index     INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS moodboard_connectors (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL,
  from_item_id TEXT NOT NULL,
  to_item_id   TEXT NOT NULL,
  label        TEXT,
  data         TEXT,
  created_at   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS timeline_clips (
  id          TEXT PRIMARY KEY,
  sequence_id TEXT NOT NULL,
  shot_id     TEXT NOT NULL,
  track       INTEGER NOT NULL,
  start_time  REAL NOT NULL,
  in_point    REAL NOT NULL,
  out_point   REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_templates (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  graph       TEXT NOT NULL,
  params      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shots_sequence ON shots(sequence_id);
CREATE INDEX IF NOT EXISTS idx_takes_shot ON takes(shot_id);
CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_folder ON assets(folder_id);
CREATE INDEX IF NOT EXISTS idx_asset_folders_parent ON asset_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_moodboard_items_project ON moodboard_items(project_id);
CREATE INDEX IF NOT EXISTS idx_moodboard_connectors_project ON moodboard_connectors(project_id);
CREATE INDEX IF NOT EXISTS idx_clips_sequence ON timeline_clips(sequence_id);
`

/** Create tables (idempotent) and stamp the schema version. */
export function applySchema(db: BetterSqlite3.Database): void {
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  // Additive column migrations must run before SCHEMA_SQL, since SCHEMA_SQL builds
  // indexes that reference newly-added columns.
  migrateColumns(db)
  db.exec(SCHEMA_SQL)
  stampVersion(db)
}

/**
 * Additive column migrations for pre-existing projects (no-ops on fresh DBs, where
 * SCHEMA_SQL already builds the current shape). Must run before SCHEMA_SQL so its
 * indexes can reference newly-added columns.
 */
function migrateColumns(db: BetterSqlite3.Database): void {
  // v1 → v2: assets.folder_id
  addColumnIfMissing(db, 'assets', 'folder_id', 'TEXT')

  // v2 → v3: moodboard_items gains generic-item columns (the old shape had only
  // asset_id/note/x/y/width/height). moodboard_connectors is created by SCHEMA_SQL.
  addColumnIfMissing(db, 'moodboard_items', 'type', "TEXT NOT NULL DEFAULT 'asset'")
  addColumnIfMissing(db, 'moodboard_items', 'data', 'TEXT')
  addColumnIfMissing(db, 'moodboard_items', 'rotation', 'REAL NOT NULL DEFAULT 0')
  addColumnIfMissing(db, 'moodboard_items', 'z_index', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(db, 'moodboard_items', 'created_at', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(db, 'moodboard_items', 'updated_at', 'INTEGER NOT NULL DEFAULT 0')

  // v3 → v4: shots gain a source asset reference.
  addColumnIfMissing(db, 'shots', 'input_asset_id', 'TEXT')
}

function addColumnIfMissing(
  db: BetterSqlite3.Database,
  table: string,
  column: string,
  definition: string,
): void {
  const exists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(table)
  if (!exists) return
  const cols = db.pragma(`table_info(${table})`) as Array<{ name: string }>
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

function stampVersion(db: BetterSqlite3.Database): void {
  const current = db.pragma('user_version', { simple: true }) as number
  if (current < SCHEMA_VERSION) {
    db.pragma(`user_version = ${SCHEMA_VERSION}`)
  }
}
