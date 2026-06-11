/**
 * The single typed contract for the renderer ↔ main IPC bridge.
 *
 * - `IpcChannels` are the only channel strings allowed (no stringly-typed
 *   `invoke('something')` scattered around — see CLAUDE.md).
 * - `StorylineApi` is the exact surface exposed on `window.storyline` by the
 *   preload. The renderer imports this type; the main process implements it.
 */
import type {
  Project,
  RecentProject,
  Asset,
  AssetFolder,
  MoodboardItem,
  MoodboardConnector,
  MoodboardSnapshot,
  MoodboardItemData,
  Shot,
  Take,
  AppSettings,
  ComfyStatus,
  ExportResult,
  ProjectMediaDirs,
} from './types'
import type { Result } from './result'

export const IpcChannels = {
  project: {
    create: 'project:create',
    open: 'project:open',
    openDialog: 'project:openDialog',
    listRecent: 'project:listRecent',
    current: 'project:current',
    mediaDirs: 'project:mediaDirs',
  },
  clipboard: {
    writeText: 'clipboard:writeText',
  },
  assets: {
    importDialog: 'assets:importDialog',
    list: 'assets:list',
  },
  folders: {
    list: 'folders:list',
    create: 'folders:create',
    rename: 'folders:rename',
    delete: 'folders:delete',
  },
  shots: {
    list: 'shots:list',
    importAsShots: 'shots:importAsShots',
    addFromAsset: 'shots:addFromAsset',
    rename: 'shots:rename',
    reorder: 'shots:reorder',
    delete: 'shots:delete',
    setHero: 'shots:setHero',
    listTakes: 'shots:listTakes',
    heroTakes: 'shots:heroTakes',
  },
  comfy: {
    status: 'comfy:status',
    sendShot: 'comfy:sendShot',
    pullLatest: 'comfy:pullLatest',
  },
  settings: {
    get: 'settings:get',
    setComfyUrl: 'settings:setComfyUrl',
  },
  export: {
    exportShots: 'export:exportShots',
  },
  moodboard: {
    list: 'moodboard:list',
    addAsset: 'moodboard:addAsset',
    addText: 'moodboard:addText',
    updateItem: 'moodboard:updateItem',
    deleteItem: 'moodboard:deleteItem',
    importAndPlace: 'moodboard:importAndPlace',
    createConnector: 'moodboard:createConnector',
    deleteConnector: 'moodboard:deleteConnector',
  },
  dialog: {
    pickDirectory: 'dialog:pickDirectory',
  },
} as const

/** Geometry/content fields a moodboard item update may change. */
export interface MoodboardItemPatch {
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  zIndex?: number
  data?: MoodboardItemData
}

export interface CreateFolderInput {
  name: string
  /** Parent folder id, or null for a root-level folder. */
  parentId: string | null
}

export interface CreateProjectInput {
  /** Display name; also used to derive the `.storyline` folder name. */
  name: string
  /** Absolute parent directory the `.storyline` folder is created in. */
  parentDir: string
}

/** The API surface the preload exposes on `window.storyline`. */
export interface StorylineApi {
  project: {
    create(input: CreateProjectInput): Promise<Result<Project>>
    /** Open a `.storyline` folder by absolute path. */
    open(path: string): Promise<Result<Project>>
    /** Show a native folder picker and open the chosen project. */
    openDialog(): Promise<Result<Project | null>>
    listRecent(): Promise<Result<RecentProject[]>>
    current(): Promise<Result<Project | null>>
    /** Absolute input/output dirs of the open project, for sharing with ComfyUI. */
    mediaDirs(): Promise<Result<ProjectMediaDirs>>
  }
  clipboard: {
    writeText(text: string): Promise<Result<void>>
  }
  assets: {
    /**
     * Show a native multi-file picker, copy chosen media into the project's library
     * under `folderId` (null = root), and return the new rows.
     */
    importDialog(folderId: string | null): Promise<Result<Asset[]>>
    /** All assets in the open project, newest first. */
    list(): Promise<Result<Asset[]>>
  }
  folders: {
    /** All asset folders in the open project. */
    list(): Promise<Result<AssetFolder[]>>
    create(input: CreateFolderInput): Promise<Result<AssetFolder>>
    rename(id: string, name: string): Promise<Result<AssetFolder>>
    /** Delete a folder; its assets and subfolders move up to the parent. */
    delete(id: string): Promise<Result<void>>
  }
  shots: {
    /** All shots in the open project, in order. */
    list(): Promise<Result<Shot[]>>
    /** Import media via dialog and create a shot per file. */
    importAsShots(): Promise<Result<Shot[]>>
    /** Create a shot from an existing library asset. */
    addFromAsset(assetId: string): Promise<Result<Shot>>
    rename(id: string, name: string): Promise<Result<Shot>>
    /** Persist a new left-to-right ordering. */
    reorder(orderedIds: string[]): Promise<Result<void>>
    delete(id: string): Promise<Result<void>>
    /** Choose which take is the shot's Output (null clears it). */
    setHero(id: string, takeId: string | null): Promise<Result<Shot>>
    /** The shot's generated takes, newest first. */
    listTakes(shotId: string): Promise<Result<Take[]>>
    /** The hero (Output) take of every shot that has one. */
    heroTakes(): Promise<Result<Take[]>>
  }
  comfy: {
    /** Is the configured ComfyUI reachable? */
    status(): Promise<Result<ComfyStatus>>
    /** Upload a shot's input into ComfyUI so it can be used there; returns the name. */
    sendShot(shotId: string): Promise<Result<string>>
    /** Pull ComfyUI's latest output and attach it to the shot as its Output take. */
    pullLatest(shotId: string): Promise<Result<Take>>
  }
  settings: {
    get(): Promise<Result<AppSettings>>
    setComfyUrl(url: string): Promise<Result<AppSettings>>
  }
  export: {
    /** Pick a folder and write each shot's Output in order; null if cancelled. */
    exportShots(): Promise<Result<ExportResult | null>>
  }
  moodboard: {
    /** The full board (items + connectors) for the open project. */
    list(): Promise<Result<MoodboardSnapshot>>
    /** Place an existing library asset on the board at (x, y). */
    addAsset(assetId: string, x: number, y: number): Promise<Result<MoodboardItem>>
    /** Add a new editable text item at (x, y). */
    addText(x: number, y: number): Promise<Result<MoodboardItem>>
    updateItem(id: string, patch: MoodboardItemPatch): Promise<Result<MoodboardItem>>
    deleteItem(id: string): Promise<Result<void>>
    /** Import media into the shared library AND place it on the board near (x, y). */
    importAndPlace(x: number, y: number): Promise<Result<MoodboardItem[]>>
    createConnector(fromItemId: string, toItemId: string): Promise<Result<MoodboardConnector>>
    deleteConnector(id: string): Promise<Result<void>>
  }
  dialog: {
    /** Native folder picker; returns the chosen absolute path or null if cancelled. */
    pickDirectory(): Promise<Result<string | null>>
  }
}

declare global {
  interface Window {
    storyline: StorylineApi
  }
}
