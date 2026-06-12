/**
 * Domain types shared by the main and renderer processes.
 *
 * The mental model (see CLAUDE.md):
 *   Project → Sequence → Shot → Take[]
 *   A Shot is a *slot with a history of takes*, never a single file.
 *   The timeline points at a Shot's `heroTakeId` (the current chosen take).
 */

export type ShotKind = 'image' | 'video'
export type AssetKind = 'image' | 'video' | 'audio'

/** A project is a portable `.storyline` folder; this is its DB-backed metadata. */
export interface Project {
  id: string
  name: string
  /** Absolute path to the `.storyline` folder on disk. */
  path: string
  createdAt: number
  updatedAt: number
}

/** Lightweight entry for the "recent projects" list (stored in app userData). */
export interface RecentProject {
  name: string
  path: string
  lastOpenedAt: number
}

export interface Sequence {
  id: string
  projectId: string
  name: string
  /** Order within the project. */
  position: number
}

export interface Shot {
  id: string
  sequenceId: string
  name: string
  kind: ShotKind
  /** Order within the sequence. */
  position: number
  /** The imported source asset this shot edits (its Input row), if any. */
  inputAssetId: string | null
  /** Currently chosen take placed on the timeline, if any. */
  heroTakeId: string | null
  /** Workflow template this shot generates with, if chosen. */
  workflowTemplateId: string | null
  /** The ComfyUI workflow (userdata name) this shot is linked to, if any. */
  comfyWorkflowName: string | null
  createdAt: number
  updatedAt: number
}

/** A library asset used as one of a shot's inputs (a shot can have several). */
export interface ShotInput {
  id: string
  shotId: string
  assetId: string
  position: number
}

/** Every ComfyUI render of a shot becomes an immutable Take. */
export interface Take {
  id: string
  shotId: string
  /** Relative path under the project's `takes/` folder. */
  filePath: string
  kind: AssetKind
  /** Snapshot of the params used to generate this take (JSON). */
  params: Record<string, unknown>
  /** ComfyUI prompt id that produced this take, if generated. */
  comfyPromptId: string | null
  createdAt: number
}

/** A logical folder in the asset library (a tree; physical files stay flat on disk). */
export interface AssetFolder {
  id: string
  projectId: string
  name: string
  /** Parent folder id, or null for a root-level folder. */
  parentId: string | null
  createdAt: number
}

/** Imported media in the project library. */
export interface Asset {
  id: string
  projectId: string
  /** Logical folder this asset lives in, or null for the library root. */
  folderId: string | null
  name: string
  /** Relative path under the project's `assets/` folder. */
  filePath: string
  kind: AssetKind
  thumbPath: string | null
  createdAt: number
}

/**
 * An item on the unified canvas. Beyond ideation items (asset/text), the canvas
 * also hosts the production graph: `shot` nodes (input/output handles), `layer`
 * group containers, and `preview` nodes that display a connected shot's output.
 */
export type MoodboardItemType = 'asset' | 'text' | 'shot' | 'layer' | 'preview'

export interface TextItemData {
  text: string
  fontSize: number
  bold: boolean
  italic: boolean
  underline: boolean
  color: string
  align: 'left' | 'center' | 'right'
}

/** Type-specific payload for a moodboard item (currently just text styling). */
export interface MoodboardItemData {
  text?: TextItemData
}

export interface MoodboardItem {
  id: string
  projectId: string
  type: MoodboardItemType
  /** Set when type === 'asset'. */
  assetId: string | null
  /** Set when type === 'shot' (and reused by 'preview' resolution). */
  shotId: string | null
  /** Containing layer item id, if this item lives inside a layer group. */
  parentId: string | null
  data: MoodboardItemData
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  createdAt: number
  updatedAt: number
}

/** An arrow/line connecting two moodboard items. */
export interface MoodboardConnector {
  id: string
  projectId: string
  fromItemId: string
  toItemId: string
  label: string | null
  data: Record<string, unknown>
  createdAt: number
}

/** The full board state for a project. */
export interface MoodboardSnapshot {
  items: MoodboardItem[]
  connectors: MoodboardConnector[]
}

/** A placed clip on the timeline, pointing at a shot's hero take. */
export interface TimelineClip {
  id: string
  sequenceId: string
  shotId: string
  track: number
  startTime: number
  inPoint: number
  outPoint: number
}

export interface WorkflowTemplate {
  id: string
  projectId: string
  name: string
  /** Raw ComfyUI workflow JSON. */
  graph: Record<string, unknown>
  /** Param schema marking which node inputs are user-editable. */
  params: WorkflowParam[]
}

export interface WorkflowParam {
  key: string
  label: string
  type: 'text' | 'number' | 'seed' | 'image' | 'model'
  /** Path into the graph JSON this param drives, e.g. "6.inputs.text". */
  nodePath: string
  default?: string | number
}

/** App-global settings (stored in Electron userData, not per-project). */
export interface AppSettings {
  /** The ComfyUI backend Storyline talks to and embeds. */
  comfyUrl: string
}

/** Result of pinging the configured ComfyUI backend. */
export interface ComfyStatus {
  running: boolean
  url: string
}

/** A single output file produced by a ComfyUI run. */
export interface ComfyOutput {
  filename: string
  subfolder: string
  type: string
  kind: AssetKind
  /** A `${comfyUrl}/view?...` URL for displaying the output. */
  url: string
}

/** The most recent ComfyUI run and its output files. */
export interface ComfyRun {
  promptId: string
  outputs: ComfyOutput[]
}

/** Absolute media directories of the open project, for sharing with ComfyUI. */
export interface ProjectMediaDirs {
  /** Where Storyline keeps imported inputs — point ComfyUI's --input-directory here. */
  inputDir: string
  /** Where Storyline keeps generated outputs — point ComfyUI's --output-directory here. */
  outputDir: string
}

/** Summary of an "export shots to folder" run. */
export interface ExportResult {
  /** Absolute directory the files were written to. */
  dir: string
  /** Count of shot outputs exported. */
  exported: number
  /** Names of shots skipped because they had no Output yet. */
  skipped: string[]
}
